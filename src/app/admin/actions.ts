"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProvince } from "@/lib/catalog";
import { getAdminContext } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";

const CATEGORIES = [
  "national_park", "nature", "waterfall", "beach", "island", "mountain", "cave", "viewpoint", "history", "museum",
  "temple", "market", "shopping", "park", "activity", "restaurant", "cafe", "hotel", "hostel", "guest_house", "motel", "apartment",
] as const;

const NewPlace = z
  .object({
    nameTh: z.string().trim().max(200).optional().default(""),
    nameEn: z.string().trim().max(200).optional().default(""),
    provinceSlug: z.string().regex(/^[a-z0-9-]+$/),
    kind: z.enum(["attraction", "restaurant", "cafe", "accommodation", "activity"]),
    category: z.enum(CATEGORIES),
    lat: z.coerce.number().min(5).max(21),
    lng: z.coerce.number().min(97).max(106),
    sourceUrl: z.string().trim().url().max(500).refine((u) => /^https?:\/\//.test(u)),
    status: z.enum(["draft", "review", "published"]),
  })
  .refine((v) => v.nameTh || v.nameEn, { message: "name required" });

export type AdminActionState = { ok: boolean; message: string } | null;

/** Every admin action re-checks authorization on the server (RLS enforces it again). */
export async function createManualPlace(_prev: AdminActionState, form: FormData): Promise<AdminActionState> {
  const ctx = await getAdminContext();
  if (ctx.status !== "ok") return { ok: false, message: "forbidden" };
  const parsed = NewPlace.safeParse(Object.fromEntries(form));
  if (!parsed.success || !getProvince(parsed.data.provinceSlug)) return { ok: false, message: "invalid" };
  const v = parsed.data;
  const suffix = crypto.randomUUID().slice(0, 8);
  const id = `manual-${suffix}`;
  const { error } = await ctx.supabase.from("places").insert({
    id,
    slug: `${slugify(v.nameEn || "") || "place"}-${suffix}`,
    province_slug: v.provinceSlug,
    kind: v.kind,
    category: v.category,
    name_th: v.nameTh || null,
    name_en: v.nameEn || null,
    lat: v.lat,
    lng: v.lng,
    status: v.status,
    data_label: "editor",
    provider: "manual",
    external_id: id,
    source_url: v.sourceUrl,
    attribution: "Yoyo Travel editors",
    created_by: ctx.user.id,
  });
  if (error) return { ok: false, message: "save_failed" };
  revalidatePath("/admin");
  return { ok: true, message: "created" };
}

const StatusChange = z.object({
  id: z.string().regex(/^(wd|osm|manual)-[A-Za-z0-9-]+$/),
  status: z.enum(["draft", "review", "published", "hidden"]),
});

export async function setPlaceStatus(form: FormData): Promise<void> {
  const ctx = await getAdminContext();
  if (ctx.status !== "ok") return;
  const parsed = StatusChange.safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  await ctx.supabase.from("places").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  revalidatePath("/admin");
}
