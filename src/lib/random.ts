import {
  COMPANION_CATEGORIES,
  INTEREST_CATEGORIES,
  type Companion,
  type Interest,
} from "./categories";
import { BANGKOK, haversineKm, orderByNearest } from "./geo";
import type { PlaceKind, RegionId } from "./types";

/** Seedable RNG (mulberry32) so tests are deterministic. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Duration = "day" | "weekend" | "long" | "any";
export type Budget = "low" | "mid" | "high" | "any";
export type VisitedMode = "any" | "exclude" | "prioritize_unvisited";

/** Straight-line distance limits from Bangkok used as an approximate proxy. */
export const DURATION_MAX_KM: Record<Duration, number> = { day: 200, weekend: 500, long: Infinity, any: Infinity };
export const BUDGET_MAX_KM: Record<Budget, number> = { low: 250, mid: 600, high: Infinity, any: Infinity };

export interface RandomPlace {
  id: string;
  provinceSlug: string;
  kind: PlaceKind;
  category: string;
  lat: number;
  lng: number;
  fee?: "free" | "paid" | null;
  openingHours?: string | null;
}

export interface RandomProvince {
  slug: string;
  region: RegionId;
  centroid: [number, number];
}

export type Reason =
  | { code: "region"; region: RegionId }
  | { code: "interest"; interest: Interest; count: number }
  | { code: "companion"; companion: Companion; count: number }
  | { code: "distance"; km: number }
  | { code: "unvisited" }
  | { code: "wishlist" }
  | { code: "free" }
  | { code: "category"; category: string };

export interface ProvinceFilters {
  regions?: RegionId[];
  duration?: Duration;
  budget?: Budget;
  companion?: Companion | null;
  interests?: Interest[];
  visitedMode?: VisitedMode;
  visited?: string[];
  wishlistProvinces?: string[];
  preferWishlist?: boolean;
}

function pickWeighted<T>(items: Array<{ item: T; weight: number }>, rng: () => number): T | null {
  const total = items.reduce((s, i) => s + i.weight, 0);
  if (!items.length || total <= 0) return null;
  let r = rng() * total;
  for (const i of items) {
    r -= i.weight;
    if (r <= 0) return i.item;
  }
  return items[items.length - 1].item;
}

function countMatching(places: RandomPlace[], categories: string[]) {
  return places.filter((p) => categories.includes(p.category)).length;
}

export function randomProvince(
  provinces: RandomProvince[],
  placesByProvince: Map<string, RandomPlace[]>,
  f: ProvinceFilters,
  rng: () => number = Math.random,
): { slug: string; reasons: Reason[]; candidates: number } | null {
  const visited = new Set(f.visited ?? []);
  const wish = new Set(f.wishlistProvinces ?? []);
  const maxKm = Math.min(DURATION_MAX_KM[f.duration ?? "any"], BUDGET_MAX_KM[f.budget ?? "any"]);

  const scored: Array<{ item: { slug: string; reasons: Reason[] }; weight: number }> = [];
  for (const p of provinces) {
    if (f.regions?.length && !f.regions.includes(p.region)) continue;
    if (f.visitedMode === "exclude" && visited.has(p.slug)) continue;
    const km = Math.round(haversineKm(BANGKOK, p.centroid));
    if (km > maxKm) continue;

    const places = placesByProvince.get(p.slug) ?? [];
    const reasons: Reason[] = [];
    let weight = 1;

    if (f.interests?.length) {
      let matched = 0;
      for (const interest of f.interests) {
        const count = countMatching(places, INTEREST_CATEGORIES[interest]);
        if (count > 0) {
          matched++;
          reasons.push({ code: "interest", interest, count });
          weight += Math.min(count, 10);
        }
      }
      if (matched === 0) continue; // must have real records for at least one interest
    }
    if (f.companion) {
      const count = countMatching(places, COMPANION_CATEGORIES[f.companion]);
      if (count > 0) {
        reasons.push({ code: "companion", companion: f.companion, count });
        weight += Math.min(count, 5) / 2;
      }
    }
    if (f.regions?.length) reasons.push({ code: "region", region: p.region });
    if (maxKm !== Infinity) reasons.push({ code: "distance", km });
    if (!visited.has(p.slug)) {
      if (f.visitedMode === "prioritize_unvisited") weight *= 4;
      if (f.visitedMode && f.visitedMode !== "any") reasons.push({ code: "unvisited" });
    }
    if (f.preferWishlist && wish.has(p.slug)) {
      weight *= 3;
      reasons.push({ code: "wishlist" });
    }
    scored.push({ item: { slug: p.slug, reasons }, weight });
  }
  const pick = pickWeighted(scored, rng);
  return pick ? { ...pick, candidates: scored.length } : null;
}

export interface PlaceFilters {
  provinceSlug?: string | null;
  regionSlugs?: string[]; // limit to provinces (e.g. in a region)
  interests?: Interest[];
  kinds?: PlaceKind[];
  companion?: Companion | null;
  freeOnly?: boolean;
  excludePlaceIds?: string[];
}

export function filterPlaces(places: RandomPlace[], f: PlaceFilters): RandomPlace[] {
  const exclude = new Set(f.excludePlaceIds ?? []);
  const interestCats = f.interests?.length ? new Set(f.interests.flatMap((i) => INTEREST_CATEGORIES[i])) : null;
  return places.filter(
    (p) =>
      (!f.provinceSlug || p.provinceSlug === f.provinceSlug) &&
      (!f.regionSlugs?.length || f.regionSlugs.includes(p.provinceSlug)) &&
      (!f.kinds?.length || f.kinds.includes(p.kind)) &&
      (!interestCats || interestCats.has(p.category)) &&
      (!f.freeOnly || p.fee === "free") &&
      !exclude.has(p.id),
  );
}

