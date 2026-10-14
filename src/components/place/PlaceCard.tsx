import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { cleanAuthor, Photo, PhotoCredit } from "@/components/ui/Photo";
import { localName, altName } from "@/lib/display";
import type { PlaceSummary } from "@/lib/types";
import { PlaceStatusBadge } from "./PlaceStatusBadge";

export function PlaceCard({
  place,
  provinceName,
  extra,
}: {
  place: PlaceSummary;
  provinceName?: string;
  extra?: React.ReactNode;
}) {
  const locale = useLocale();
  const t = useTranslations();
  const name = localName(place, locale);
  const alt = altName(place, locale);
  return (
    <article className="card group relative flex h-full flex-col overflow-hidden transition hover:shadow-[var(--shadow-lift)]">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Photo
          image={place.image}
          alt={name}
          className="h-full w-full transition duration-500 group-hover:scale-[1.03]"
        />
        <span className="absolute left-3 top-3 badge bg-white/90 text-forest-800 backdrop-blur">
          {t(`categories.${place.category}`)}
        </span>
        <PlaceStatusBadge placeId={place.id} />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-base font-semibold leading-snug">
          <Link href={`/thailand/${place.provinceSlug}/${place.slug}`} className="after:absolute after:inset-0 hover:underline">
            {name}
          </Link>
        </h3>
        {alt && <p className="text-sm muted line-clamp-1">{alt}</p>}
        {provinceName && <p className="text-sm text-forest-600">{provinceName}</p>}
        {extra}
        {place.image && (
          <PhotoCredit
            compact
            className="relative z-10 mt-auto pt-2"
            image={place.image}
            labels={{
              photoBy: t("common.photoBy", { author: cleanAuthor(place.image.author) }),
              license: place.image.license,
            }}
          />
        )}
      </div>
    </article>
  );
}
