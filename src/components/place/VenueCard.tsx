import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { BedDouble, Clock, Coffee, Ticket, UtensilsCrossed } from "lucide-react";
import { localName, altName } from "@/lib/display";
import type { PlaceSummary } from "@/lib/types";

const ICONS = {
  restaurant: UtensilsCrossed,
  cafe: Coffee,
  accommodation: BedDouble,
  activity: Ticket,
  attraction: Ticket,
} as const;

/** Compact card for venues that usually have no licensed photo (OSM POIs). */
export function VenueCard({
  place,
  provinceName,
  cuisine,
  openingHours,
}: {
  place: PlaceSummary;
  provinceName?: string;
  cuisine?: string[] | null;
  openingHours?: string | null;
}) {
  const locale = useLocale();
  const t = useTranslations();
  const Icon = ICONS[place.kind];
  return (
    <article className="card relative flex h-full items-start gap-3 p-4 transition hover:shadow-[var(--shadow-lift)]">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold leading-snug">
          <Link href={`/thailand/${place.provinceSlug}/${place.slug}`} className="after:absolute after:inset-0 hover:underline">
            {localName(place, locale)}
          </Link>
        </h3>
        {altName(place, locale) && <p className="truncate text-sm muted">{altName(place, locale)}</p>}
        <p className="mt-1 text-xs text-forest-600">
          {t(`categories.${place.category}`)}
          {provinceName ? ` · ${provinceName}` : ""}
        </p>
        {cuisine?.length ? <p className="mt-1 text-xs muted">{cuisine.join(", ").replace(/_/g, " ")}</p> : null}
        {openingHours && (
          <p className="mt-1 flex items-center gap-1 text-xs muted">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span className="truncate">{openingHours}</span>
          </p>
        )}
      </div>
    </article>
  );
}
