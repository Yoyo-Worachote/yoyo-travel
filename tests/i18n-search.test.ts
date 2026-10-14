import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import th from "../messages/th.json";
import en from "../messages/en.json";
import { defaultLocale, isLocale } from "@/i18n/config";
import { altName, localName } from "@/lib/display";
import { getPlaces, getProvinces } from "@/lib/catalog";
import { normalizeText, searchItems } from "@/lib/search";

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("i18n", () => {
  it("defaults to Thai", () => {
    expect(defaultLocale).toBe("th");
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });

  it("has the same keys in Thai and English", () => {
    const thKeys = keys(th).sort();
    const enKeys = keys(en).sort();
    expect(enKeys.filter((k) => !thKeys.includes(k))).toEqual([]);
    expect(thKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
  });

  it("every message formats in both locales (valid ICU)", () => {
    const values = { count: 3, name: "X", km: 10, date: "1 Jan", province: "P", days: 2, n: 2, interest: "I", companion: "C", region: "R", category: "Cat", author: "A", license: "L", visited: 1, total: 2, day: 1, season: "S", max: 1000, provider: "P", page: 1 };
    for (const [locale, messages] of [["th", th], ["en", en]] as const) {
      const t = createTranslator({ locale, messages });
      for (const k of keys(messages)) {
        expect(() => t(k as never, values as never)).not.toThrow();
      }
    }
  });

  it("translates core navigation differently per locale", () => {
    const tTh = createTranslator({ locale: "th", messages: th });
    const tEn = createTranslator({ locale: "en", messages: en });
    expect(tTh("nav.explore")).toBe("สำรวจประเทศไทย");
    expect(tEn("nav.explore")).toBe("Explore Thailand");
    expect(tEn("common.places", { count: 1 })).toBe("1 place");
  });

  it("shows official names per locale and never invents translations", () => {
    const cm = getProvinces().find((p) => p.slug === "chiang-mai")!;
    expect(localName(cm, "th")).toBe("เชียงใหม่");
    expect(localName(cm, "en")).toBe("Chiang Mai");
    expect(altName(cm, "th")).toBe("Chiang Mai");
    const onlyThai = { nameTh: "ร้านทดสอบ", nameEn: null };
    expect(localName(onlyThai, "en")).toBe("ร้านทดสอบ"); // preserved original
    expect(altName(onlyThai, "en")).toBeNull();
  });
});

describe("search", () => {
  const provinces = getProvinces().map((p) => ({ ...p, id: p.slug }));
  it("finds provinces by Thai and English names", () => {
    expect(searchItems(provinces, "เชียงใหม่").results[0].slug).toBe("chiang-mai");
    expect(searchItems(provinces, "chiang mai").results[0].slug).toBe("chiang-mai");
    expect(searchItems(provinces, "PHUKET").results[0].slug).toBe("phuket");
    expect(searchItems(provinces, "ภูเก็ต").results[0].slug).toBe("phuket");
  });

  it("finds places by either name and paginates", () => {
    const places = getPlaces();
    const r = searchItems(places, "Doi Inthanon");
    expect(r.results.some((p) => p.provinceSlug === "chiang-mai")).toBe(true);
    const all = searchItems(places, "wat", { limit: 5 });
    const page2 = searchItems(places, "wat", { limit: 5, offset: 5 });
    expect(all.results).toHaveLength(5);
    expect(page2.results[0].id).not.toBe(all.results[0].id);
    expect(all.total).toBeGreaterThan(10);
  });

  it("filters by category group and province", () => {
    const r = searchItems(getPlaces(), "", { group: "beach", provinceSlug: "krabi", limit: 100 });
    expect(r.results.length).toBeGreaterThan(0);
    expect(r.results.every((p) => ["beach", "island"].includes(p.category) && p.provinceSlug === "krabi")).toBe(true);
  });

  it("normalizes text", () => {
    expect(normalizeText("  Chiang-Mai! ")).toBe("chiang mai");
  });
});
