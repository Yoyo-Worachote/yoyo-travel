import { NextResponse } from "next/server";
import { getPlaceById, toPlaceSummary } from "@/lib/catalog";
import { ensureLiveCatalog } from "@/lib/catalog-live";
import { providerPriceFor } from "@/lib/pricing";

/**
 * GET /api/places?ids=a,b,c → public summaries for known place ids (max 100),
 * with the sourced provider price (if any) and opening hours for trip planning.
 */
export async function GET(request: Request) {
  await ensureLiveCatalog();
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z0-9-]{1,80}$/.test(s))
    .slice(0, 100);
  const places = ids
    .map((id) => getPlaceById(id))
    .filter((p) => !!p)
    .map((p) => ({ ...toPlaceSummary(p!), price: providerPriceFor(p!), openingHours: p!.openingHours ?? null }));
  return NextResponse.json({ places }, { headers: { "Cache-Control": "public, max-age=300" } });
}
