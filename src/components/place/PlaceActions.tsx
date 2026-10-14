"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Check, Heart, ListPlus, Share2, Star } from "lucide-react";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import type { PlaceRef } from "@/lib/travel-state";
import { todayIso } from "@/lib/travel-state";

export function PlaceActions({ place, shareTitle }: { place: PlaceRef; shareTitle: string }) {
  const t = useTranslations();
  const store = useTravelStore();
  const visit = store.state.visits[place.placeId];
  const inWishlist = !!store.state.wishlist[place.placeId];
  const [tripOpen, setTripOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string>("");
  const [day, setDay] = useState(1);

  const show = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: shareTitle, url });
      else {
        await navigator.clipboard.writeText(url);
        show(t("common.copied"));
      }
    } catch {
      /* user cancelled */
    }
  };

  const addToTrip = async () => {
    if (!tripId) return;
    if (tripId === "__new") {
      const trip = await store.createTrip({ name: shareTitle, provinceSlug: place.provinceSlug }, [{ ...place, day: 1 }]);
      if (trip) show(t("place.addedToTrip"));
    } else {
      const ok = await store.addTripItem(tripId, place, day);
      show(ok ? t("place.addedToTrip") : t("trips.duplicate"));
    }
    setTripOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={!!visit}
          onClick={() => (visit ? store.removeVisit(place.placeId) : store.markVisited(place))}
          className={`btn ${visit ? "btn-primary" : "btn-secondary"}`}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {visit ? t("place.visited") : t("place.markVisited")}
        </button>
        <button
          type="button"
          aria-pressed={inWishlist}
          onClick={() => (inWishlist ? store.removeWishlist(place.placeId) : store.addWishlist(place))}
          className={`btn ${inWishlist ? "bg-want text-white" : "btn-secondary"}`}
        >
          <Heart className="h-4 w-4" aria-hidden="true" />
          {inWishlist ? t("place.inWishlist") : t("place.addWishlist")}
        </button>
        <button type="button" className="btn btn-secondary" aria-expanded={tripOpen} onClick={() => setTripOpen((v) => !v)}>
          <ListPlus className="h-4 w-4" aria-hidden="true" />
          {t("place.addToTrip")}
        </button>
        <button type="button" className="btn btn-ghost" onClick={share}>
          <Share2 className="h-4 w-4" aria-hidden="true" />
          {t("common.share")}
        </button>
      </div>
      {flash && (
        <p role="status" className="text-sm font-medium text-forest-700">
          {flash}
        </p>
      )}

      {tripOpen && (
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-48 flex-1">
            <label htmlFor="trip-select" className="label">
              {t("place.chooseTrip")}
            </label>
            <select id="trip-select" className="input" value={tripId} onChange={(e) => setTripId(e.target.value)}>
              <option value="">—</option>
              {store.state.trips.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name}
                </option>
              ))}
              <option value="__new">+ {t("place.newTrip")}</option>
            </select>
          </div>
          {tripId && tripId !== "__new" && (
            <div className="w-28">
              <label htmlFor="trip-day" className="label">
                {t("trips.moveDay")}
              </label>
              <select id="trip-day" className="input" value={day} onChange={(e) => setDay(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>
                    {t("place.day", { day: d })}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="button" className="btn btn-primary" disabled={!tripId} onClick={addToTrip}>
            {t("common.add")}
          </button>
        </div>
      )}

      {visit && <VisitEditor placeRef={place} />}
    </div>
  );
}

function VisitEditor({ placeRef }: { placeRef: PlaceRef }) {
  const t = useTranslations("place");
  const tc = useTranslations("common");
  const store = useTravelStore();
  const visit = store.state.visits[placeRef.placeId];
  const [date, setDate] = useState(visit?.visitedOn ?? todayIso());
  const [note, setNote] = useState(visit?.note ?? "");
  const [rating, setRating] = useState<number | null>(visit?.rating ?? null);
  const [saved, setSaved] = useState(false);
  if (!visit) return null;

  const save = async () => {
    await store.markVisited(placeRef, { visitedOn: date, note: note.trim().slice(0, 2000) || null, rating });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form
      className="card space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="visit-date" className="label">
            {t("visitDate")}
          </label>
          <input id="visit-date" type="date" className="input" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <fieldset>
          <legend className="label">{t("rating")}</legend>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n}/5`}
                aria-pressed={rating === n}
                onClick={() => setRating(rating === n ? null : n)}
                className="p-1"
              >
                <Star className={`h-6 w-6 ${rating && n <= rating ? "fill-gold text-gold" : "text-sage-300"}`} aria-hidden="true" />
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <div>
        <label htmlFor="visit-note" className="label">
          {t("note")}
        </label>
        <textarea id="visit-note" className="input" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="mt-1 text-xs muted">{t("privateNote")}</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary btn-sm">
          {tc("save")}
        </button>
        {saved && (
          <span role="status" className="text-sm text-forest-700">
            {tc("saved")}
          </span>
        )}
      </div>
    </form>
  );
}
