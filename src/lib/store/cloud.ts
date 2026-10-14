"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emptyTravelState,
  type PlaceRef,
  type PlaceVisit,
  type ProvinceStatus,
  type TravelState,
  type Trip,
  type TripItem,
} from "../travel-state";

/**
 * Supabase persistence for personal records. Runs in the browser with the
 * user's session; Row Level Security on every table guarantees a user can only
 * read/write rows where user_id = auth.uid(). The user_id we send is checked by
 * the policies' WITH CHECK clause, never trusted on its own.
 */

interface PlaceJoin {
  name_th: string | null;
  name_en: string | null;
  category: string;
  province_slug: string;
}

const PLACE_COLS = "places(name_th,name_en,category,province_slug)";

function refFrom(placeId: string, p: PlaceJoin | PlaceJoin[] | null): PlaceRef {
  const place = Array.isArray(p) ? p[0] : p;
  return {
    placeId,
    provinceSlug: place?.province_slug ?? "",
    category: place?.category ?? "",
    nameTh: place?.name_th ?? null,
    nameEn: place?.name_en ?? null,
  };
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function loadCloudState(sb: SupabaseClient): Promise<TravelState> {
  const [prov, visits, wish, trips] = await Promise.all([
    sb.from("user_province_progress").select("province_slug,status,updated_at"),
    sb.from("user_place_visits").select(`place_id,visited_on,note,rating,tags,${PLACE_COLS}`),
    sb.from("user_wishlist").select(`place_id,created_at,${PLACE_COLS}`),
    sb
      .from("user_trips")
      .select(
        `id,name,province_slug,start_date,end_date,budget,notes,created_at,user_trip_items(id,place_id,day,position,note,estimated_cost,${PLACE_COLS})`,
      )
      .order("created_at", { ascending: false }),
  ]);
  const state = emptyTravelState();
  for (const r of check(prov) ?? []) {
    state.provinces[r.province_slug] = { status: r.status as ProvinceStatus, updatedAt: r.updated_at };
  }
  for (const r of (check(visits) ?? []) as Array<Record<string, unknown>>) {
    const ref = refFrom(r.place_id as string, r.places as PlaceJoin);
    state.visits[ref.placeId] = {
      ...ref,
      visitedOn: r.visited_on as string,
      note: (r.note as string) ?? null,
      rating: (r.rating as number) ?? null,
      tags: (r.tags as string[]) ?? [],
    };
  }
  for (const r of (check(wish) ?? []) as Array<Record<string, unknown>>) {
    const ref = refFrom(r.place_id as string, r.places as PlaceJoin);
    state.wishlist[ref.placeId] = { ...ref, addedAt: r.created_at as string };
  }
  state.trips = ((check(trips) ?? []) as Array<Record<string, unknown>>).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    provinceSlug: (t.province_slug as string) ?? null,
    startDate: (t.start_date as string) ?? null,
    endDate: (t.end_date as string) ?? null,
    budget: t.budget != null ? Number(t.budget) : null,
    notes: (t.notes as string) ?? null,
    createdAt: t.created_at as string,
    items: ((t.user_trip_items as Array<Record<string, unknown>>) ?? []).map((i) => ({
      ...refFrom(i.place_id as string, i.places as PlaceJoin),
      id: i.id as string,
      day: i.day as number,
      position: i.position as number,
      note: (i.note as string) ?? null,
      estimatedCost: i.estimated_cost != null ? Number(i.estimated_cost) : null,
    })),
  }));
  return state;
}

export const cloud = {
  async setProvinceStatus(sb: SupabaseClient, userId: string, slug: string, status: ProvinceStatus | null) {
    if (!status) {
      check(await sb.from("user_province_progress").delete().eq("province_slug", slug));
    } else {
      check(
        await sb
          .from("user_province_progress")
          .upsert({ user_id: userId, province_slug: slug, status, updated_at: new Date().toISOString() }),
      );
    }
  },
  async upsertVisit(sb: SupabaseClient, userId: string, v: PlaceVisit) {
    check(
      await sb.from("user_place_visits").upsert(
        {
          user_id: userId,
          place_id: v.placeId,
          visited_on: v.visitedOn,
          note: v.note?.slice(0, 2000) ?? null,
          rating: v.rating ?? null,
          tags: v.tags ?? [],
        },
        { onConflict: "user_id,place_id" },
      ),
    );
  },
  async removeVisit(sb: SupabaseClient, placeId: string) {
    check(await sb.from("user_place_visits").delete().eq("place_id", placeId));
  },
  async addWishlist(sb: SupabaseClient, userId: string, placeId: string) {
    check(
      await sb
        .from("user_wishlist")
        .upsert({ user_id: userId, place_id: placeId }, { onConflict: "user_id,place_id", ignoreDuplicates: true }),
    );
  },
  async removeWishlist(sb: SupabaseClient, placeId: string) {
    check(await sb.from("user_wishlist").delete().eq("place_id", placeId));
  },
  async upsertTrip(sb: SupabaseClient, userId: string, t: Trip) {
    check(
      await sb.from("user_trips").upsert({
        id: t.id,
        user_id: userId,
        name: t.name,
        province_slug: t.provinceSlug,
        start_date: t.startDate,
        end_date: t.endDate,
        budget: t.budget,
        notes: t.notes,
      }),
    );
  },
  async deleteTrip(sb: SupabaseClient, tripId: string) {
    check(await sb.from("user_trips").delete().eq("id", tripId));
  },
  /** Replace a trip's items with the given list (keeps ids stable). */
  async syncTripItems(sb: SupabaseClient, userId: string, tripId: string, items: TripItem[]) {
    const existing = check(await sb.from("user_trip_items").select("id").eq("trip_id", tripId)) ?? [];
    const keep = new Set(items.map((i) => i.id));
    const toDelete = existing.map((r: { id: string }) => r.id).filter((id: string) => !keep.has(id));
    if (toDelete.length) check(await sb.from("user_trip_items").delete().in("id", toDelete));
    if (items.length) {
      check(
        await sb.from("user_trip_items").upsert(
          items.map((i) => ({
            id: i.id,
            trip_id: tripId,
            user_id: userId,
            place_id: i.placeId,
            day: i.day,
            position: i.position,
            note: i.note ?? null,
            estimated_cost: i.estimatedCost ?? null,
          })),
        ),
      );
    }
  },
};
