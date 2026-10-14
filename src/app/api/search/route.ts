import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlaces, getProvince, getProvinces, toPlaceSummary } from "@/lib/catalog";
import { CATEGORY_GROUP_IDS } from "@/lib/categories";
import { haversineKm } from "@/lib/geo";
import { searchItems } from "@/lib/search";
import { ensureLiveCatalog } from "@/lib/catalog-live";

const Query = z.object({
  q: z.string().max(100).default(""),
  group: z.enum(CATEGORY_GROUP_IDS as [string, ...string[]]).nullish(),
  province: z.string().regex(/^[a-z0-9-]+$/).max(60).nullish(),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(24),
  lat: z.coerce.number().min(-90).max(90).nullish(),
  lng: z.coerce.number().min(-180).max(180).nullish(),
});

export async function GET(request: Request) {
  await ensureLiveCatalog();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = Query.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { q, group, province, offset, limit, lat, lng } = parsed.data;

  const provinces = q.trim()
    ? searchItems(
        getProvinces().map((p) => ({ ...p, id: p.slug })),
        q,
        { limit: 8 },
      ).results.map((p) => ({ slug: p.slug, nameTh: p.nameTh, nameEn: p.nameEn, region: p.region, image: p.image }))
    : [];

  let pool = getPlaces().map((p) => ({
    ...p,
    extra: [
      ...(p.cuisine ?? []),
      getProvince(p.provinceSlug)?.nameTh ?? "",
      getProvince(p.provinceSlug)?.nameEn ?? "",
      p.category,
    ],
  }));
  if (lat != null && lng != null) {
    pool = pool
      .map((p) => ({ ...p, d: haversineKm([lat, lng], [p.lat, p.lng]) }))
      .filter((p) => p.d <= 50)
      .sort((a, b) => a.d - b.d);
  }
  const { results, total } = searchItems(pool, q, { offset, limit, group: (group as never) ?? null, provinceSlug: province ?? null });
  return NextResponse.json(
    { provinces, places: results.map(toPlaceSummary), total, offset, limit },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
