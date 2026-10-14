"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Heart, ListPlus, Navigation } from "lucide-react";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import { localName } from "@/lib/display";
import { googleMapsDirectionsUrl } from "@/lib/geo";
import type { PlaceSummary } from "@/lib/types";

/** Wishlist toggle + Add to trip (existing or new) + Directions, for place cards. */
export function PlaceQuickActions({ place }: { place: PlaceSummary }) {
  const t = useTranslations("place");
  const locale = useLocale();
  const store = useTravelStore();
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inWishlist = Boolean(store.state.wishlist[place.id]);
  const placeRef = { placeId: place.id, provinceSlug: place.provinceSlug, category: place.category, nameTh: place.nameTh, nameEn: place.nameEn };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const show = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 2200);
  };

  const addTo = async (tripId: string | "new") => {
    setOpen(false);
    if (tripId === "new") {
      const trip = await store.createTrip({ name: localName(place, locale), provinceSlug: place.provinceSlug }, [placeRef]);
      if (trip) show(t("addedToTrip"));
      return;
    }
    show((await store.addTripItem(tripId, placeRef)) ? t("addedToTrip") : t("alreadyInTrip"));
  };

  return (
    <div ref={ref} className="relative z-10 flex items-center gap-1">
      <button
        type="button"
        aria-pressed={inWishlist}
        aria-label={inWishlist ? t("inWishlist") : t("addWishlist")}
        title={inWishlist ? t("inWishlist") : t("addWishlist")}
        onClick={() => (inWishlist ? store.removeWishlist(place.id) : store.addWishlist(placeRef))}
        className={`rounded-full p-2 ${inWishlist ? "bg-want text-white" : "hover:bg-forest-50"}`}
      >
        <Heart className={`h-4 w-4 ${inWishlist ? "fill-white" : ""}`} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("addToTrip")}
        title={t("addToTrip")}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-2 hover:bg-forest-50"
      >
        <ListPlus className="h-4 w-4" aria-hidden="true" />
      </button>
      <a
        href={googleMapsDirectionsUrl(place.lat, place.lng)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("getDirections")}
        title={t("getDirections")}
        className="rounded-full p-2 hover:bg-forest-50"
      >
        <Navigation className="h-4 w-4" aria-hidden="true" />
      </a>
      {open && (
        <div role="menu" className="absolute bottom-full right-0 mb-1 w-56 rounded-xl border border-sage-200 bg-white p-1 shadow-[var(--shadow-lift)]">
          {store.state.trips.slice(0, 8).map((tr) => (
            <button key={tr.id} role="menuitem" type="button" className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-forest-50" onClick={() => addTo(tr.id)}>
              {tr.name}
            </button>
          ))}
          <button role="menuitem" type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-forest-700 hover:bg-forest-50" onClick={() => addTo("new")}>
            + {t("newTrip")}
          </button>
        </div>
      )}
      {flash && (
        <span role="status" className="absolute bottom-full right-0 mb-1 whitespace-nowrap rounded-lg bg-forest-800 px-2 py-1 text-xs text-white">
          {flash}
        </span>
      )}
    </div>
  );
}
