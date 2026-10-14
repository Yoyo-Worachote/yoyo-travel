/** Live place-data provider (ratings, price ranges, links) — adapters are swappable. */
export interface LivePlaceInfo {
  provider: string;
  attribution: string;
  rating: number | null;
  reviewCount: number | null;
  priceRange: { min: number | null; max: number | null; currency: string } | null;
  /** provider's coarse level, e.g. 1–4, when no range is available */
  priceLevel: number | null;
  mapsUrl: string | null;
  websiteUrl: string | null;
  fetchedAt: string;
}

export interface LivePlaceProvider {
  name: string;
  lookup(place: { nameTh: string | null; nameEn: string | null; lat: number; lng: number }): Promise<LivePlaceInfo | null>;
}
