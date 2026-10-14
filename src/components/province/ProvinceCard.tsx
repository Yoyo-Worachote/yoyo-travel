import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Photo } from "@/components/ui/Photo";
import { localName, altName } from "@/lib/display";
import type { ProvinceSummary } from "@/lib/types";
import { ProvinceStatusBadge } from "./ProvinceStatusBadge";

export function ProvinceCard({ province, note }: { province: ProvinceSummary; note?: string }) {
  const locale = useLocale();
  const t = useTranslations();
  const name = localName(province, locale);
  return (
    <article className="card group relative h-full overflow-hidden">
      <div className="relative aspect-[3/4] sm:aspect-[4/5] overflow-hidden">
        <Photo image={province.image} alt={name} className="h-full w-full transition duration-500 group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-900/85 via-forest-900/20 to-transparent" />
        <ProvinceStatusBadge slug={province.slug} />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-xs uppercase tracking-wider text-forest-100">{t(`regions.${province.region}`)}</p>
          <h3 className="text-xl font-bold text-white">
            <Link href={`/thailand/${province.slug}`} className="after:absolute after:inset-0">
              {name}
            </Link>
          </h3>
          <p className="text-sm text-forest-100">{altName(province, locale)}</p>
          {note && <p className="mt-1 text-xs text-forest-200">{note}</p>}
        </div>
      </div>
    </article>
  );
}
