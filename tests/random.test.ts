import { describe, expect, it } from "vitest";
import { getPlaces, getProvinces } from "@/lib/catalog";
import { INTEREST_CATEGORIES } from "@/lib/categories";
import { BANGKOK, haversineKm } from "@/lib/geo";
import { filterPlaces, randomPlace, randomProvince, randomTrip, seededRng, type RandomPlace } from "@/lib/random";

const places: RandomPlace[] = getPlaces().map((p) => ({
  id: p.id,
  provinceSlug: p.provinceSlug,
  kind: p.kind,
  category: p.category,
  lat: p.lat,
  lng: p.lng,
  fee: p.fee ?? null,
  openingHours: p.openingHours ?? null,
}));
const byProvince = new Map<string, RandomPlace[]>();
for (const p of places) byProvince.set(p.provinceSlug, [...(byProvince.get(p.provinceSlug) ?? []), p]);
const provinces = getProvinces().map((p) => ({ slug: p.slug, region: p.region, centroid: p.centroid }));
const realIds = new Set(places.map((p) => p.id));

describe("randomProvince", () => {
  it("only returns provinces from the selected region", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = randomProvince(provinces, byProvince, { regions: ["south"] }, seededRng(seed));
      expect(r).not.toBeNull();
      expect(provinces.find((p) => p.slug === r!.slug)!.region).toBe("south");
    }
  });

  it("excludes visited provinces when asked", () => {
    const visited = provinces.filter((p) => p.region === "east").slice(0, 6).map((p) => p.slug);
    for (let seed = 1; seed <= 40; seed++) {
      const r = randomProvince(provinces, byProvince, { regions: ["east"], visitedMode: "exclude", visited }, seededRng(seed));
      expect(r).not.toBeNull();
      expect(visited).not.toContain(r!.slug);
    }
  });

  it("returns null when every candidate is excluded", () => {
    const visited = provinces.filter((p) => p.region === "west").map((p) => p.slug);
    expect(randomProvince(provinces, byProvince, { regions: ["west"], visitedMode: "exclude", visited }, seededRng(3))).toBeNull();
  });

  it("requires real records for the selected interest", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = randomProvince(provinces, byProvince, { interests: ["beach"] }, seededRng(seed))!;
      const inProv = byProvince.get(r.slug) ?? [];
      expect(inProv.some((p) => INTEREST_CATEGORIES.beach.includes(p.category))).toBe(true);
      expect(r.reasons.some((x) => x.code === "interest")).toBe(true);
    }
  });

  it("respects the day-trip distance limit", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = randomProvince(provinces, byProvince, { duration: "day" }, seededRng(seed))!;
      const c = provinces.find((p) => p.slug === r.slug)!.centroid;
      expect(haversineKm(BANGKOK, c)).toBeLessThanOrEqual(200);
    }
  });

  it("is deterministic for a given seed", () => {
    const a = randomProvince(provinces, byProvince, {}, seededRng(42));
    const b = randomProvince(provinces, byProvince, {}, seededRng(42));
    expect(a).toEqual(b);
  });
});

describe("randomPlace", () => {
  it("picks a real record in the chosen province and kind", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = randomPlace(places, { provinceSlug: "chiang-mai", kinds: ["attraction"] }, seededRng(seed))!;
      expect(realIds.has(r.id)).toBe(true);
      const p = places.find((x) => x.id === r.id)!;
      expect(p.provinceSlug).toBe("chiang-mai");
      expect(p.kind).toBe("attraction");
    }
  });

  it("never returns excluded (visited) places", () => {
    const pool = filterPlaces(places, { provinceSlug: "phuket" });
    const exclude = pool.slice(0, pool.length - 1).map((p) => p.id);
    const r = randomPlace(places, { provinceSlug: "phuket", excludePlaceIds: exclude }, seededRng(9))!;
    expect(r.id).toBe(pool[pool.length - 1].id);
  });

  it("freeOnly returns only places tagged free", () => {
    const r = randomPlace(places, { freeOnly: true }, seededRng(5));
    if (r) expect(places.find((p) => p.id === r.id)!.fee).toBe("free");
  });

  it("returns null when nothing matches", () => {
    expect(randomPlace(places, { provinceSlug: "no-such-province" }, seededRng(1))).toBeNull();
  });
});

describe("randomTrip", () => {
  it("builds a 1–3 day outline from real places in the province", () => {
    for (const days of [1, 2, 3]) {
      const plan = randomTrip(places, { provinceSlug: "chiang-mai", days }, seededRng(days))!;
      expect(plan.days.length).toBeLessThanOrEqual(days);
      expect(plan.days.length).toBeGreaterThan(0);
      const ids = plan.days.flatMap((d) => d.stops.map((s) => s.placeId));
      expect(new Set(ids).size).toBe(ids.length); // no repeats
      for (const id of ids) {
        expect(realIds.has(id)).toBe(true);
        expect(places.find((p) => p.id === id)!.provinceSlug).toBe("chiang-mai");
      }
      expect(plan.warnings).toContain("straight_line_distance");
    }
  });

  it("clamps days to 3", () => {
    const plan = randomTrip(places, { provinceSlug: "bangkok", days: 9 }, seededRng(1))!;
    expect(plan.days.length).toBeLessThanOrEqual(3);
  });
});
