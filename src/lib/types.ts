export type Locale = "th" | "en";

export type RegionId = "north" | "northeast" | "central" | "east" | "west" | "south";

export interface ImageInfo {
  file?: string;
  url: string;
  width?: number;
  height?: number;
  author: string;
  license: string;
  licenseUrl?: string | null;
  sourceUrl: string;
}

export interface Province {
  slug: string;
  iso: string;
  region: RegionId;
  wikidataId: string;
  nameTh: string;
  nameEn: string;
  /** [lat, lng] of the largest polygon */
  centroid: [number, number];
  /** [minLat, minLng, maxLat, maxLng] */
  bbox: [number, number, number, number];
  image: ImageInfo | null;
  summaryTh: string | null;
  summaryThUrl: string | null;
  summaryEn: string | null;
  summaryEnUrl: string | null;
  fetchedAt: string;
}

export type PlaceKind = "attraction" | "restaurant" | "cafe" | "accommodation" | "activity" | "transport";

export type DataProvider = "wikidata" | "osm" | "manual";

/** Data-quality label shown to users (spec §17). */
export type DataLabel = "provider" | "editor" | "community" | "verified" | "estimated" | "demo";

export interface PlaceSource {
  provider: DataProvider;
  externalId: string;
  url: string;
  license: string;
  attribution: string;
  fetchedAt: string;
}

export interface Place {
  id: string;
  slug: string;
  provinceSlug: string;
  kind: PlaceKind;
  category: string;
  nameTh: string | null;
  nameEn: string | null;
  descriptionTh: string | null;
  descriptionEn: string | null;
  lat: number;
  lng: number;
  image: ImageInfo | null;
  website: string | null;
  wikipediaTh?: string | null;
  wikipediaEn?: string | null;
  wikiSitelinks?: number;
  openingHours?: string | null;
  cuisine?: string[] | null;
  stars?: number | null;
  fee?: "free" | "paid" | null;
  /** OSM charge tag: structured only for unambiguous THB amounts */
  charge?: { min?: number; max?: number; currency?: string; raw: string } | null;
  address?: string | null;
  phone?: string | null;
  amenities?: string[];
  rooms?: number | null;
  brand?: string | null;
  /** official/authorised booking page — only when a source provides one */
  bookingUrl?: string | null;
  label?: DataLabel;
  source: PlaceSource;
}

/** Compact place shape sent to client components. */
export interface PlaceSummary {
  id: string;
  slug: string;
  provinceSlug: string;
  kind: PlaceKind;
  category: string;
  nameTh: string | null;
  nameEn: string | null;
  lat: number;
  lng: number;
  image: ImageInfo | null;
  fee?: "free" | "paid" | null;
  provider: DataProvider;
  priceType?: "exact" | "range" | "unavailable";
  priceMin?: number | null;
  amenities?: string[];
}

export interface ProvinceSummary {
  slug: string;
  iso: string;
  region: RegionId;
  nameTh: string;
  nameEn: string;
  centroid: [number, number];
  image: ImageInfo | null;
  placeCount: number;
}
