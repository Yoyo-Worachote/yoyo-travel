/**
 * Personal travel records (passport, wishlist, trips) as a plain serialisable
 * state plus pure update functions. The same shape is used by the local demo
 * store (localStorage) and the Supabase store, so UI and tests share one model.
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

export interface TripItem extends PlaceRef {
  id: string;
  day: number; // 1-based
  position: number;
  note?: string | null;
  /** user-entered cost; always shown as "your estimate" */
  estimatedCost?: number | null;
}

export interface Trip {
  id: string;
  name: string;
  provinceSlug: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  notes: string | null;
  createdAt: string;
  items: TripItem[];
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

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function createTrip(
  s: TravelState,
  input: Pick<Trip, "name"> & Partial<Omit<Trip, "id" | "items" | "createdAt">>,
): { state: TravelState; trip: Trip } {
  const trip: Trip = {
    id: newId(),
    name: input.name.trim().slice(0, 120) || "Trip",
    provinceSlug: input.provinceSlug ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    budget: input.budget ?? null,
    notes: input.notes ?? null,
    createdAt: new Date().toISOString(),
    items: [],
  };
  return { state: { ...s, trips: [trip, ...s.trips] }, trip };
}

export function updateTrip(s: TravelState, tripId: string, patch: Partial<Omit<Trip, "id" | "items">>): TravelState {
  return { ...s, trips: s.trips.map((t) => (t.id === tripId ? { ...t, ...patch } : t)) };
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
      return { ...t, items: [...t.items, { ...ref, id: newId(), day, position, note: null, estimatedCost: null }] };
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

export function tripCostSummary(trip: Trip) {
  const known = trip.items.reduce((sum, i) => sum + (i.estimatedCost ?? 0), 0);
  const itemsWithCost = trip.items.filter((i) => i.estimatedCost != null).length;
  return {
    userEstimatedTotal: known,
    itemsWithCost,
    itemsWithoutCost: trip.items.length - itemsWithCost,
    budget: trip.budget,
    remaining: trip.budget != null ? trip.budget - known : null,
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
