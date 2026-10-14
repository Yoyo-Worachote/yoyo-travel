import { describe, expect, it } from "vitest";
import { computeBudget, defaultCostCategory, type ProviderPrice } from "@/lib/budget";
import { priceInfo, providerPriceFor } from "@/lib/pricing";
import * as S from "@/lib/travel-state";
import type { Place } from "@/lib/types";

const ref = (placeId: string, category = "temple", provinceSlug = "nan"): S.PlaceRef => ({
  placeId,
  provinceSlug,
  category,
  nameTh: placeId,
  nameEn: placeId,
});

function tripWith(items: Array<[string, string, Partial<S.TripItem>?]>, extra: Partial<S.Trip> = {}) {
  let { state, trip } = S.createTrip(S.emptyTravelState(), { name: "T", travelerCount: 2, budget: 5000, ...extra });
  for (const [id, cat] of items) state = S.addTripItem(state, trip.id, ref(id, cat));
  for (const [id, , patch] of items) {
    const item = state.trips[0].items.find((i) => i.placeId === id)!;
    if (patch) state = S.updateTripItem(state, trip.id, item.id, patch);
  }
  trip = state.trips[0];
  return { state, trip };
}

describe("budget calculator", () => {
  it("never counts unpriced items as 0 and flags the total as incomplete", () => {
    const { trip } = tripWith([
      ["a", "temple"],
      ["b", "restaurant", { estimatedCost: 600 }],
    ]);
    const b = computeBudget(trip);
    expect(b.plannedMax).toBe(600);
    expect(b.unpricedCount).toBe(1);
    expect(b.complete).toBe(false);
    expect(b.byCategory.activity.unpriced).toBe(1);
    expect(b.byCategory.food.estimatedMax).toBe(600);
  });

  it("keeps actual spend separate from estimates and computes per person / remaining", () => {
    const { state, trip } = tripWith([
      ["a", "hotel", { actualCost: 1800 }],
      ["b", "restaurant", { estimatedCost: 400 }],
    ]);
    const s2 = S.addExpense(state, trip.id, { category: "transport", label: "Fuel", amount: 1000, costType: "estimated", day: null });
    const b = computeBudget(s2.trips[0]);
    expect(b.actualTotal).toBe(1800);
    expect(b.byCategory.accommodation.actual).toBe(1800);
    expect(b.byCategory.accommodation.estimatedMax).toBe(0);
    expect(b.plannedMax).toBe(3200);
    expect(b.perPersonMax).toBe(1600);
    expect(b.remaining).toBe(1800);
    expect(b.complete).toBe(true);
  });

  it("uses sourced provider prices (× travellers for per-person admission) with their source", () => {
    const { trip } = tripWith([["a", "museum"]]);
    const price: ProviderPrice = {
      min: 50,
      max: 100,
      currency: "THB",
      perPerson: true,
      provenance: "provider_data",
      source: "OpenStreetMap",
      sourceUrl: "https://www.openstreetmap.org/node/1",
      observedAt: "2026-10-14",
    };
    const b = computeBudget(trip, (id) => (id === "a" ? price : null));
    expect(b.items[0].source).toBe("provider");
    expect([b.plannedMin, b.plannedMax]).toEqual([100, 200]);
  });

  it("ignores provider prices in another currency (no silent conversion)", () => {
    const { trip } = tripWith([["a", "museum"]]);
    const b = computeBudget(trip, () => ({ min: 5, max: 5, currency: "USD", perPerson: false, provenance: "provider_data", source: "x", sourceUrl: null, observedAt: null }));
    expect(b.unpricedCount).toBe(1);
  });

  it("maps place categories to cost buckets", () => {
    expect(defaultCostCategory("restaurant")).toBe("food");
    expect(defaultCostCategory("resort")).toBe("accommodation");
    expect(defaultCostCategory("transport")).toBe("transport");
    expect(defaultCostCategory("waterfall")).toBe("activity");
  });
});

const basePlace: Place = {
  id: "osm-node-1",
  slug: "x",
  provinceSlug: "nan",
  kind: "attraction",
  category: "museum",
  nameTh: null,
  nameEn: "X",
  descriptionTh: null,
  descriptionEn: null,
  lat: 18,
  lng: 100,
  image: null,
  website: null,
  source: { provider: "osm", externalId: "node/1", url: "https://www.openstreetmap.org/node/1", license: "ODbL 1.0", attribution: "OSM", fetchedAt: "2026-10-14T00:00:00Z" },
};

