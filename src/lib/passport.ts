import type { RegionId } from "./types";
import type { TravelState, PlaceVisit } from "./travel-state";

export const TOTAL_PROVINCES = 77;

export type MapStatus = "visited" | "partial" | "want" | "none";

/**
 * Province colour on the map:
 * - visited: user marked the province visited
 * - partial: not marked visited, but the user has visited ≥1 place there
 * - want: user marked "want to visit"
 * - none: no records
 */
export function provinceMapStatus(state: TravelState, slug: string): MapStatus {
  const p = state.provinces[slug];
  if (p?.status === "visited") return "visited";
  if (Object.values(state.visits).some((v) => v.provinceSlug === slug)) return "partial";
  if (p?.status === "want") return "want";
  return "none";
}

export function provinceStatusMap(state: TravelState, slugs: string[]): Record<string, MapStatus> {
  const withVisits = new Set(Object.values(state.visits).map((v) => v.provinceSlug));
  const out: Record<string, MapStatus> = {};
  for (const slug of slugs) {
    const p = state.provinces[slug];
    out[slug] =
      p?.status === "visited" ? "visited" : withVisits.has(slug) ? "partial" : p?.status === "want" ? "want" : "none";
  }
  return out;
}

export interface PassportMetrics {
  visitedProvinces: number;
  wantProvinces: number;
  partialProvinces: number;
  unvisitedProvinces: number;
  /** visited provinces / 77, as a percentage with one decimal */
  progressPct: number;
  visitedPlaces: number;
  wishlistCount: number;
  tripCount: number;
  byRegion: Record<RegionId, { visited: number; total: number }>;
  byCategory: Array<{ category: string; count: number }>;
  timeline: PlaceVisit[];
}

export function computePassport(
  state: TravelState,
  provinces: Array<{ slug: string; region: RegionId }>,
): PassportMetrics {
  const known = new Set(provinces.map((p) => p.slug));
  const visitedSet = new Set(
    Object.entries(state.provinces)
      .filter(([slug, v]) => v.status === "visited" && known.has(slug))
      .map(([slug]) => slug),
  );
  const wantProvinces = Object.entries(state.provinces).filter(
    ([slug, v]) => v.status === "want" && known.has(slug),
  ).length;
  const placeProvinces = new Set(Object.values(state.visits).map((v) => v.provinceSlug));
  const partialProvinces = [...placeProvinces].filter((s) => known.has(s) && !visitedSet.has(s)).length;

  const byRegion = {} as PassportMetrics["byRegion"];
  for (const p of provinces) {
    byRegion[p.region] ??= { visited: 0, total: 0 };
    byRegion[p.region].total++;
    if (visitedSet.has(p.slug)) byRegion[p.region].visited++;
  }

  const catCounts = new Map<string, number>();
  for (const v of Object.values(state.visits)) catCounts.set(v.category, (catCounts.get(v.category) ?? 0) + 1);

  const total = provinces.length || TOTAL_PROVINCES;
  return {
    visitedProvinces: visitedSet.size,
    wantProvinces,
    partialProvinces,
    unvisitedProvinces: total - visitedSet.size,
    progressPct: Math.round((visitedSet.size / total) * 1000) / 10,
    visitedPlaces: Object.keys(state.visits).length,
    wishlistCount: Object.keys(state.wishlist).length,
    tripCount: state.trips.length,
    byRegion,
    byCategory: [...catCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
    timeline: Object.values(state.visits).sort(
      (a, b) => b.visitedOn.localeCompare(a.visitedOn) || a.placeId.localeCompare(b.placeId),
    ),
  };
}
