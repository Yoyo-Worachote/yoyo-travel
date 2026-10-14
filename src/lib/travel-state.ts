/**
 * Personal travel records (passport, wishlist, trips) as a plain serialisable
 * state plus pure update functions. The same shape is used by the guest store
 * (localStorage) and the Supabase store, so UI and tests share one model.
 *
 * Province-level status is intentionally separate from place-level visits:
 * marking a province visited does NOT mark any of its places visited.
 */

export type ProvinceStatus = "visited" | "want";

export interface PlaceRef {
  placeId: string;
  provinceSlug: string;
  category: string;
  nameTh: string | null;
  nameEn: string | null;
}

export interface PlaceVisit extends PlaceRef {
  visitedOn: string; // YYYY-MM-DD
  note?: string | null;
  rating?: number | null; // 1..5 personal rating
  tags?: string[];
}

export interface WishlistItem extends PlaceRef {
  addedAt: string; // ISO
}

export const COST_CATEGORIES = ["accommodation", "food", "activity", "transport", "other"] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];
export const TRAVEL_STYLES = ["nature", "food", "cafe", "culture", "adventure", "family", "relax", "shopping"] as const;
export type TravelStyle = (typeof TRAVEL_STYLES)[number];
export const TRANSPORT_MODES = ["car", "bus", "train", "plane", "motorbike", "boat", "mixed"] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];
export const TRIP_STATUSES = ["planning", "booked", "completed", "archived"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export interface TripItem extends PlaceRef {
  id: string;
  day: number; // 1-based
  position: number;
  note?: string | null;
  startTime?: string | null; // HH:MM
  endTime?: string | null;
  /** budget bucket; defaults from the place kind */
  costCategory?: CostCategory | null;
  /** user-entered estimate (shown as "your estimate") */
  estimatedCost?: number | null;
  /** what the user actually paid (kept separate from estimates) */
  actualCost?: number | null;
}

/** Costs not tied to a place (fuel, tickets, souvenirs…). */
export interface TripExpense {
  id: string;
  day: number | null;
  category: CostCategory;
  label: string;
  amount: number;
  costType: "estimated" | "actual";
}

export interface Trip {
  id: string;
  name: string;
  description: string | null;
  provinceSlug: string | null;
  startDate: string | null;
  endDate: string | null;
  travelerCount: number;
  budget: number | null;
  currency: string;
  status: TripStatus;
  travelStyles: TravelStyle[];
  transportMode: TransportMode | null;
  notes: string | null;
  createdAt: string;
  updatedAt?: string;
  items: TripItem[];
  expenses: TripExpense[];
}

export interface TravelState {
  provinces: Record<string, { status: ProvinceStatus; updatedAt: string }>;
  visits: Record<string, PlaceVisit>;
  wishlist: Record<string, WishlistItem>;
  trips: Trip[];
}

export const emptyTravelState = (): TravelState => ({ provinces: {}, visits: {}, wishlist: {}, trips: [] });

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function setProvinceStatus(s: TravelState, slug: string, status: ProvinceStatus | null): TravelState {
  const provinces = { ...s.provinces };
  if (status) provinces[slug] = { status, updatedAt: new Date().toISOString() };
  else delete provinces[slug];
  return { ...s, provinces };
}

export function addVisit(s: TravelState, ref: PlaceRef, extra: Partial<PlaceVisit> = {}): TravelState {
  const visit: PlaceVisit = {
    ...ref,
    visitedOn: extra.visitedOn ?? s.visits[ref.placeId]?.visitedOn ?? todayIso(),
    note: extra.note ?? s.visits[ref.placeId]?.note ?? null,
    rating: extra.rating ?? s.visits[ref.placeId]?.rating ?? null,
    tags: extra.tags ?? s.visits[ref.placeId]?.tags ?? [],
  };
  return { ...s, visits: { ...s.visits, [ref.placeId]: visit } };
}

export function removeVisit(s: TravelState, placeId: string): TravelState {
  const visits = { ...s.visits };
  delete visits[placeId];
  return { ...s, visits };
}

export function addToWishlist(s: TravelState, ref: PlaceRef): TravelState {
  if (s.wishlist[ref.placeId]) return s; // no duplicates
  return { ...s, wishlist: { ...s.wishlist, [ref.placeId]: { ...ref, addedAt: new Date().toISOString() } } };
}

export function removeFromWishlist(s: TravelState, placeId: string): TravelState {
  if (!s.wishlist[placeId]) return s;
  const wishlist = { ...s.wishlist };
  delete wishlist[placeId];
  return { ...s, wishlist };
}

/** Wishlist → visited: records the visit and removes the wishlist entry. */
export function moveWishlistToVisited(s: TravelState, placeId: string, visitedOn = todayIso()): TravelState {
  const item = s.wishlist[placeId];
  if (!item) return s;
  const { addedAt: _addedAt, ...ref } = item;
  void _addedAt;
  return removeFromWishlist(addVisit(s, ref, { visitedOn }), placeId);
}

export function groupWishlistByProvince(s: TravelState): Record<string, WishlistItem[]> {
  const out: Record<string, WishlistItem[]> = {};
  for (const item of Object.values(s.wishlist)) {
    (out[item.provinceSlug] ??= []).push(item);
  }
  for (const list of Object.values(out)) list.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  return out;
}

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16).padStart(8, "0").slice(-8)}-${rand4()}-4${rand4().slice(1)}-a${rand4().slice(1)}-${rand4()}${rand4()}${rand4()}`;
function rand4() {
  return Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, "0");
}

export const clampTravelers = (n: number) => Math.max(1, Math.min(50, Math.round(Number(n) || 1)));

export function createTrip(
  s: TravelState,
  input: Pick<Trip, "name"> & Partial<Omit<Trip, "id" | "items" | "createdAt" | "expenses">> & { id?: string },
): { state: TravelState; trip: Trip } {
  const now = new Date().toISOString();
  const trip: Trip = {
    id: input.id ?? newId(),
    name: input.name.trim().slice(0, 120) || "Trip",
    description: input.description ?? null,
    provinceSlug: input.provinceSlug ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    travelerCount: clampTravelers(input.travelerCount ?? 1),
    budget: input.budget ?? null,
    currency: input.currency ?? "THB",
    status: input.status ?? "planning",
    travelStyles: input.travelStyles ?? [],
    transportMode: input.transportMode ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
    items: [],
    expenses: [],
  };
  return { state: { ...s, trips: [trip, ...s.trips] }, trip };
}

export function updateTrip(
  s: TravelState,
  tripId: string,
  patch: Partial<Omit<Trip, "id" | "items" | "expenses">>,
): TravelState {
  return {
    ...s,
    trips: s.trips.map((t) =>
      t.id === tripId
        ? {
            ...t,
            ...patch,
            travelerCount: patch.travelerCount != null ? clampTravelers(patch.travelerCount) : t.travelerCount,
            updatedAt: new Date().toISOString(),
          }
        : t,
    ),
  };
}

export function deleteTrip(s: TravelState, tripId: string): TravelState {
  return { ...s, trips: s.trips.filter((t) => t.id !== tripId) };
}

/** Adds a place to a trip day; a place appears at most once per trip. */
export function addTripItem(s: TravelState, tripId: string, ref: PlaceRef, day = 1): TravelState {
  return {
    ...s,
    trips: s.trips.map((t) => {
      if (t.id !== tripId || t.items.some((i) => i.placeId === ref.placeId)) return t;
      const position = t.items.filter((i) => i.day === day).length;
      return {
        ...t,
        items: [
          ...t.items,
          {
            ...ref,
            id: newId(),
            day,
            position,
            note: null,
            startTime: null,
            endTime: null,
            costCategory: null,
            estimatedCost: null,
            actualCost: null,
          },
        ],
      };
    }),
  };
}

export function removeTripItem(s: TravelState, tripId: string, itemId: string): TravelState {
  return {
    ...s,
    trips: s.trips.map((t) => (t.id === tripId ? { ...t, items: normalizePositions(t.items.filter((i) => i.id !== itemId)) } : t)),
  };
}

export function updateTripItem(s: TravelState, tripId: string, itemId: string, patch: Partial<TripItem>): TravelState {
  return {
    ...s,
    trips: s.trips.map((t) =>
      t.id === tripId
        ? { ...t, items: normalizePositions(t.items.map((i) => (i.id === itemId ? { ...i, ...patch, id: i.id } : i))) }
        : t,
    ),
  };
}

/** Move an item up (-1) or down (+1) within its day. */
export function moveTripItem(s: TravelState, tripId: string, itemId: string, delta: -1 | 1): TravelState {
  return {
    ...s,
    trips: s.trips.map((t) => {
      if (t.id !== tripId) return t;
      const item = t.items.find((i) => i.id === itemId);
      if (!item) return t;
      const sameDay = t.items.filter((i) => i.day === item.day).sort((a, b) => a.position - b.position);
      const idx = sameDay.findIndex((i) => i.id === itemId);
      const target = idx + delta;
      if (target < 0 || target >= sameDay.length) return t;
      [sameDay[idx], sameDay[target]] = [sameDay[target], sameDay[idx]];
      const pos = new Map(sameDay.map((i, n) => [i.id, n]));
      return { ...t, items: t.items.map((i) => (pos.has(i.id) ? { ...i, position: pos.get(i.id)! } : i)) };
    }),
  };
}

function normalizePositions(items: TripItem[]): TripItem[] {
  const byDay = new Map<number, TripItem[]>();
  for (const i of items) byDay.set(i.day, [...(byDay.get(i.day) ?? []), i]);
  const pos = new Map<string, number>();
  for (const list of byDay.values()) {
    list.sort((a, b) => a.position - b.position).forEach((i, n) => pos.set(i.id, n));
  }
  return items.map((i) => ({ ...i, position: pos.get(i.id) ?? 0 }));
}

export function addExpense(s: TravelState, tripId: string, e: Omit<TripExpense, "id"> & { id?: string }): TravelState {
  const expense: TripExpense = {
    id: e.id ?? newId(),
    day: e.day ?? null,
    category: e.category,
    label: e.label.trim().slice(0, 120) || "—",
    amount: Math.max(0, Number(e.amount) || 0),
    costType: e.costType,
  };
  return { ...s, trips: s.trips.map((t) => (t.id === tripId ? { ...t, expenses: [...t.expenses, expense] } : t)) };
}

export function removeExpense(s: TravelState, tripId: string, expenseId: string): TravelState {
  return {
    ...s,
    trips: s.trips.map((t) => (t.id === tripId ? { ...t, expenses: t.expenses.filter((e) => e.id !== expenseId) } : t)),
  };
}

/** Basic structural validation for data loaded from localStorage. */
export function isTravelState(v: unknown): v is TravelState {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.provinces === "object" &&
    o.provinces !== null &&
    typeof o.visits === "object" &&
    o.visits !== null &&
    typeof o.wishlist === "object" &&
    o.wishlist !== null &&
    Array.isArray(o.trips)
  );
}

/** Upgrade older saved shapes (missing trip fields) so the UI never crashes on old guest data. */
export function normalizeState(v: TravelState): TravelState {
  return {
    ...v,
    trips: v.trips
      .filter((t) => t && typeof t.id === "string")
      .map((t) => ({
        ...t,
        name: String(t.name ?? "Trip"),
        description: t.description ?? null,
        provinceSlug: t.provinceSlug ?? null,
        startDate: t.startDate ?? null,
        endDate: t.endDate ?? null,
        travelerCount: clampTravelers(t.travelerCount ?? 1),
        budget: t.budget ?? null,
        currency: t.currency ?? "THB",
        status: t.status ?? "planning",
        travelStyles: Array.isArray(t.travelStyles) ? t.travelStyles : [],
        transportMode: t.transportMode ?? null,
        notes: t.notes ?? null,
        createdAt: t.createdAt ?? new Date().toISOString(),
        items: (Array.isArray(t.items) ? t.items : []).map((i) => ({
          ...i,
          startTime: i.startTime ?? null,
          endTime: i.endTime ?? null,
          costCategory: i.costCategory ?? null,
          estimatedCost: i.estimatedCost ?? null,
          actualCost: i.actualCost ?? null,
        })),
        expenses: Array.isArray(t.expenses) ? t.expenses : [],
      })),
  };
}

export function isEmptyState(s: TravelState): boolean {
  return (
    !Object.keys(s.provinces).length && !Object.keys(s.visits).length && !Object.keys(s.wishlist).length && !s.trips.length
  );
}

export interface ImportPlan {
  provinces: Array<[string, ProvinceStatus]>;
  visits: PlaceVisit[];
  wishlist: WishlistItem[];
  trips: Trip[];
  counts: { provinces: number; visits: number; wishlist: number; trips: number; total: number };
}

/**
 * Which guest (local) records still need to go into the account. Anything the
 * account already has is skipped (the account wins), so importing twice, or
 * after a partial failure, never creates duplicates.
 */
export function planGuestImport(local: TravelState, cloud: TravelState): ImportPlan {
  const provinces = Object.entries(local.provinces)
    .filter(([slug]) => !cloud.provinces[slug])
    .map(([slug, v]) => [slug, v.status] as [string, ProvinceStatus]);
  const visits = Object.values(local.visits).filter((v) => !cloud.visits[v.placeId]);
  const wishlist = Object.values(local.wishlist).filter((w) => !cloud.wishlist[w.placeId] && !cloud.visits[w.placeId]);
  const cloudTripIds = new Set(cloud.trips.map((t) => t.id));
  const trips = local.trips.filter((t) => !cloudTripIds.has(t.id));
  return {
    provinces,
    visits,
    wishlist,
    trips,
    counts: {
      provinces: provinces.length,
      visits: visits.length,
      wishlist: wishlist.length,
      trips: trips.length,
      total: provinces.length + visits.length + wishlist.length + trips.length,
    },
  };
}

/** Apply an import plan on top of the account state (optimistic merge). */
export function applyImport(cloud: TravelState, plan: ImportPlan): TravelState {
  const now = new Date().toISOString();
  return {
    provinces: {
      ...cloud.provinces,
      ...Object.fromEntries(plan.provinces.map(([slug, status]) => [slug, { status, updatedAt: now }])),
    },
    visits: { ...cloud.visits, ...Object.fromEntries(plan.visits.map((v) => [v.placeId, v])) },
    wishlist: { ...cloud.wishlist, ...Object.fromEntries(plan.wishlist.map((w) => [w.placeId, w])) },
    trips: [...plan.trips, ...cloud.trips],
  };
}
