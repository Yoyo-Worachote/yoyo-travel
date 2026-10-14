import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlaceById, getPlaces, getProvince, getProvinces, toPlaceSummary } from "@/lib/catalog";
import { COMPANIONS, INTERESTS } from "@/lib/categories";
import { randomPlace, randomProvince, randomTrip, type RandomPlace } from "@/lib/random";
import type { PlaceKind, RegionId } from "@/lib/types";
import { ensureLiveCatalog } from "@/lib/catalog-live";

const slug = z.string().regex(/^[a-z0-9-]+$/).max(60);
const placeId = z.string().regex(/^[A-Za-z0-9-]+$/).max(80);
const REGIONS = ["north", "northeast", "central", "east", "west", "south"] as const;
const KINDS = ["attraction", "restaurant", "cafe", "accommodation", "activity"] as const;

const Body = z.object({
  mode: z.enum(["province", "place", "trip"]),
  regions: z.array(z.enum(REGIONS)).max(6).default([]),
  duration: z.enum(["day", "weekend", "long", "any"]).default("any"),
  budget: z.enum(["low", "mid", "high", "any"]).default("any"),
  companion: z.enum(COMPANIONS).nullish(),
  interests: z.array(z.enum(INTERESTS)).max(8).default([]),
  visitedMode: z.enum(["any", "exclude", "prioritize_unvisited"]).default("any"),
  visitedProvinces: z.array(slug).max(77).default([]),
  wishlistProvinces: z.array(slug).max(77).default([]),
  preferWishlist: z.boolean().default(false),
  provinceSlug: slug.nullish(),
  kinds: z.array(z.enum(KINDS)).max(5).default([]),
  freeOnly: z.boolean().default(false),
  excludePlaceIds: z.array(placeId).max(2000).default([]),
  days: z.number().int().min(1).max(3).default(2),
});

function toRandomPlace(p: ReturnType<typeof getPlaces>[number]): RandomPlace {
  return {
    id: p.id,
    provinceSlug: p.provinceSlug,
    kind: p.kind,
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    fee: p.fee ?? null,
    openingHours: p.openingHours ?? null,
  };
}

export async function POST(request: Request) {
  await ensureLiveCatalog();
  let f: z.infer<typeof Body>;
  try {
    f = Body.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const all = getPlaces().map(toRandomPlace);
  const byProvince = new Map<string, RandomPlace[]>();
  for (const p of all) byProvince.set(p.provinceSlug, [...(byProvince.get(p.provinceSlug) ?? []), p]);
  const provinces = getProvinces().map((p) => ({ slug: p.slug, region: p.region as RegionId, centroid: p.centroid }));

  const pickProvince = () =>
    randomProvince(provinces, byProvince, {
      regions: f.regions,
      duration: f.duration,
      budget: f.budget,
      companion: f.companion ?? null,
      interests: f.interests,
      visitedMode: f.visitedMode,
      visited: f.visitedProvinces,
      wishlistProvinces: f.wishlistProvinces,
      preferWishlist: f.preferWishlist,
    });

  if (f.mode === "province") {
    const r = pickProvince();
    if (!r) return NextResponse.json({ result: null });
    const p = getProvince(r.slug)!;
    return NextResponse.json({
      result: {
        province: { slug: p.slug, nameTh: p.nameTh, nameEn: p.nameEn, region: p.region, image: p.image, summaryTh: p.summaryTh, summaryEn: p.summaryEn },
        reasons: r.reasons,
        candidates: r.candidates,
      },
    });
  }

  if (f.mode === "place") {
    const regionSlugs = f.regions.length ? provinces.filter((p) => f.regions.includes(p.region as (typeof REGIONS)[number])).map((p) => p.slug) : [];
    const r = randomPlace(all, {
      provinceSlug: f.provinceSlug ?? null,
      regionSlugs,
      interests: f.interests,
      kinds: f.kinds as PlaceKind[],
      companion: f.companion ?? null,
      freeOnly: f.freeOnly,
      excludePlaceIds: f.excludePlaceIds,
    });
    if (!r) return NextResponse.json({ result: null });
    const place = getPlaceById(r.id)!;
    return NextResponse.json({ result: { place: { ...toPlaceSummary(place), descriptionTh: place.descriptionTh, descriptionEn: place.descriptionEn }, reasons: r.reasons, candidates: r.candidates } });
  }

  // trip
  const provinceSlug = f.provinceSlug ?? pickProvince()?.slug;
  if (!provinceSlug) return NextResponse.json({ result: null });
  const plan = randomTrip(all, {
    provinceSlug,
    days: f.days,
    interests: f.interests,
    companion: f.companion ?? null,
    excludePlaceIds: f.excludePlaceIds,
  });
  if (!plan) return NextResponse.json({ result: null });
  const p = getProvince(provinceSlug)!;
  return NextResponse.json({
    result: {
      province: { slug: p.slug, nameTh: p.nameTh, nameEn: p.nameEn, region: p.region },
      warnings: plan.warnings,
      days: plan.days.map((d) => ({
        day: d.day,
        stops: d.stops.map((s) => ({ ...s, place: toPlaceSummary(getPlaceById(s.placeId)!) })),
      })),
    },
  });
}
