import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Info } from "lucide-react";
import { Photo } from "@/components/ui/Photo";
import { getProvince, getProvinces } from "@/lib/catalog";
import { formatDate, localName } from "@/lib/display";
import { freePlaces, rankingAsOf, seasonalPicks, topBySitelinks, topProvincesByAttractions } from "@/lib/rankings";
import { bangkokMonth, seasonOfMonth, TMD_CLIMATE_URL } from "@/lib/seasons";
import type { Place } from "@/lib/types";
import { ensureLiveCatalog } from "@/lib/catalog-live";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("top");
  return { title: t("title"), description: t("subtitle") };
}

type SP = { searchParams: Promise<{ province?: string; time?: string }> };

export default async function TopPage({ searchParams }: SP) {
  await ensureLiveCatalog();
  const { province: provinceParam, time } = await searchParams;
  const t = await getTranslations();
  const locale = await getLocale();
  const asOf = rankingAsOf();
  const month = bangkokMonth();
  const seasonMode = time === "season";
  const pName = (slug: string) => {
    const p = getProvince(slug);
    return p ? localName(p, locale) : slug;
  };
  const selectedProvince = provinceParam && getProvince(provinceParam) ? provinceParam : null;

  const RankedPlaces = ({ items, metric = true }: { items: Place[]; metric?: boolean }) =>
    items.length === 0 ? (
      <p className="text-sm muted">{t("common.noResults")}</p>
    ) : (
      <ol className="space-y-2">
        {items.map((p, i) => (
          <li key={p.id}>
            <Link href={`/thailand/${p.provinceSlug}/${p.slug}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-forest-50">
              <span className="w-7 shrink-0 text-center text-lg font-bold text-forest-600">{i + 1}</span>
              <Photo image={p.image} alt="" className="h-12 w-12 shrink-0 rounded-lg" sizes="48px" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{localName(p, locale)}</span>
                <span className="block truncate text-xs muted">
                  {pName(p.provinceSlug)} · {t(`categories.${p.category}`)}
                </span>
              </span>
              {metric && p.wikiSitelinks != null && <span className="shrink-0 text-xs muted">{t("top.sitelinks", { count: p.wikiSitelinks })}</span>}
            </Link>
          </li>
        ))}
      </ol>
    );

  const Block = ({ id, title, basis, children, label }: { id: string; title: string; basis: string; children: React.ReactNode; label: string }) => (
    <section aria-labelledby={id} className="card min-w-0 p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 id={id} className="text-lg font-bold">
          {title}
        </h2>
        <span className="badge">{label}</span>
      </div>
      <p className="mb-4 text-xs muted">
        <strong>{t("top.basis")}:</strong> {basis}
        {asOf ? ` · ${t("top.asOf", { date: formatDate(asOf, locale) })}` : ""}
      </p>
      {children}
    </section>
  );

  const dataLabel = t("labels.provider");
  const seasonal = seasonalPicks(month, 10);

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold md:text-4xl">{t("top.title")}</h1>
      <p className="mt-1 muted">{t("top.subtitle")}</p>

      <nav className="mt-6 flex flex-wrap items-center gap-2" aria-label="time">
        <Link href="/top" className="chip" data-active={!seasonMode}>
          {t("top.timeAllTime")}
        </Link>
        <Link href="/top?time=season" className="chip" data-active={seasonMode}>
          {t("top.timeSeason")}
        </Link>
        <span className="text-xs muted">{t("top.timeNote")}</span>
      </nav>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-sage-100 px-4 py-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-forest-700" aria-hidden="true" /> {t("top.trendingNone")}
      </p>

      {seasonMode ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Block id="seasonal" title={t("top.seasonal")} basis={t("top.seasonalBasis")} label={t(`seasons.${seasonOfMonth(month)}`)}>
            <RankedPlaces items={seasonal} />
            <a href={TMD_CLIMATE_URL} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs underline">
              {t("seasons.source")}
            </a>
          </Block>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Block id="tp" title={t("top.provinces")} basis={t("top.provincesBasis")} label={dataLabel}>
            <ol className="space-y-2">
              {topProvincesByAttractions(10).map(({ province, count }, i) => (
                <li key={province.slug}>
                  <Link href={`/thailand/${province.slug}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-forest-50">
                    <span className="w-7 text-center text-lg font-bold text-forest-600">{i + 1}</span>
                    <Photo image={province.image} alt="" className="h-12 w-12 shrink-0 rounded-lg" sizes="48px" />
                    <span className="flex-1 font-semibold">{localName(province, locale)}</span>
                    <span className="text-xs muted">{t("common.places", { count })}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </Block>
          <Block id="ta" title={t("top.attractions")} basis={t("top.attractionsBasis")} label={dataLabel}>
            <RankedPlaces items={topBySitelinks(10)} />
          </Block>
          <Block id="tc-culture" title={`${t("groups.culture")} — Top 10`} basis={t("top.attractionsBasis")} label={dataLabel}>
            <RankedPlaces items={topBySitelinks(10, { categories: ["temple", "history", "museum"] })} />
          </Block>
          <Block id="tc-nature" title={`${t("groups.nature")} — Top 10`} basis={t("top.attractionsBasis")} label={dataLabel}>
            <RankedPlaces items={topBySitelinks(10, { categories: ["national_park", "waterfall", "mountain", "cave", "nature"] })} />
          </Block>
          <Block id="tc-beach" title={`${t("groups.beach")} — Top 10`} basis={t("top.attractionsBasis")} label={dataLabel}>
            <RankedPlaces items={topBySitelinks(10, { categories: ["beach", "island"] })} />
          </Block>
          <Block id="family" title={t("top.family")} basis={t("top.familyBasis")} label={t("labels.estimated")}>
            <RankedPlaces items={topBySitelinks(10, { categories: ["park", "activity", "museum"] })} />
          </Block>
          <Block id="couples" title={t("top.couples")} basis={t("top.couplesBasis")} label={t("labels.estimated")}>
            <RankedPlaces items={topBySitelinks(10, { categories: ["beach", "island", "viewpoint", "mountain"] })} />
          </Block>
          <Block id="free" title={t("top.free")} basis={t("top.freeBasis")} label={dataLabel}>
            <RankedPlaces items={freePlaces(10)} metric={false} />
          </Block>
          <Block id="seasonal" title={t("top.seasonal")} basis={t("top.seasonalBasis")} label={t(`seasons.${seasonOfMonth(month)}`)}>
            <RankedPlaces items={seasonal} />
          </Block>
          <section className="card min-w-0 p-5" aria-labelledby="rest">
            <h2 id="rest" className="mb-2 text-lg font-bold">
              {t("top.restaurants")}
            </h2>
            <p className="text-sm muted">{t("top.restaurantsNone")}</p>
          </section>
        </div>
      )}

      <section aria-labelledby="perprov" className="card mt-8 p-5">
        <h2 id="perprov" className="text-lg font-bold">
          {t("top.perProvince")}
        </h2>
        <p className="mb-3 text-xs muted">{t("top.perProvinceHint")}</p>
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          <label htmlFor="tp-prov" className="sr-only">
            {t("random.province")}
          </label>
          <select id="tp-prov" name="province" defaultValue={selectedProvince ?? ""} className="input !w-auto">
            <option value="">—</option>
            {[...getProvinces()]
              .sort((a, b) => localName(a, locale).localeCompare(localName(b, locale), locale))
              .map((p) => (
                <option key={p.slug} value={p.slug}>
                  {localName(p, locale)}
                </option>
              ))}
          </select>
          <button type="submit" className="btn btn-primary btn-sm">
            {t("common.viewDetails")}
          </button>
        </form>
        {selectedProvince && <RankedPlaces items={topBySitelinks(10, { provinceSlug: selectedProvince })} />}
      </section>
    </div>
  );
}
