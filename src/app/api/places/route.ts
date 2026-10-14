import { NextResponse } from "next/server";
import { getPlaceById, toPlaceSummary } from "@/lib/catalog";
import { ensureLiveCatalog } from "@/lib/catalog-live";

/** GET /api/places?ids=a,b,c → public summaries for known place ids (max 100). */
export async function GET(request: Request) {
  await ensureLiveCatalog();
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z0-9-]{1,80}$/.test(s))
    .slice(0, 100);
  const places = ids.map((id) => getPlaceById(id)).filter((p) => !!p).map((p) => toPlaceSummary(p!));
  return NextResponse.json({ places }, { headers: { "Cache-Control": "public, max-age=300" } });
}
