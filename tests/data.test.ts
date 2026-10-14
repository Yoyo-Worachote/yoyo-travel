import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getPlaces, getProvinces } from "@/lib/catalog";
import { findDuplicates } from "@/lib/duplicates";

const provinces = getProvinces();
const places = getPlaces();

describe("province seed data", () => {
  it("has exactly 77 provinces including Bangkok, with unique slugs and ISO codes", () => {
    expect(provinces).toHaveLength(77);
    expect(new Set(provinces.map((p) => p.slug)).size).toBe(77);
    expect(new Set(provinces.map((p) => p.iso)).size).toBe(77);
    const bkk = provinces.find((p) => p.slug === "bangkok")!;
    expect(bkk.iso).toBe("TH-10");
    expect(bkk.nameTh).toBe("กรุงเทพมหานคร");
  });

  it("uses the 6-region grouping with the expected counts", () => {
    const counts: Record<string, number> = {};
    for (const p of provinces) counts[p.region] = (counts[p.region] ?? 0) + 1;
    expect(counts).toEqual({ north: 9, northeast: 20, central: 22, east: 7, west: 5, south: 14 });
  });

  it("has Thai and English names for every province", () => {
    for (const p of provinces) {
      expect(p.nameTh).toMatch(/[฀-๿]/);
      expect(p.nameEn).toMatch(/^[A-Za-z .-]+$/);
      expect(p.wikidataId).toMatch(/^Q\d+$/);
    }
  });

  it("has a boundary polygon for every province", () => {
    const geo = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/geo/thailand-provinces.geojson"), "utf8"));
    expect(geo.features).toHaveLength(77);
    const slugs = new Set(geo.features.map((f: { properties: { slug: string } }) => f.properties.slug));
    for (const p of provinces) expect(slugs.has(p.slug)).toBe(true);
    for (const f of geo.features) expect(["Polygon", "MultiPolygon"]).toContain(f.geometry.type);
  });
});

describe("place data", () => {
  it("has unique ids and slugs per province, valid provinces and coordinates in/near Thailand", () => {
    expect(places.length).toBeGreaterThan(1000);
    expect(new Set(places.map((p) => p.id)).size).toBe(places.length);
    const slugKeys = places.map((p) => `${p.provinceSlug}/${p.slug}`);
    expect(new Set(slugKeys).size).toBe(slugKeys.length);
    const slugs = new Set(provinces.map((p) => p.slug));
    for (const p of places) {
      expect(slugs.has(p.provinceSlug)).toBe(true);
      expect(p.lat).toBeGreaterThan(5);
      expect(p.lat).toBeLessThan(21);
      expect(p.lng).toBeGreaterThan(97);
      expect(p.lng).toBeLessThan(106);
      expect(p.nameTh || p.nameEn).toBeTruthy();
    }
  });

  it("records provider, source URL, license and fetch date for every place", () => {
    for (const p of places) {
      expect(["wikidata", "osm", "manual"]).toContain(p.source.provider);
      expect(p.source.url).toMatch(/^https:\/\/(www\.wikidata\.org|www\.openstreetmap\.org)\//);
      expect(p.source.license).toBeTruthy();
      expect(p.source.attribution).toBeTruthy();
      expect(Number.isNaN(Date.parse(p.source.fetchedAt))).toBe(false);
    }
  });

  it("only displays images that have a license, author and source page", () => {
    const withImages = [...places.filter((p) => p.image).map((p) => p.image!), ...provinces.filter((p) => p.image).map((p) => p.image!)];
    expect(withImages.length).toBeGreaterThan(100);
    for (const img of withImages) {
      expect(img.url).toMatch(/^https:\/\/(upload|thumb)\.wikimedia\.org\//);
      expect(img.license.length).toBeGreaterThan(1);
      expect(img.author.length).toBeGreaterThan(0);
      expect(img.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    }
  });

  it("carries no fabricated prices or ratings", () => {
    for (const p of places as unknown as Array<Record<string, unknown>>) {
      expect(p.price).toBeUndefined();
      expect(p.rating).toBeUndefined();
      expect(p.reviewCount).toBeUndefined();
    }
  });
});

describe("duplicate detection", () => {
  it("flags same-name places within 300 m and ignores far ones", () => {
    const a = { id: "a", nameTh: "วัดทดสอบ", nameEn: "Wat Test", lat: 13.75, lng: 100.5, provinceSlug: "bangkok" };
    const b = { id: "b", nameTh: null, nameEn: "wat test", lat: 13.7505, lng: 100.5005, provinceSlug: "bangkok" };
    const c = { id: "c", nameTh: "วัดทดสอบ", nameEn: null, lat: 14.5, lng: 100.5, provinceSlug: "ayutthaya" };
    const pairs = findDuplicates([a, b, c]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].map((x) => x.id).sort()).toEqual(["a", "b"]);
  });
});
