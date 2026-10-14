"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emptyTravelState,
  type ImportPlan,
  type PlaceRef,
  type PlaceVisit,
  type ProvinceStatus,
  type TravelState,
  type Trip,
  type TripExpense,
  type TripItem,
} from "../travel-state";

/**
 * Supabase persistence for personal records. Runs in the browser with the
 * signed-in user's session; Row Level Security on every table guarantees a
 * user can only read/write rows where user_id = auth.uid(). The user_id we send
 * is checked by the policies' WITH CHECK clause — never trusted on its own.
 * All writes are idempotent upserts keyed by stable ids, so retries and guest
 * imports never create duplicates.
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

const hhmm = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 5) : null);
const num = (v: unknown) => (v == null ? null : Number(v));

export async function loadCloudState(sb: SupabaseClient): Promise<TravelState> {
  const [prov, visits, wish, trips] = await Promise.all([
    sb.from("user_province_progress").select("province_slug,status,updated_at"),
    sb.from("user_place_visits").select(`place_id,visited_on,note,rating,tags,${PLACE_COLS}`),
    sb.from("user_wishlist").select(`place_id,created_at,${PLACE_COLS}`),
    sb
      .from("user_trips")
      .select(
        `id,name,description,province_slug,start_date,end_date,traveler_count,budget,currency,status,travel_styles,transport_mode,notes,created_at,updated_at,` +
          `user_trip_items(id,place_id,day,position,note,start_time,end_time,cost_category,estimated_cost,actual_cost,${PLACE_COLS}),` +
          `user_trip_expenses(id,day,category,label,amount,cost_type)`,
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
  state.trips = ((check(trips) ?? []) as unknown as Array<Record<string, unknown>>).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    description: (t.description as string) ?? null,
    provinceSlug: (t.province_slug as string) ?? null,
    startDate: (t.start_date as string) ?? null,
    endDate: (t.end_date as string) ?? null,
    travelerCount: Number(t.traveler_count ?? 1),
    budget: num(t.budget),
    currency: (t.currency as string) ?? "THB",
    status: (t.status as Trip["status"]) ?? "planning",
    travelStyles: ((t.travel_styles as string[]) ?? []) as Trip["travelStyles"],
    transportMode: (t.transport_mode as Trip["transportMode"]) ?? null,
    notes: (t.notes as string) ?? null,
    createdAt: t.created_at as string,
    updatedAt: t.updated_at as string,
    items: ((t.user_trip_items as Array<Record<string, unknown>>) ?? []).map((i) => ({
      ...refFrom(i.place_id as string, i.places as PlaceJoin),
      id: i.id as string,
      day: i.day as number,
      position: i.position as number,
      note: (i.note as string) ?? null,
      startTime: hhmm(i.start_time),
      endTime: hhmm(i.end_time),
      costCategory: (i.cost_category as TripItem["costCategory"]) ?? null,
      estimatedCost: num(i.estimated_cost),
      actualCost: num(i.actual_cost),
    })),
    expenses: ((t.user_trip_expenses as Array<Record<string, unknown>>) ?? []).map((e) => ({
      id: e.id as string,
      day: (e.day as number) ?? null,
      category: e.category as TripExpense["category"],
      label: e.label as string,
      amount: Number(e.amount),
      costType: e.cost_type as TripExpense["costType"],
    })),
  }));
  return state;
}

const tripRow = (userId: string, t: Trip) => ({
  id: t.id,
  user_id: userId,
  name: t.name,
  description: t.description,
  province_slug: t.provinceSlug,
  start_date: t.startDate,
  end_date: t.endDate,
  traveler_count: t.travelerCount,
  budget: t.budget,
  currency: t.currency,
  status: t.status,
  travel_styles: t.travelStyles,
  transport_mode: t.transportMode,
  notes: t.notes,
});

const itemRow = (userId: string, tripId: string, i: TripItem) => ({
  id: i.id,
  trip_id: tripId,
  user_id: userId,
  place_id: i.placeId,
  day: i.day,
  position: i.position,
  note: i.note ?? null,
  start_time: i.startTime || null,
  end_time: i.endTime || null,
  cost_category: i.costCategory ?? null,
  estimated_cost: i.estimatedCost ?? null,
  actual_cost: i.actualCost ?? null,
});

const expenseRow = (userId: string, tripId: string, e: TripExpense) => ({
  id: e.id,
  trip_id: tripId,
  user_id: userId,
  day: e.day,
  category: e.category,
  label: e.label,
  amount: e.amount,
  cost_type: e.costType,
});

const visitRow = (userId: string, v: PlaceVisit) => ({
  user_id: userId,
  place_id: v.placeId,
  visited_on: v.visitedOn,
  note: v.note?.slice(0, 2000) ?? null,
  rating: v.rating ?? null,
  tags: v.tags ?? [],
});

export const cloud = {
  async setProvinceStatus(sb: SupabaseClient, userId: string, slug: string, status: ProvinceStatus | null) {
    if (!status) {
      check(await sb.from("user_province_progress").delete().eq("user_id", userId).eq("province_slug", slug));
    } else {
      check(
        await sb
          .from("user_province_progress")
          .upsert({ user_id: userId, province_slug: slug, status, updated_at: new Date().toISOString() }),
      );
    }
  },
  async upsertVisit(sb: SupabaseClient, userId: string, v: PlaceVisit) {
    check(await sb.from("user_place_visits").upsert(visitRow(userId, v), { onConflict: "user_id,place_id" }));
  },
  async removeVisit(sb: SupabaseClient, userId: string, placeId: string) {
    check(await sb.from("user_place_visits").delete().eq("user_id", userId).eq("place_id", placeId));
  },
  async addWishlist(sb: SupabaseClient, userId: string, placeId: string) {
    check(
      await sb
        .from("user_wishlist")
        .upsert({ user_id: userId, place_id: placeId }, { onConflict: "user_id,place_id", ignoreDuplicates: true }),
    );
  },
  async removeWishlist(sb: SupabaseClient, userId: string, placeId: string) {
    check(await sb.from("user_wishlist").delete().eq("user_id", userId).eq("place_id", placeId));
  },
  async upsertTrip(sb: SupabaseClient, userId: string, t: Trip) {
    check(await sb.from("user_trips").upsert(tripRow(userId, t)));
  },
  async deleteTrip(sb: SupabaseClient, userId: string, tripId: string) {
    check(await sb.from("user_trips").delete().eq("user_id", userId).eq("id", tripId));
  },
  /** Make the trip's items and expenses in the DB match the given lists (ids stay stable). */
  async syncTripChildren(sb: SupabaseClient, userId: string, trip: Trip) {
    const [items, expenses] = await Promise.all([
      sb.from("user_trip_items").select("id").eq("trip_id", trip.id),
      sb.from("user_trip_expenses").select("id").eq("trip_id", trip.id),
    ]);
    const keepItems = new Set(trip.items.map((i) => i.id));
    const keepExp = new Set(trip.expenses.map((e) => e.id));
    const delItems = (check(items) ?? []).map((r: { id: string }) => r.id).filter((id: string) => !keepItems.has(id));
    const delExp = (check(expenses) ?? []).map((r: { id: string }) => r.id).filter((id: string) => !keepExp.has(id));
    if (delItems.length) check(await sb.from("user_trip_items").delete().in("id", delItems));
    if (delExp.length) check(await sb.from("user_trip_expenses").delete().in("id", delExp));
    if (trip.items.length) check(await sb.from("user_trip_items").upsert(trip.items.map((i) => itemRow(userId, trip.id, i))));
    if (trip.expenses.length)
      check(await sb.from("user_trip_expenses").upsert(trip.expenses.map((e) => expenseRow(userId, trip.id, e))));
  },
  /** Upload guest data that the account does not have yet (see planGuestImport). */
  async importPlan(sb: SupabaseClient, userId: string, plan: ImportPlan) {
    if (plan.provinces.length)
      check(
        await sb.from("user_province_progress").upsert(
          plan.provinces.map(([slug, status]) => ({ user_id: userId, province_slug: slug, status })),
          { onConflict: "user_id,province_slug", ignoreDuplicates: true },
        ),
      );
    if (plan.visits.length)
      check(
        await sb
          .from("user_place_visits")
          .upsert(plan.visits.map((v) => visitRow(userId, v)), { onConflict: "user_id,place_id", ignoreDuplicates: true }),
      );
    if (plan.wishlist.length)
      check(
        await sb.from("user_wishlist").upsert(
          plan.wishlist.map((w) => ({ user_id: userId, place_id: w.placeId })),
          { onConflict: "user_id,place_id", ignoreDuplicates: true },
        ),
      );
    for (const t of plan.trips) {
      await cloud.upsertTrip(sb, userId, t);
      await cloud.syncTripChildren(sb, userId, t);
    }
  },
};
