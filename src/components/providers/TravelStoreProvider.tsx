"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cloud, loadCloudState } from "@/lib/store/cloud";
import * as S from "@/lib/travel-state";
import type { PlaceRef, PlaceVisit, ProvinceStatus, TravelState, Trip, TripItem } from "@/lib/travel-state";

/**
 * mode:
 *  - "demo": Supabase not configured → records live in this browser (localStorage)
 *  - "guest": Supabase configured, not signed in → read-only, prompt to sign in
 *  - "cloud": signed in → records persisted in Supabase (RLS-protected)
 */
export type StoreMode = "loading" | "demo" | "guest" | "cloud";

const LOCAL_KEY = "yoyo-travel:demo-state:v1";

function readLocal(): TravelState {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return S.emptyTravelState();
    const parsed = JSON.parse(raw);
    return S.isTravelState(parsed) ? parsed : S.emptyTravelState();
  } catch {
    return S.emptyTravelState();
  }
}

function writeLocal(state: TravelState) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked; state still works for this session
  }
}

interface StoreApi {
  mode: StoreMode;
  user: User | null;
  state: TravelState;
  error: string | null;
  canWrite: boolean;
  clearError: () => void;
  setProvinceStatus: (slug: string, status: ProvinceStatus | null) => Promise<void>;
  markVisited: (ref: PlaceRef, extra?: Partial<PlaceVisit>) => Promise<void>;
  removeVisit: (placeId: string) => Promise<void>;
  addWishlist: (ref: PlaceRef) => Promise<void>;
  removeWishlist: (placeId: string) => Promise<void>;
  moveWishlistToVisited: (placeId: string) => Promise<void>;
  createTrip: (input: Pick<Trip, "name"> & Partial<Trip>, refs?: Array<PlaceRef & { day?: number }>) => Promise<Trip | null>;
  updateTrip: (tripId: string, patch: Partial<Omit<Trip, "id" | "items">>) => Promise<void>;
  deleteTrip: (tripId: string) => Promise<void>;
  addTripItem: (tripId: string, ref: PlaceRef, day?: number) => Promise<boolean>;
  updateTripItem: (tripId: string, itemId: string, patch: Partial<TripItem>) => Promise<void>;
  moveTripItem: (tripId: string, itemId: string, delta: -1 | 1) => Promise<void>;
  removeTripItem: (tripId: string, itemId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<StoreApi | null>(null);

export function TravelStoreProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<StoreMode>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<TravelState>(S.emptyTravelState);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setState(readLocal());
      setMode("demo");
      const onStorage = (e: StorageEvent) => e.key === LOCAL_KEY && setState(readLocal());
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
    let cancelled = false;
    const apply = async (u: User | null) => {
      if (cancelled) return;
      setUser(u);
      if (!u) {
        setState(S.emptyTravelState());
        setMode("guest");
        return;
      }
      try {
        const loaded = await loadCloudState(sb);
        if (!cancelled) {
          setState(loaded);
          setMode("cloud");
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setMode("cloud");
        }
      }
    };
    sb.auth.getUser().then(({ data }) => apply(data.user ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") apply(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  /**
   * Apply a pure update optimistically, then persist. On cloud failure the
   * previous state is restored and an error surfaced.
   */
  const commit = useCallback(
    async (update: (s: TravelState) => TravelState, persist?: (next: TravelState, sb: NonNullable<ReturnType<typeof getBrowserSupabase>>, uid: string) => Promise<void>) => {
      if (mode === "guest" || mode === "loading") {
        setError("signin_required");
        return;
      }
      const prev = stateRef.current;
      const next = update(prev);
      if (next === prev) return;
      stateRef.current = next;
      setState(next);
      if (mode === "demo") {
        writeLocal(next);
        return;
      }
      const sb = getBrowserSupabase();
      if (!sb || !user || !persist) return;
      try {
        await persist(next, sb, user.id);
      } catch (e) {
        stateRef.current = prev;
        setState(prev);
        setError((e as Error).message || "save_failed");
      }
    },
    [mode, user],
  );

  const api = useMemo<StoreApi>(() => {
    const syncTrip = (tripId: string) => async (next: TravelState, sb: Parameters<typeof cloud.syncTripItems>[0], uid: string) => {
      const t = next.trips.find((x) => x.id === tripId);
      if (t) await cloud.syncTripItems(sb, uid, tripId, t.items);
    };
    return {
      mode,
      user,
      state,
      error,
      canWrite: mode === "demo" || mode === "cloud",
      clearError: () => setError(null),
      setProvinceStatus: (slug, status) =>
        commit(
          (s) => S.setProvinceStatus(s, slug, status),
          (_n, sb, uid) => cloud.setProvinceStatus(sb, uid, slug, status),
        ),
      markVisited: (ref, extra) =>
        commit(
          (s) => S.addVisit(s, ref, extra),
          (n, sb, uid) => cloud.upsertVisit(sb, uid, n.visits[ref.placeId]),
        ),
      removeVisit: (placeId) =>
        commit(
          (s) => S.removeVisit(s, placeId),
          (_n, sb) => cloud.removeVisit(sb, placeId),
        ),
      addWishlist: (ref) =>
        commit(
          (s) => S.addToWishlist(s, ref),
          (_n, sb, uid) => cloud.addWishlist(sb, uid, ref.placeId),
        ),
      removeWishlist: (placeId) =>
        commit(
          (s) => S.removeFromWishlist(s, placeId),
          (_n, sb) => cloud.removeWishlist(sb, placeId),
        ),
      moveWishlistToVisited: (placeId) =>
        commit(
          (s) => S.moveWishlistToVisited(s, placeId),
          async (n, sb, uid) => {
            await cloud.upsertVisit(sb, uid, n.visits[placeId]);
            await cloud.removeWishlist(sb, placeId);
          },
        ),
      createTrip: async (input, refs = []) => {
        let created: Trip | null = null;
        await commit(
          (s) => {
            const r = S.createTrip(s, input);
            created = r.trip;
            let next = r.state;
            for (const ref of refs) next = S.addTripItem(next, r.trip.id, ref, ref.day ?? 1);
            created = next.trips.find((t) => t.id === r.trip.id) ?? r.trip;
            return next;
          },
          async (n, sb, uid) => {
            const t = n.trips.find((x) => x.id === created?.id);
            if (!t) return;
            await cloud.upsertTrip(sb, uid, t);
            await cloud.syncTripItems(sb, uid, t.id, t.items);
          },
        );
        return created;
      },
      updateTrip: (tripId, patch) =>
        commit(
          (s) => S.updateTrip(s, tripId, patch),
          async (n, sb, uid) => {
            const t = n.trips.find((x) => x.id === tripId);
            if (t) await cloud.upsertTrip(sb, uid, t);
          },
        ),
      deleteTrip: (tripId) =>
        commit(
          (s) => S.deleteTrip(s, tripId),
          (_n, sb) => cloud.deleteTrip(sb, tripId),
        ),
      addTripItem: async (tripId, ref, day = 1) => {
        const trip = stateRef.current.trips.find((t) => t.id === tripId);
        if (!trip || trip.items.some((i) => i.placeId === ref.placeId)) return false;
        await commit((s) => S.addTripItem(s, tripId, ref, day), syncTrip(tripId));
        return true;
      },
      updateTripItem: (tripId, itemId, patch) => commit((s) => S.updateTripItem(s, tripId, itemId, patch), syncTrip(tripId)),
      moveTripItem: (tripId, itemId, delta) => commit((s) => S.moveTripItem(s, tripId, itemId, delta), syncTrip(tripId)),
      removeTripItem: (tripId, itemId) => commit((s) => S.removeTripItem(s, tripId, itemId), syncTrip(tripId)),
      signOut: async () => {
        const sb = getBrowserSupabase();
        if (sb) await sb.auth.signOut();
        window.location.assign("/");
      },
    };
  }, [mode, user, state, error, commit]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useTravelStore(): StoreApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTravelStore must be used inside TravelStoreProvider");
  return ctx;
}
