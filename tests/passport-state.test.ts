import { describe, expect, it } from "vitest";
import { getProvinces } from "@/lib/catalog";
import { computePassport, provinceMapStatus } from "@/lib/passport";
import * as S from "@/lib/travel-state";

const provinces = getProvinces().map((p) => ({ slug: p.slug, region: p.region }));
const ref = (placeId: string, provinceSlug = "chiang-mai", category = "temple"): S.PlaceRef => ({
  placeId,
  provinceSlug,
  category,
  nameTh: placeId,
  nameEn: placeId,
});

describe("passport metrics", () => {
  it("starts empty with 77 unvisited provinces", () => {
    const m = computePassport(S.emptyTravelState(), provinces);
    expect(m.visitedProvinces).toBe(0);
    expect(m.unvisitedProvinces).toBe(77);
    expect(m.progressPct).toBe(0);
  });

  it("progress = visited provinces / 77", () => {
    let s = S.emptyTravelState();
    s = S.setProvinceStatus(s, "chiang-mai", "visited");
    s = S.setProvinceStatus(s, "phuket", "visited");
    s = S.setProvinceStatus(s, "nan", "want");
    const m = computePassport(s, provinces);
    expect(m.visitedProvinces).toBe(2);
    expect(m.wantProvinces).toBe(1);
    expect(m.unvisitedProvinces).toBe(75);
    expect(m.progressPct).toBe(Math.round((2 / 77) * 1000) / 10);
    expect(m.byRegion.north.visited).toBe(1);
    expect(m.byRegion.north.total).toBe(9);
    expect(m.byRegion.south.visited).toBe(1);
  });

  it("keeps province status separate from place visits", () => {
    let s = S.emptyTravelState();
    s = S.addVisit(s, ref("wd-Q1", "krabi", "beach"), { visitedOn: "2026-01-05" });
    const m = computePassport(s, provinces);
    expect(m.visitedPlaces).toBe(1);
    expect(m.visitedProvinces).toBe(0); // visiting a place does not mark the province visited
    expect(m.partialProvinces).toBe(1);
    expect(provinceMapStatus(s, "krabi")).toBe("partial");
    s = S.setProvinceStatus(s, "krabi", "visited");
    expect(provinceMapStatus(s, "krabi")).toBe("visited");
    // marking a province visited does not create place visits
    s = S.setProvinceStatus(s, "trang", "visited");
    expect(Object.values(s.visits).filter((v) => v.provinceSlug === "trang")).toHaveLength(0);
  });

  it("updates after removing records and sorts the timeline newest first", () => {
    let s = S.emptyTravelState();
    s = S.addVisit(s, ref("a", "nan", "temple"), { visitedOn: "2025-02-01" });
    s = S.addVisit(s, ref("b", "nan", "waterfall"), { visitedOn: "2026-03-01" });
    let m = computePassport(s, provinces);
    expect(m.timeline.map((v) => v.placeId)).toEqual(["b", "a"]);
    expect(m.byCategory).toEqual([
      { category: "temple", count: 1 },
      { category: "waterfall", count: 1 },
    ]);
    s = S.removeVisit(s, "b");
    m = computePassport(s, provinces);
    expect(m.visitedPlaces).toBe(1);
  });

  it("ignores unknown province slugs", () => {
    const s = S.setProvinceStatus(S.emptyTravelState(), "atlantis", "visited");
    expect(computePassport(s, provinces).visitedProvinces).toBe(0);
  });
});

describe("wishlist", () => {
  it("does not duplicate and groups by province", () => {
    let s = S.emptyTravelState();
    s = S.addToWishlist(s, ref("x", "nan"));
    const again = S.addToWishlist(s, ref("x", "nan"));
    expect(again).toBe(s);
    s = S.addToWishlist(s, ref("y", "phuket"));
    const g = S.groupWishlistByProvince(s);
    expect(Object.keys(g).sort()).toEqual(["nan", "phuket"]);
  });

  it("moves a wishlist item to visited without duplicates", () => {
    let s = S.addToWishlist(S.emptyTravelState(), ref("x", "nan"));
    s = S.moveWishlistToVisited(s, "x", "2026-04-01");
    expect(s.wishlist.x).toBeUndefined();
    expect(s.visits.x.visitedOn).toBe("2026-04-01");
    expect(Object.keys(s.visits)).toHaveLength(1);
  });
});

describe("trips", () => {
  it("adds items once per trip and reorders within a day", () => {
    const created = S.createTrip(S.emptyTravelState(), { name: "Test" });
    const trip = created.trip;
    let s = created.state;
    s = S.addTripItem(s, trip.id, ref("a"), 1);
    s = S.addTripItem(s, trip.id, ref("b"), 1);
    s = S.addTripItem(s, trip.id, ref("a"), 2); // duplicate ignored
    let t = s.trips[0];
    expect(t.items.map((i) => i.placeId)).toEqual(["a", "b"]);
    const b = t.items.find((i) => i.placeId === "b")!;
    s = S.moveTripItem(s, trip.id, b.id, -1);
    t = s.trips[0];
    expect([...t.items].sort((x, y) => x.position - y.position).map((i) => i.placeId)).toEqual(["b", "a"]);
    s = S.updateTripItem(s, trip.id, b.id, { estimatedCost: 300 });
    expect(s.trips[0].items.find((i) => i.id === b.id)?.estimatedCost).toBe(300);
    s = S.removeTripItem(s, trip.id, b.id);
    expect(s.trips[0].items).toHaveLength(1);
    expect(s.trips[0].items[0].position).toBe(0);
  });

  it("validates stored state shape", () => {
    expect(S.isTravelState(S.emptyTravelState())).toBe(true);
    expect(S.isTravelState({ provinces: {}, visits: {} })).toBe(false);
    expect(S.isTravelState(null)).toBe(false);
  });
});
