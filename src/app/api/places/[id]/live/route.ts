import { NextResponse } from "next/server";
import { getPlaceById } from "@/lib/catalog";
import { ensureLiveCatalog } from "@/lib/catalog-live";
import { getLivePlaceProvider } from "@/lib/providers/google-places";
import { clientKey, rateLimit } from "@/lib/ratelimit";

/**
 * GET /api/places/:id/live → live provider data (rating, price range, links)
 * when a provider key is configured; otherwise { configured: false }.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9-]{1,80}$/.test(id)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const provider = getLivePlaceProvider();
  if (!provider) return NextResponse.json({ configured: false }, { headers: { "Cache-Control": "no-store" } });
  if (!rateLimit(`live:${clientKey(request.headers)}`, 30, 60_000).ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  await ensureLiveCatalog();
  const place = getPlaceById(id);
  if (!place) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const info = await provider.lookup(place);
    return NextResponse.json({ configured: true, info }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ configured: true, info: null, error: "provider_error" }, { status: 502 });
  }
}
