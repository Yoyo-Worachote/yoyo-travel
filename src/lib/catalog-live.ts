import "server-only";
import { createClient } from "@supabase/supabase-js";
import { setLiveOverrides } from "./catalog";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase/config";
import type { Place } from "./types";

const TTL_MS = 5 * 60 * 1000;
let lastFetch = 0;
let inflight: Promise<void> | null = null;

interface ManualRow {
  id: string;
  slug: string;
  province_slug: string;
  kind: Place["kind"];
  category: string;
  name_th: string | null;
  name_en: string | null;
  description_th: string | null;
  description_en: string | null;
  lat: number;
  lng: number;
  website: string | null;
  opening_hours: string | null;
  fee: "free" | "paid" | null;
  data_label: Place["label"];
  source_url: string | null;
  license: string | null;
  attribution: string | null;
  updated_at: string;
}

export function rowToPlace(r: ManualRow): Place {
  return {
    id: r.id,
    slug: r.slug,
    provinceSlug: r.province_slug,
    kind: r.kind,
    category: r.category,
    nameTh: r.name_th,
    nameEn: r.name_en,
    descriptionTh: r.description_th,
    descriptionEn: r.description_en,
    lat: r.lat,
    lng: r.lng,
    image: null,
    website: r.website,
    openingHours: r.opening_hours,
    fee: r.fee,
    label: r.data_label ?? "editor",
    source: {
      provider: "manual",
      externalId: r.id,
      url: r.source_url ?? "",
      license: r.license ?? "",
      attribution: r.attribution ?? "Yoyo Travel editors",
      fetchedAt: r.updated_at,
    },
  };
}

/**
 * Pull admin-curated overrides (published manual places, hidden provider IDs)
 * at most every 5 minutes. Uses the public anon key: RLS only exposes
 * published rows. Failures keep the last known state — the static catalog
 * always works on its own.
 */
export async function ensureLiveCatalog(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (Date.now() - lastFetch < TTL_MS) return;
  inflight ??= (async () => {
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const [manual, hidden] = await Promise.all([
        sb.from("places").select("*").eq("provider", "manual").eq("status", "published").limit(2000),
        sb.rpc("unpublished_place_ids"),
      ]);
      if (!manual.error && !hidden.error) {
        setLiveOverrides(((manual.data ?? []) as ManualRow[]).map(rowToPlace), (hidden.data ?? []) as string[]);
      }
    } catch {
      /* keep previous overrides */
    } finally {
      lastFetch = Date.now();
      inflight = null;
    }
  })();
  await inflight;
}
