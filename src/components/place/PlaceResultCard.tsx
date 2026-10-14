"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { BedDouble, Bus, Coffee, Landmark, Ticket, UtensilsCrossed } from "lucide-react";
import { Photo } from "@/components/ui/Photo";
import { altName, formatBaht, localName } from "@/lib/display";
import type { PlaceSummary } from "@/lib/types";
import { PlaceQuickActions } from "./PlaceQuickActions";
import { PlaceStatusBadge } from "./PlaceStatusBadge";

const ICONS = {
  restaurant: UtensilsCrossed,
  cafe: Coffee,
  accommodation: BedDouble,
  activity: Ticket,
  attraction: Landmark,
  transport: Bus,
} as const;

/** Card for /places results: photo (or icon), category, province, sourced price status, quick actions. */
export function PlaceResultCard({ place, provinceName }: { place: PlaceSummary; provinceName?: string }) {
  const locale = useLocale();
  const t = useTranslations();
  const Icon = ICONS[place.kind] ?? Landmark;
  const name = localName(place, locale);
  const price =
    place.fee === "free" && place.priceMin === 0
      ? t("places.free")
      : place.priceType === "exact" || place.priceType === "range"
        ? `${place.priceType === "range" ? t("places.from") + " " : ""}${formatBaht(place.priceMin ?? 0, locale)}`
        : null;
  return (
    <article className="card group relative flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[16/10] overflow-hidden">
        {place.image ? (
          <Photo image={place.image} alt={name} className="h-full w-full transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-sage-100 via-forest-50 to-cream-200 text-forest-600" aria-hidden="true">
            <Icon className="h-10 w-10" strokeWidth={1.4} />
          </div>
        )}
        <span className="absolute left-3 top-3 badge bg-white/90 text-forest-800 backdrop-blur">{t(`categories.${place.category}`)}</span>
        <PlaceStatusBadge placeId={place.id} />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-semibold leading-snug">
          <Link href={`/thailand/${place.provinceSlug}/${place.slug}`} className="after:absolute after:inset-0 hover:underline">
            {name}
          </Link>
        </h3>
        {altName(place, locale) && <p className="line-clamp-1 text-sm muted">{altName(place, locale)}</p>}
        {provinceName && <p className="text-sm text-forest-600">{provinceName}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className={`text-xs ${price ? "font-semibold text-forest-800" : "muted"}`}>{price ?? t("places.noPrice")}</span>
          <PlaceQuickActions place={place} />
        </div>
      </div>
    </article>
  );
}
