import { describe, expect, it, vi } from "vitest";
import { googlePlacesProvider, getLivePlaceProvider } from "@/lib/providers/google-places";
import { addressOf, amenitiesOf, classify, parseCharge, pickPerCategory, PICK } from "../scripts/sync/osm.mjs";

describe("Google Places adapter", () => {
  const place = { nameTh: "วัด", nameEn: "Wat Test", lat: 18.79, lng: 98.99 };
  const reply = (places: unknown[]) => vi.fn().mockResolvedValue(new Response(JSON.stringify({ places }), { status: 200 }));

  it("is disabled without a key", () => {
    expect(getLivePlaceProvider({})).toBeNull();
    expect(getLivePlaceProvider({ GOOGLE_PLACES_API_KEY: "k" })?.name).toBe("google");
  });

  it("returns rating/price only for a match within 300 m, sends the key in a header", async () => {
    const fetchImpl = reply([
      { location: { latitude: 18.9, longitude: 98.99 }, rating: 4.9 }, // ~12 km away → ignored
      {
        location: { latitude: 18.7905, longitude: 98.9903 },
        rating: 4.5,
        userRatingCount: 1234,
        priceRange: { startPrice: { currencyCode: "THB", units: "100" }, endPrice: { currencyCode: "THB", units: "300" } },
        googleMapsUri: "https://maps.google.com/?cid=1",
      },
    ]);
    const info = await googlePlacesProvider("secret", fetchImpl as unknown as typeof fetch).lookup(place);
    expect(info).toMatchObject({ rating: 4.5, reviewCount: 1234, priceRange: { min: 100, max: 300, currency: "THB" }, provider: "Google" });
    const init = fetchImpl.mock.calls[0][1];
    expect(init.headers["X-Goog-Api-Key"]).toBe("secret");
    expect(init.cache).toBe("no-store");
  });

  it("returns null (not a guess) when nothing is close enough", async () => {
    const info = await googlePlacesProvider("k", reply([{ location: { latitude: 19.5, longitude: 99 } }]) as unknown as typeof fetch).lookup(place);
    expect(info).toBeNull();
  });

  it("throws on provider errors so the API can report them", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 403 }));
    await expect(googlePlacesProvider("k", f as unknown as typeof fetch).lookup(place)).rejects.toThrow(/403/);
  });
});

describe("OSM sync helpers", () => {
  it("parses only unambiguous THB charges", () => {
    expect(parseCharge("40 THB")).toMatchObject({ min: 40, max: 40, currency: "THB" });
    expect(parseCharge("THB 50-100")).toMatchObject({ min: 50, max: 100 });
    expect(parseCharge("100 บาท")).toMatchObject({ min: 100, max: 100 });
    expect(parseCharge("20 USD")).toEqual({ raw: "20 USD" });
    expect(parseCharge("free for Thai")).toEqual({ raw: "free for Thai" });
    expect(parseCharge(undefined)).toBeNull();
  });

  it("classifies categories including resorts and transport", () => {
    expect(classify({ leisure: "resort" })).toEqual({ kind: "accommodation", category: "resort" });
    expect(classify({ tourism: "hotel", name: "Sea Breeze Resort" })?.category).toBe("resort");
    expect(classify({ tourism: "guest_house" })?.category).toBe("guest_house");
    expect(classify({ amenity: "bus_station" })).toEqual({ kind: "transport", category: "transport" });
    expect(classify({ amenity: "marketplace" })?.category).toBe("market");
    expect(classify({ shop: "bakery" })).toBeNull();
  });

  it("keeps only tagged amenities and builds addresses", () => {
    expect(amenitiesOf({ internet_access: "wlan", wheelchair: "limited", "diet:vegetarian": "yes" })).toEqual(["wifi", "vegetarian"]);
    expect(addressOf({ "addr:housenumber": "12", "addr:street": "Tha Phae Rd", "addr:city": "Chiang Mai" })).toBe("12 Tha Phae Rd, Chiang Mai");
    expect(addressOf({})).toBeNull();
  });

  it("caps per category and drops same-name duplicates", () => {
    const recs = Array.from({ length: 40 }, (_, i) => ({ id: `osm-node-${i}`, category: "restaurant", nameEn: i >= 38 ? "Same" : `R${i}`, score: i }));
    const picked = pickPerCategory(recs);
    expect(picked).toHaveLength(PICK.restaurant);
    expect(picked.filter((p: { nameEn: string }) => p.nameEn === "Same")).toHaveLength(1);
  });
});