export function randomPlace(
  places: RandomPlace[],
  f: PlaceFilters,
  rng: () => number = Math.random,
): { id: string; reasons: Reason[]; candidates: number } | null {
  const matches = filterPlaces(places, f);
  const companionCats = f.companion ? COMPANION_CATEGORIES[f.companion] : null;
  const pick = pickWeighted(
    matches.map((p) => ({ item: p, weight: companionCats?.includes(p.category) ? 3 : 1 })),
    rng,
  );
  if (!pick) return null;
  const reasons: Reason[] = [{ code: "category", category: pick.category }];
  for (const i of f.interests ?? []) {
    if (INTEREST_CATEGORIES[i].includes(pick.category)) reasons.push({ code: "interest", interest: i, count: 1 });
  }
  if (f.companion && companionCats?.includes(pick.category))
    reasons.push({ code: "companion", companion: f.companion, count: 1 });
  if (pick.fee === "free") reasons.push({ code: "free" });
  if (f.excludePlaceIds?.length) reasons.push({ code: "unvisited" });
  return { id: pick.id, reasons, candidates: matches.length };
}

export interface TripStop {
  placeId: string;
  role: "sight" | "food" | "activity";
  kmFromPrevious: number | null;
  openingHours: string | null;
}

export interface TripPlan {
  provinceSlug: string;
  days: Array<{ day: number; stops: TripStop[] }>;
  warnings: Array<"few_places" | "no_food_data" | "opening_hours_unknown" | "straight_line_distance">;
}

const FOOD_CATS = ["restaurant", "cafe", "market"];

/**
 * Build a 1–3 day outline from real records: each day starts at a random
 * sight, adds the nearest unused sights (≤ 35 km), then the nearest food stop.
 * Distances are straight-line, so the order is approximate.
 */
export function randomTrip(
  places: RandomPlace[],
  opts: { provinceSlug: string; days: number; interests?: Interest[]; companion?: Companion | null; excludePlaceIds?: string[] },
  rng: () => number = Math.random,
): TripPlan | null {
  const days = Math.max(1, Math.min(3, Math.round(opts.days)));
  const exclude = new Set(opts.excludePlaceIds ?? []);
  const inProvince = places.filter((p) => p.provinceSlug === opts.provinceSlug && !exclude.has(p.id));
  const sightPool = inProvince.filter((p) => p.kind === "attraction" || p.kind === "activity");
  const interestCats = opts.interests?.length ? new Set(opts.interests.flatMap((i) => INTEREST_CATEGORIES[i])) : null;
  const preferred = interestCats ? sightPool.filter((p) => interestCats.has(p.category)) : sightPool;
  const sights = preferred.length >= days ? preferred : sightPool;
  const food = inProvince.filter((p) => FOOD_CATS.includes(p.category) && p.kind !== "attraction");
  const foodAll = food.length ? food : inProvince.filter((p) => FOOD_CATS.includes(p.category));
  if (!sights.length) return null;

  const used = new Set<string>();
  const warnings: TripPlan["warnings"] = ["straight_line_distance"];
  const outDays: TripPlan["days"] = [];
  const perDay = 3;

  for (let d = 1; d <= days; d++) {
    const free = sights.filter((s) => !used.has(s.id));
    if (!free.length) break;
    const seed = free[Math.floor(rng() * free.length)];
    used.add(seed.id);
    const daySights = [seed];
    const near = free
      .filter((s) => s.id !== seed.id)
      .map((s) => ({ s, km: haversineKm([seed.lat, seed.lng], [s.lat, s.lng]) }))
      .filter((x) => x.km <= 35)
      .sort((a, b) => a.km - b.km);
    for (const { s } of near) {
      if (daySights.length >= perDay) break;
      daySights.push(s);
      used.add(s.id);
    }
    const ordered = orderByNearest(daySights);
    const last = ordered[ordered.length - 1];
    const meal = foodAll
      .filter((f) => !used.has(f.id))
      .map((f) => ({ f, km: haversineKm([last.lat, last.lng], [f.lat, f.lng]) }))
      .filter((x) => x.km <= 25)
      .sort((a, b) => a.km - b.km)[0]?.f;
    const seq: RandomPlace[] = meal ? [...ordered, meal] : ordered;
    if (meal) used.add(meal.id);
    outDays.push({
      day: d,
      stops: seq.map((p, i) => ({
        placeId: p.id,
        role: FOOD_CATS.includes(p.category) && p.kind !== "attraction" ? "food" : p.kind === "activity" ? "activity" : "sight",
        kmFromPrevious: i === 0 ? null : Math.round(haversineKm([seq[i - 1].lat, seq[i - 1].lng], [p.lat, p.lng]) * 10) / 10,
        openingHours: p.openingHours ?? null,
      })),
    });
  }
  if (outDays.length < days || outDays.some((d) => d.stops.length < 2)) warnings.push("few_places");
  if (!outDays.some((d) => d.stops.some((s) => s.role === "food"))) warnings.push("no_food_data");
  if (outDays.some((d) => d.stops.some((s) => !s.openingHours))) warnings.push("opening_hours_unknown");
  return { provinceSlug: opts.provinceSlug, days: outDays, warnings };
}
