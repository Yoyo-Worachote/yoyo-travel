import { NextResponse } from "next/server";
import { z } from "zod";
import { answerChat, MAX_MESSAGE_CHARS } from "@/lib/ai/chat";
import { getModelProvider, getSearchProvider } from "@/lib/ai/providers";
import { retrieveInternal } from "@/lib/ai/retrieve";
import { getPlaceById, getProvince } from "@/lib/catalog";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { ensureLiveCatalog } from "@/lib/catalog-live";

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
  locale: z.enum(["th", "en"]).default("th"),
  context: z
    .object({
      provinceSlug: z.string().regex(/^[a-z0-9-]+$/).max(60).nullish(),
      placeId: z.string().regex(/^[A-Za-z0-9-]+$/).max(80).nullish(),
    })
    .nullish(),
});

export async function POST(request: Request) {
  await ensureLiveCatalog();
  const limit = rateLimit(`chat:${clientKey(request.headers)}`, Number(process.env.CHAT_RATE_LIMIT_PER_MIN ?? 8), 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const last = parsed.messages[parsed.messages.length - 1];
  if (last.role !== "user") return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (last.content.length > MAX_MESSAGE_CHARS) return NextResponse.json({ error: "too_long", max: MAX_MESSAGE_CHARS }, { status: 400 });

  const ctx = parsed.context ?? {};
  const province = ctx.provinceSlug ? getProvince(ctx.provinceSlug) : undefined;
  const place = ctx.placeId ? getPlaceById(ctx.placeId) : undefined;
  const contextLabel = place
    ? `${place.nameTh ?? ""} / ${place.nameEn ?? ""} (${getProvince(place.provinceSlug)?.nameEn ?? ""})`
    : province
      ? `${province.nameTh} / ${province.nameEn} province`
      : null;

  const result = await answerChat(
    { turns: parsed.messages, uiLocale: parsed.locale, contextLabel },
    {
      model: getModelProvider(),
      search: getSearchProvider(),
      retrieve: (q) => retrieveInternal(q, { provinceSlug: province?.slug, placeId: place?.id }),
    },
  );
  const status = result.status === "provider_error" ? 502 : 200;
  return NextResponse.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
