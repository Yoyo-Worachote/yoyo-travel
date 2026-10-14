import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlaces, getProvince, getProvinces, toPlaceSummary } from "@/lib/catalog";
import { ensureLiveCatalog } from "@/lib/catalog-live";
import { AMENITIES, CATEGORY_GROUP_IDS, EXPLORE_CATEGORIES, EXPLORE_CATEGORY_IDS } from "@/lib/categories";
import { haversineKm } from "@/lib/geo";
import { priceInfo } from "@/lib/pricing";
import { searchItems } from "@/lib/search";
import type { Place } from "@/lib/types";

const Query = z.object({
  q: z.string().max(100).default(""),
  group: z.enum(CATEGORY_GROUP_IDS as [string, ...string[]]).nullish(),
  category: z.enum(EXPLORE_CATEGORY_IDS as [string, ...string[]]).nullish(),
  province: z.string().regex(/^[a-z0-9-]+$/).max(60).nullish(),
  amenities: z
    .string()
    .max(200)
    .nullish()
    .transform((v) => (v ? v.split(",").filter((a) => (AMENITIES as readonly string[]).includes(a)) : [])),
  price: z.enum(["any", "free", "priced"]).default("any"),
  sort: z.enum(["recommended", "name", "price", "rating"]).default("recommended"),
  offset: z.coerce.number().int().min(0).max(20000).default(0),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  lat: z.coerce.number().min(-90).max(90).nullish(),
  lng: z.coerce.number().min(-180).max(180).nullish(),
  locale: z.enum(["th", "en"]).default("th"),
});

/** Data-completeness ranking (no popularity data exists; see docs/DATA_SOURCES.md). */
function recommended(p: Place & { score?: number }): number {
  return (p.wikiSitelinks ?? 0) * 3 + (p.image ? 6 : 0) + (p.openingHours ? 2 : 0) + (p.website ? 2 : 0) + (p.score ?? 0);
}

export async function GET(request: Request) {
  await ensureLiveCatalog();
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { q, group, category, province, amenities, price, sort, offset, limit, lat, lng, locale } = parsed.data;

  const provinces = q.trim()
    ? searchItems(
        getProvinces().map((p) => ({ ...p, id: p.slug })),
        q,
        { limit: 8 },
      ).results.map((p) => ({ slug: p.slug, nameTh: p.nameTh, nameEn: p.nameEn, region: p.region, image: p.image }))
    : [];

  const cats = category ? new Set<string>(EXPLORE_CATEGORIES[category as keyof typeof EXPLORE_CATEGORIES]) : null;
  let pool = getPlaces()
    .filter((p) => !cats || cats.has(p.category))
    .filter((p) => !amenities.length || amenities.every((a) => p.amenities?.includes(a)))
    .filter((p) => {
      if (price === "any") return true;
      const info = priceInfo(p);
      return price === "free" ? info.free : (info.type === "exact" || info.type === "range") && !info.free;
    })
    .map((p) => ({
      ...p,
      extra: [...(p.cuisine ?? []), getProvince(p.provinceSlug)?.nameTh ?? "", getProvince(p.provinceSlug)?.nameEn ?? "", p.category, p.address ?? ""],
    }));

  let near = false;
  if (lat != null && lng != null) {
    near = true;
    pool = pool
      .map((p) => ({ ...p, d: haversineKm([lat, lng], [p.lat, p.lng]) }))
      .filter((p) => p.d <= 50)
      .sort((a, b) => a.d - b.d);
  } else {
    if (sort === "name" && !q.trim()) {
      const key = (p: Place) => (locale === "en" ? p.nameEn || p.nameTh : p.nameTh || p.nameEn) ?? "";
      pool.sort((a, b) => key(a).localeCompare(key(b), locale));
    } else if (sort === "price" && !q.trim()) {
      // Places with a sourced price first (cheapest first); unpriced last.
      const pv = (p: Place) => priceInfo(p).min ?? Number.POSITIVE_INFINITY;
      pool.sort((a, b) => pv(a) - pv(b) || recommended(b) - recommended(a));
    } else {
      pool.sort((a, b) => recommended(b) - recommended(a) || a.id.localeCompare(b.id));
    }
  }

  const { results, total } = searchItems(pool, q, {
    offset,
    limit,
    group: (group as never) ?? null,
    provinceSlug: province ?? null,
  });
  return NextResponse.json(
    {
      provinces,
      places: results.map(toPlaceSummary),
      total,
      offset,
      limit,
      near,
      // No licensed rating provider is configured, so rating sort/filter is not available.
      ratingAvailable: false,
    },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
