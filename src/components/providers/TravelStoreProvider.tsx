"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cloud, loadCloudState } from "@/lib/store/cloud";
import * as S from "@/lib/travel-state";
import type { ImportPlan, PlaceRef, PlaceVisit, ProvinceStatus, TravelState, Trip, TripExpense, TripItem } from "@/lib/travel-state";

/**
 * Two ways to use the app:
 *  - "local": guest (not signed in, or sign-in not configured). Everything
 *    works; records live in this browser's localStorage and are NOT synced.
 *  - "cloud": signed in. Records are saved to Supabase (RLS-protected) through
 *    an idempotent, coalescing save queue with retry.
 * After sign-in, guest records can be imported into the account (no duplicates).
 */
export type StoreMode = "loading" | "local" | "cloud";
export type SyncStatus = "idle" | "saving" | "saved" | "error";

const LOCAL_KEY = "yoyo-travel:demo-state:v1";
const BACKUP_KEY = "yoyo-travel:guest-backup:v1";

function storageWorks(): boolean {
  try {
    const k = "yoyo-travel:probe";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function readLocal(): TravelState {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return S.emptyTravelState();
    const parsed = JSON.parse(raw);
    return S.isTravelState(parsed) ? S.normalizeState(parsed) : S.emptyTravelState();
  } catch {
    return S.emptyTravelState();
  }
}

function writeLocal(state: TravelState): boolean {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** A save task re-reads the *current* state when it runs, so retries and coalescing are safe. */
type Task = (sb: SupabaseClient, uid: string, current: TravelState) => Promise<void>;

interface StoreApi {
  mode: StoreMode;
  user: User | null;
  authConfigured: boolean;
  state: TravelState;
  storageOk: boolean;
  syncStatus: SyncStatus;
  pendingSaves: number;
  retrySync: () => void;
  importOffer: ImportPlan | null;
  importing: boolean;
  importGuestData: () => Promise<boolean>;
  dismissImport: () => void;
  error: string | null;
  canWrite: boolean;
  clearError: () => void;
  setProvinceStatus: (slug: string, status: ProvinceStatus | null) => void;
  markVisited: (ref: PlaceRef, extra?: Partial<PlaceVisit>) => void;
  removeVisit: (placeId: string) => void;
  addWishlist: (ref: PlaceRef) => void;
  removeWishlist: (placeId: string) => void;
  moveWishlistToVisited: (placeId: string) => void;
  createTrip: (
    input: Pick<Trip, "name"> & Partial<Omit<Trip, "id" | "items" | "createdAt" | "expenses">>,
    refs?: Array<PlaceRef & { day?: number; estimatedCost?: number | null }>,
  ) => Promise<Trip | null>;
  updateTrip: (tripId: string, patch: Partial<Omit<Trip, "id" | "items" | "expenses">>) => void;
  deleteTrip: (tripId: string) => void;
  addTripItem: (tripId: string, ref: PlaceRef, day?: number) => Promise<boolean>;
  updateTripItem: (tripId: string, itemId: string, patch: Partial<TripItem>) => void;
  moveTripItem: (tripId: string, itemId: string, delta: -1 | 1) => void;
  removeTripItem: (tripId: string, itemId: string) => void;
  addExpense: (tripId: string, e: Omit<TripExpense, "id">) => void;
  removeExpense: (tripId: string, expenseId: string) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<StoreApi | null>(null);

export function TravelStoreProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<StoreMode>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<TravelState>(S.emptyTravelState);
  const [storageOk, setStorageOk] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [pendingSaves, setPendingSaves] = useState(0);
  const [importOffer, setImportOffer] = useState<ImportPlan | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authConfigured, setAuthConfigured] = useState(false);

  const stateRef = useRef(state);
  const modeRef = useRef<StoreMode>(mode);
  const userRef = useRef<User | null>(null);
  const queue = useRef(new Map<string, Task>());
  const running = useRef(false);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  stateRef.current = state;
  modeRef.current = mode;
  userRef.current = user;

  // ── cloud save queue ───────────────────────────────────────────────
  const flush = useCallback(async () => {
    const sb = getBrowserSupabase();
    const uid = userRef.current?.id;
    if (running.current || !sb || !uid || modeRef.current !== "cloud") return;
    running.current = true;
    setSyncStatus("saving");
    let failed = false;
    for (const [key, task] of [...queue.current.entries()]) {
      try {
        await task(sb, uid, stateRef.current);
        if (queue.current.get(key) === task) queue.current.delete(key);
      } catch {
        failed = true; // keep the task queued; local state keeps the user's change
      }
    }
    running.current = false;
    setPendingSaves(queue.current.size);
    if (failed) {
      setSyncStatus("error");
    } else if (queue.current.size) {
      void flush(); // more edits arrived while saving
    } else {
      setSyncStatus("saved");
    }
  }, []);

  const enqueue = useCallback(
    (key: string, task: Task) => {
      queue.current.set(key, task); // same key → latest wins (coalescing)
      setPendingSaves(queue.current.size);
      setSyncStatus("saving");
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => void flush(), 600); // debounce bursts of edits
    },
    [flush],
  );

  const retrySync = useCallback(() => void flush(), [flush]);

  // Retry automatically when the connection comes back; warn before leaving with unsaved changes.
  useEffect(() => {
    const onOnline = () => queue.current.size && void flush();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (queue.current.size) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [flush]);

  // ── session ───────────────────────────────────────────────────────
  useEffect(() => {
    const ok = storageWorks();
    setStorageOk(ok);
    const sb = getBrowserSupabase();
    setAuthConfigured(Boolean(sb));
    const goLocal = () => {
      setUser(null);
      setState(readLocal());
      setMode("local");
      setImportOffer(null);
    };
    const onStorage = (e: StorageEvent) => e.key === LOCAL_KEY && modeRef.current === "local" && setState(readLocal());
    window.addEventListener("storage", onStorage);
    if (!sb) {
      goLocal();
      return () => window.removeEventListener("storage", onStorage);
    }
    let cancelled = false;
    const apply = async (u: User | null) => {
      if (cancelled) return;
      if (!u) return goLocal();
      setUser(u);
      try {
        const loaded = await loadCloudState(sb);
        if (cancelled) return;
        setState(loaded);
        setMode("cloud");
        const plan = S.planGuestImport(readLocal(), loaded);
        setImportOffer(plan.counts.total > 0 ? plan : null);
      } catch {
        if (cancelled) return;
        setMode("cloud");
        setError("load_failed");
      }
    };
    sb.auth.getUser().then(({ data }) => apply(data.user ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id !== userRef.current?.id) apply(session?.user ?? null);
      if (event === "SIGNED_OUT") goLocal();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  /** Apply a pure update immediately, then persist (local write or queued cloud save). */
  const commit = useCallback(
    (update: (s: TravelState) => TravelState, key?: string, task?: Task) => {
      if (modeRef.current === "loading") return;
      const prev = stateRef.current;
      const next = update(prev);
      if (next === prev) return;
      stateRef.current = next;
      setState(next);
      if (modeRef.current === "local") {
        const ok = writeLocal(next);
        setStorageOk(ok);
        setSyncStatus(ok ? "saved" : "error");
        return;
      }
      if (key && task) enqueue(key, task);
    },
    [enqueue],
  );

  // Idempotent "make the DB match current state" tasks.
  const provinceTask =
    (slug: string): Task =>
    (sb, uid, cur) =>
      cloud.setProvinceStatus(sb, uid, slug, cur.provinces[slug]?.status ?? null);
  const visitTask =
    (placeId: string): Task =>
    (sb, uid, cur) =>
      cur.visits[placeId] ? cloud.upsertVisit(sb, uid, cur.visits[placeId]) : cloud.removeVisit(sb, uid, placeId);
  const wishTask =
    (placeId: string): Task =>
    (sb, uid, cur) =>
      cur.wishlist[placeId] ? cloud.addWishlist(sb, uid, placeId) : cloud.removeWishlist(sb, uid, placeId);
  const tripTask =
    (tripId: string): Task =>
    async (sb, uid, cur) => {
      const t = cur.trips.find((x) => x.id === tripId);
      if (!t) return cloud.deleteTrip(sb, uid, tripId);
      await cloud.upsertTrip(sb, uid, t);
      await cloud.syncTripChildren(sb, uid, t);
    };

  const importGuestData = useCallback(async () => {
    const sb = getBrowserSupabase();
    const uid = userRef.current?.id;
    if (!sb || !uid || !importOffer) return false;
    setImporting(true);
    try {
      await cloud.importPlan(sb, uid, importOffer);
      const merged = await loadCloudState(sb);
      setState(merged);
      try {
        // Keep a backup copy in this browser, then clear the guest draft.
        window.localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), data: readLocal() }));
        window.localStorage.removeItem(LOCAL_KEY);
      } catch {
        /* storage blocked: nothing to clear */
      }
      setImportOffer(null);
      return true;
    } catch {
      setError("import_failed");
      return false;
    } finally {
      setImporting(false);
    }
  }, [importOffer]);

  const api = useMemo<StoreApi>(
    () => ({
      mode,
      user,
      authConfigured,
      state,
      storageOk,
      syncStatus,
      pendingSaves,
      retrySync,
      importOffer,
      importing,
      importGuestData,
      dismissImport: () => setImportOffer(null),
      error,
      canWrite: mode !== "loading",
      clearError: () => setError(null),
      setProvinceStatus: (slug, status) => commit((s) => S.setProvinceStatus(s, slug, status), `prov:${slug}`, provinceTask(slug)),
      markVisited: (ref, extra) => commit((s) => S.addVisit(s, ref, extra), `visit:${ref.placeId}`, visitTask(ref.placeId)),
      removeVisit: (placeId) => commit((s) => S.removeVisit(s, placeId), `visit:${placeId}`, visitTask(placeId)),
      addWishlist: (ref) => commit((s) => S.addToWishlist(s, ref), `wish:${ref.placeId}`, wishTask(ref.placeId)),
      removeWishlist: (placeId) => commit((s) => S.removeFromWishlist(s, placeId), `wish:${placeId}`, wishTask(placeId)),
      moveWishlistToVisited: (placeId) => {
        commit((s) => S.moveWishlistToVisited(s, placeId), `visit:${placeId}`, visitTask(placeId));
        if (modeRef.current === "cloud") enqueue(`wish:${placeId}`, wishTask(placeId));
      },
      createTrip: async (input, refs = []) => {
        if (modeRef.current === "loading") return null;
        let created: Trip | null = null;
        commit(
          (s) => {
            const r = S.createTrip(s, input);
            let next = r.state;
            for (const ref of refs) {
              next = S.addTripItem(next, r.trip.id, ref, ref.day ?? 1);
              if (ref.estimatedCost != null) {
                const item = next.trips.find((t) => t.id === r.trip.id)?.items.find((i) => i.placeId === ref.placeId);
                if (item) next = S.updateTripItem(next, r.trip.id, item.id, { estimatedCost: ref.estimatedCost });
              }
            }
            created = next.trips.find((t) => t.id === r.trip.id) ?? r.trip;
            return next;
          },
          "trip:new",
          undefined,
        );
        const trip = created as Trip | null;
        if (trip && modeRef.current === "cloud") enqueue(`trip:${trip.id}`, tripTask(trip.id));
        return trip;
      },
      updateTrip: (tripId, patch) => commit((s) => S.updateTrip(s, tripId, patch), `trip:${tripId}`, tripTask(tripId)),
      deleteTrip: (tripId) => commit((s) => S.deleteTrip(s, tripId), `trip:${tripId}`, tripTask(tripId)),
      addTripItem: async (tripId, ref, day = 1) => {
        const trip = stateRef.current.trips.find((t) => t.id === tripId);
        if (!trip || trip.items.some((i) => i.placeId === ref.placeId)) return false;
        commit((s) => S.addTripItem(s, tripId, ref, day), `trip:${tripId}`, tripTask(tripId));
        return true;
      },
      updateTripItem: (tripId, itemId, patch) =>
        commit((s) => S.updateTripItem(s, tripId, itemId, patch), `trip:${tripId}`, tripTask(tripId)),
      moveTripItem: (tripId, itemId, delta) =>
        commit((s) => S.moveTripItem(s, tripId, itemId, delta), `trip:${tripId}`, tripTask(tripId)),
      removeTripItem: (tripId, itemId) => commit((s) => S.removeTripItem(s, tripId, itemId), `trip:${tripId}`, tripTask(tripId)),
      addExpense: (tripId, e) => commit((s) => S.addExpense(s, tripId, e), `trip:${tripId}`, tripTask(tripId)),
      removeExpense: (tripId, expenseId) =>
        commit((s) => S.removeExpense(s, tripId, expenseId), `trip:${tripId}`, tripTask(tripId)),
      signOut: async () => {
        const sb = getBrowserSupabase();
        if (sb) await sb.auth.signOut();
        window.location.assign("/");
      },
    }),
    [mode, user, authConfigured, state, storageOk, syncStatus, pendingSaves, importOffer, importing, error, commit, enqueue, retrySync, importGuestData],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useTravelStore(): StoreApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTravelStore must be used inside TravelStoreProvider");
  return ctx;
}