describe("price model", () => {
  it("exact / range / free / unavailable only from sourced data", () => {
    expect(priceInfo({ ...basePlace, charge: { min: 40, max: 40, currency: "THB", raw: "40 THB" } })).toMatchObject({ type: "exact", min: 40, unit: "admission", source: "OpenStreetMap" });
    expect(priceInfo({ ...basePlace, charge: { min: 50, max: 100, currency: "THB", raw: "50-100 THB" } }).type).toBe("range");
    expect(priceInfo({ ...basePlace, fee: "free" })).toMatchObject({ type: "exact", free: true, min: 0 });
    expect(priceInfo({ ...basePlace, fee: "paid" })).toMatchObject({ type: "unavailable", paidUnknownAmount: true });
    expect(priceInfo({ ...basePlace, charge: { raw: "free for Thai" } })).toMatchObject({ type: "unavailable", raw: "free for Thai" });
    expect(priceInfo(basePlace).type).toBe("unavailable");
    expect(providerPriceFor(basePlace)).toBeNull();
  });

  it("never produces an estimated price from place data", () => {
    for (const p of [basePlace, { ...basePlace, kind: "restaurant" as const }, { ...basePlace, kind: "accommodation" as const }]) {
      expect(priceInfo(p).type).not.toBe("estimated");
    }
  });
});

describe("guest data import", () => {
  it("plans only records the account does not have, and is idempotent", () => {
    let local = S.emptyTravelState();
    local = S.setProvinceStatus(local, "nan", "visited");
    local = S.addVisit(local, ref("v1"));
    local = S.addToWishlist(local, ref("w1"));
    local = S.addToWishlist(local, ref("v-cloud"));
    const created = S.createTrip(local, { name: "Guest trip" });
    local = S.addTripItem(created.state, created.trip.id, ref("v1"));

    let cloud = S.emptyTravelState();
    cloud = S.setProvinceStatus(cloud, "nan", "want"); // account wins
    cloud = S.addVisit(cloud, ref("v-cloud"));

    const plan = S.planGuestImport(local, cloud);
    expect(plan.counts).toEqual({ provinces: 0, visits: 1, wishlist: 1, trips: 1, total: 3 });
    expect(plan.wishlist.map((w) => w.placeId)).toEqual(["w1"]); // already visited in account → skipped

    const merged = S.applyImport(cloud, plan);
    expect(merged.provinces.nan.status).toBe("want");
    expect(Object.keys(merged.visits).sort()).toEqual(["v-cloud", "v1"]);
    expect(merged.trips).toHaveLength(1);

    // importing again after success adds nothing
    expect(S.planGuestImport(local, merged).counts.total).toBe(0);
  });

  it("upgrades old saved guest data without losing trips", () => {
    const old = {
      provinces: {},
      visits: {},
      wishlist: {},
      trips: [{ id: "t1", name: "Old", provinceSlug: null, startDate: null, endDate: null, budget: 100, notes: null, createdAt: "2026-01-01", items: [{ id: "i1", placeId: "p", provinceSlug: "nan", category: "temple", nameTh: null, nameEn: "P", day: 1, position: 0, estimatedCost: 50 }] }],
    } as unknown as S.TravelState;
    const n = S.normalizeState(old);
    expect(n.trips[0]).toMatchObject({ travelerCount: 1, currency: "THB", status: "planning", travelStyles: [], expenses: [] });
    expect(n.trips[0].items[0]).toMatchObject({ estimatedCost: 50, actualCost: null, startTime: null });
    expect(computeBudget(n.trips[0]).plannedMax).toBe(50);
  });

  it("validates trip fields", () => {
    const { state } = S.createTrip(S.emptyTravelState(), { name: "  ", travelerCount: 999 });
    expect(state.trips[0].name).toBe("Trip");
    expect(state.trips[0].travelerCount).toBe(50);
    const s2 = S.updateTrip(state, state.trips[0].id, { travelerCount: 0 });
    expect(s2.trips[0].travelerCount).toBe(1);
  });
});
