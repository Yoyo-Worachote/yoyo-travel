import "server-only";
import { haversineKm } from "../geo";
import type { LivePlaceInfo, LivePlaceProvider } from "./types";

/**
 * Google Places API (New) adapter — server-side only, OFF unless
 * GOOGLE_PLACES_API_KEY is set. Paid per request; Google's terms do not allow
 * caching place content, so results are fetched on demand (no-store) and shown
 * with Google attribution. A match is accepted only within 300 m of our record.
 */
const LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

interface GooglePlace {
  displayName?: { text?: string };
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  priceRange?: {
    startPrice?: { currencyCode?: string; units?: string };
    endPrice?: { currencyCode?: string; units?: string };
  };
  googleMapsUri?: string;
  websiteUri?: string;
}

export function googlePlacesProvider(apiKey: string, fetchImpl: typeof fetch = fetch): LivePlaceProvider {
  return {
    name: "google",
    async lookup(place) {
      const query = place.nameEn || place.nameTh;
      if (!query) return null;
      const res = await fetchImpl("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.displayName,places.location,places.rating,places.userRatingCount,places.priceLevel,places.priceRange,places.googleMapsUri,places.websiteUri",
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 3,
          locationBias: { circle: { center: { latitude: place.lat, longitude: place.lng }, radius: 300 } },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`google places ${res.status}`);
      const json = (await res.json()) as { places?: GooglePlace[] };
      const match = (json.places ?? []).find(
        (p) => p.location && haversineKm([place.lat, place.lng], [p.location.latitude, p.location.longitude]) <= 0.3,
      );
      if (!match) return null;
      const start = match.priceRange?.startPrice;
      const end = match.priceRange?.endPrice;
      const info: LivePlaceInfo = {
        provider: "Google",
        attribution: "Google Maps",
        rating: typeof match.rating === "number" ? match.rating : null,
        reviewCount: typeof match.userRatingCount === "number" ? match.userRatingCount : null,
        priceRange:
          start || end
            ? {
                min: start?.units ? Number(start.units) : null,
                max: end?.units ? Number(end.units) : null,
                currency: start?.currencyCode ?? end?.currencyCode ?? "THB",
              }
            : null,
        priceLevel: match.priceLevel != null ? (LEVELS[match.priceLevel] ?? null) : null,
        mapsUrl: match.googleMapsUri ?? null,
        websiteUrl: match.websiteUri ?? null,
        fetchedAt: new Date().toISOString(),
      };
      return info;
    },
  };
}

export function getLivePlaceProvider(env: Record<string, string | undefined> = process.env): LivePlaceProvider | null {
  return env.GOOGLE_PLACES_API_KEY ? googlePlacesProvider(env.GOOGLE_PLACES_API_KEY) : null;
}
