import "server-only";
import { getCatalogDates, getPlaces, getProvinces, getPlacesByProvince } from "./catalog";
import { isGoodMonthFor } from "./seasons";
import type { Place, Province } from "./types";

/**
 * Every list here states its basis (see messages top.*Basis). None of them is
 * a popularity, review or visitor statistic — we have no such data.
 */

const isSight = (p: Place) => p.kind === "attraction" || p.kind === "activity";

export function topProvincesByAttractions(n = 10): Array<{ province: Province; count: number }> {
  return getProvinces()
    .map((province) => ({ province, count: getPlacesByProvince(province.slug).filter(isSight).length }))
    .sort((a, b) => b.count - a.count || a.province.iso.localeCompare(b.province.iso))
    .slice(0, n);
}

export function topBySitelinks(
  n = 10,
  opts: { categories?: string[]; provinceSlug?: string; requireImage?: boolean } = {},
): Place[] {
  const pool = opts.provinceSlug ? getPlacesByProvince(opts.provinceSlug) : getPlaces();
  return pool
    .filter((p) => p.source.provider === "wikidata" && isSight(p))
    .filter((p) => !opts.categories || opts.categories.includes(p.category))
    .filter((p) => !opts.requireImage || p.image)
    .sort((a, b) => (b.wikiSitelinks ?? 0) - (a.wikiSitelinks ?? 0) || a.id.localeCompare(b.id))
    .slice(0, n);
}

export function freePlaces(n = 10): Place[] {
  return getPlaces()
    .filter((p) => p.fee === "free" && isSight(p))
    .sort((a, b) => Number(!!b.image) - Number(!!a.image) || a.id.localeCompare(b.id))
    .slice(0, n);
}

export function seasonalPicks(month: number, n = 10): Place[] {
  const regionOf = new Map(getProvinces().map((p) => [p.slug, p.region]));
  const picked: Place[] = [];
  const perProvince = new Map<string, number>();
  const pool = getPlaces()
    .filter((p) => p.source.provider === "wikidata" && p.image)
    .filter((p) => isGoodMonthFor(p.provinceSlug, regionOf.get(p.provinceSlug)!, p.category, month))
    .sort((a, b) => (b.wikiSitelinks ?? 0) - (a.wikiSitelinks ?? 0) || a.id.localeCompare(b.id));
  for (const p of pool) {
    const c = perProvince.get(p.provinceSlug) ?? 0;
    if (c >= 2) continue; // spread across provinces
    perProvince.set(p.provinceSlug, c + 1);
    picked.push(p);
    if (picked.length >= n) break;
  }
  return picked;
}

/** Best-documented OSM venues (most complete tags), at most one per province. */
export function sampleVenues(kinds: Place["kind"][], n = 8): Place[] {
  const seen = new Set<string>();
  return getPlaces()
    .filter((p) => kinds.includes(p.kind) && p.source.provider === "osm")
    .sort(
      (a, b) =>
        ((b as Place & { score?: number }).score ?? 0) - ((a as Place & { score?: number }).score ?? 0) ||
        a.id.localeCompare(b.id),
    )
    .filter((p) => (seen.has(p.provinceSlug) ? false : (seen.add(p.provinceSlug), true)))
    .slice(0, n);
}

export function rankingAsOf(): string | null {
  return getCatalogDates().wikidata;
}
