import "server-only";
import fs from "node:fs";
import path from "node:path";
import { haversineKm } from "./geo";
import type { Place, PlaceSummary, Province, ProvinceSummary } from "./types";

/**
 * Public travel catalog. Records come from committed sync output
 * (scripts/sync/*.mjs) so page views never call third-party APIs.
 * Admin-curated records from Supabase are merged in by `catalog-live.ts`.
 */

const DATA_DIR = path.join(process.cwd(), "src", "data", "generated");

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as T;
  } catch {
    return fallback;
  }
}

interface CatalogCache {
  provinces: Province[];
  provinceBySlug: Map<string, Province>;
  places: Place[];
  placeById: Map<string, Place>;
  placesByProvince: Map<string, Place[]>;
  fetchedAt: { provinces: string | null; wikidata: string | null; osm: string | null };
}

let base: { provinces: Province[]; places: Place[]; fetchedAt: CatalogCache["fetchedAt"] } | null = null;
let cache: CatalogCache | null = null;

/** Admin overrides from Supabase (manual places + hidden provider IDs). */
let live: { manual: Place[]; hidden: Set<string>; version: number } = { manual: [], hidden: new Set(), version: 0 };
let builtVersion = -1;

export function setLiveOverrides(manual: Place[], hidden: string[]) {
  live = { manual, hidden: new Set(hidden), version: live.version + 1 };
}

function loadBase() {
  if (base) return base;
  const prov = readJson<{ provinces: Province[]; fetchedAt?: string }>("provinces.json", { provinces: [] });
  const wd = readJson<{ places: Place[]; fetchedAt?: string }>("places-wikidata.json", { places: [] });
  const osm = readJson<{ places: Place[]; fetchedAt?: string }>("places-osm.json", { places: [] });
  // OSM POIs that reference a Wikidata item we already have are duplicates.
  const wdIds = new Set(wd.places.map((p) => p.source.externalId));
  const osmPlaces = osm.places.filter((p) => {
    const ref = (p as Place & { wikidataRef?: string | null }).wikidataRef;
    return !ref || !wdIds.has(ref);
  });
  base = {
    provinces: [...prov.provinces].sort((a, b) => a.iso.localeCompare(b.iso)),
    places: [...wd.places, ...osmPlaces].map((p) => ({ ...p, label: p.label ?? "provider" })),
    fetchedAt: { provinces: prov.fetchedAt ?? null, wikidata: wd.fetchedAt ?? null, osm: osm.fetchedAt ?? null },
  };
  return base;
}

function load(): CatalogCache {
  if (cache && builtVersion === live.version) return cache;
  const b = loadBase();
  const provinceBySlug = new Map(b.provinces.map((p) => [p.slug, p]));
  const places: Place[] = [...b.places.filter((p) => !live.hidden.has(p.id)), ...live.manual].filter((p) =>
    provinceBySlug.has(p.provinceSlug),
  );
  const placeById = new Map(places.map((p) => [p.id, p]));
  const placesByProvince = new Map<string, Place[]>();
  for (const p of places) {
    const list = placesByProvince.get(p.provinceSlug) ?? [];
    list.push(p);
    placesByProvince.set(p.provinceSlug, list);
  }
  cache = { provinces: b.provinces, provinceBySlug, places, placeById, placesByProvince, fetchedAt: b.fetchedAt };
  builtVersion = live.version;
  return cache;
}

/** Base catalog without admin overrides (used for admin data-quality views). */
export function getBasePlaces(): Place[] {
  return loadBase().places;
}

export function getProvinces(): Province[] {
  return load().provinces;
}

export function getProvince(slug: string): Province | undefined {
  return load().provinceBySlug.get(slug);
}

export function getPlaces(): Place[] {
  return load().places;
}

export function getPlacesByProvince(slug: string): Place[] {
  return load().placesByProvince.get(slug) ?? [];
}

export function getPlaceById(id: string): Place | undefined {
  return load().placeById.get(id);
}

export function getPlaceBySlug(provinceSlug: string, slug: string): Place | undefined {
  return getPlacesByProvince(provinceSlug).find((p) => p.slug === slug);
}

export function getCatalogDates() {
  return load().fetchedAt;
}

export function toPlaceSummary(p: Place): PlaceSummary {
  return {
    id: p.id,
    slug: p.slug,
    provinceSlug: p.provinceSlug,
    kind: p.kind,
    category: p.category,
    nameTh: p.nameTh,
    nameEn: p.nameEn,
    lat: p.lat,
    lng: p.lng,
    image: p.image,
    fee: p.fee ?? null,
    provider: p.source.provider,
  };
}

export function getProvinceSummaries(): ProvinceSummary[] {
  return getProvinces().map((p) => ({
    slug: p.slug,
    iso: p.iso,
    region: p.region,
    nameTh: p.nameTh,
    nameEn: p.nameEn,
    centroid: p.centroid,
    image: p.image,
    placeCount: getPlacesByProvince(p.slug).length,
  }));
}

/** Nearby places by straight-line distance. */
export function getNearbyPlaces(place: Place, limit = 6): Array<Place & { distanceKm: number }> {
  return getPlaces()
    .filter((p) => p.id !== place.id)
    .map((p) => ({ ...p, distanceKm: haversineKm([place.lat, place.lng], [p.lat, p.lng]) }))
    .filter((p) => p.distanceKm <= 40)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
