import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, CalendarDays, Car, ExternalLink } from "lucide-react";
import { SetChatContext } from "@/components/chat/ChatContext";
import { PointsMap } from "@/components/map/PointsMap";
import { PlaceCard } from "@/components/place/PlaceCard";
import { ProvinceActions, ProvinceProgress } from "@/components/province/ProvinceActions";
import { ProvincePlaces, type ProvincePlace } from "@/components/province/ProvincePlaces";
import { cleanAuthor, Photo, PhotoCredit } from "@/components/ui/Photo";
import { getPlacesByProvince, getProvince, toPlaceSummary } from "@/lib/catalog";
import { altName, formatDate, localName, localText } from "@/lib/display";
import { BANGKOK, haversineKm } from "@/lib/geo";
import { topBySitelinks } from "@/lib/rankings";
import { provinceSeasonKey, TMD_CLIMATE_URL } from "@/lib/seasons";
import { KIND_ORDER } from "@/lib/categories";
import { ensureLiveCatalog } from "@/lib/catalog-live";

type Params = { params: Promise<{ province: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { province } = await params;
  const p = getProvince(province);
  if (!p) return {};
  const locale = await getLocale();
  const summary = localText(p.summaryTh, p.summaryEn, locale);
  return {
    title: `${localName(p, locale)} (${altName(p, locale) ?? ""})`,
    description: summary?.slice(0, 160),
    alternates: { canonical: `/thailand/${p.slug}` },
    openGraph: p.image ? { images: [{ url: p.image.url }] } : undefined,
  };
}

export default async function ProvincePage({ params }: Params) {
  await ensureLiveCatalog();
  const { province: slug } = await params;
  const province = getProvince(slug);
  if (!province) notFound();
  const t = await getTranslations();
  const locale = await getLocale();
  const name = localName(province, locale);
  const places = getPlacesByProvince(slug);
  const highlights = topBySitelinks(4, { provinceSlug: slug, requireImage: true });
  const summary = localText(province.summaryTh, province.summaryEn, locale);
  const summaryUrl = locale === "en" ? province.summaryEnUrl ?? province.summaryThUrl : province.summaryThUrl ?? province.summaryEnUrl;
  const km = Math.round(haversineKm(BANGKOK, province.centroid));
  const seasonKey = provinceSeasonKey(slug, province.region);

  const sorted = [...places].sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      (b.wikiSitelinks ?? 0) - (a.wikiSitelinks ?? 0) ||
      Number(!!b.image) - Number(!!a.image),
  );
  const clientPlaces: ProvincePlace[] = sorted.map((p) => ({
    ...toPlaceSummary(p),
    cuisine: p.cuisine ?? null,
    openingHours: p.openingHours ?? null,
  }));

  return (
    <>
      <SetChatContext
        provinceSlug={slug}
        label={name}
        suggestions={[t("place.aiQ1", { name }), t("place.aiQ2", { name }), t("place.aiQ3", { name })]}
      />
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Photo image={province.image} alt="" className="h-full w-full" priority sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-900/95 via-forest-900/55 to-forest-900/25" />
        </div>
        <div className="container-page flex min-h-[420px] flex-col justify-end gap-4 py-10 text-white">
          <Link href="/explore" className="inline-flex w-fit items-center gap-1 text-sm text-forest-100 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("nav.explore")}
          </Link>
          <p className="text-sm font-semibold uppercase tracking-widest text-gold">{t(`regions.${province.region}`)}</p>
          <h1 className="text-4xl font-bold text-white md:text-5xl">{name}</h1>
          <p className="text-lg text-forest-100">{altName(province, locale)}</p>
          <div className="mt-2">
            <ProvinceActions slug={slug} name={name} />
          </div>
          {province.image && (
            <PhotoCredit
              compact
              image={province.image}
              className="!text-forest-200"
              labels={{ photoBy: t("common.photoBy", { author: cleanAuthor(province.image.author) }), license: province.image.license }}
            />
          )}
        </div>
      </section>

      <div className="container-page grid gap-10 pt-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-12">
          <section aria-labelledby="about">
            <h2 id="about" className="section-title mb-3">
              {t("province.about")}
            </h2>
            {summary ? (
              <>
                <p className="leading-relaxed">{summary}</p>
                {summaryUrl && (
                  <a href={summaryUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-forest-700 underline">
                    {t("province.summarySource")} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </>
            ) : (
              <p className="muted">{t("province.noSummary")}</p>
            )}
          </section>

          {highlights.length > 0 && (
            <section aria-labelledby="highlights">
              <h2 id="highlights" className="section-title mb-1">
                {t("province.highlights")}
              </h2>
              <p className="mb-4 text-sm muted">{t("top.attractionsBasis")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {highlights.map((p) => (
                  <PlaceCard key={p.id} place={toPlaceSummary(p)} />
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="places">
            <h2 id="places" className="section-title mb-1">
              {t("province.placesTitle", { name })}
            </h2>
            <p className="mb-4 text-sm muted">{t("province.coverageNote")}</p>
            <ProvincePlaces places={clientPlaces} />
          </section>

          <section aria-labelledby="map">
            <h2 id="map" className="section-title mb-4">
              {t("province.mapTitle")}
            </h2>
            <PointsMap
              label={t("province.mapTitle")}
              bbox={province.bbox}
              height={420}
              points={sorted.slice(0, 150).map((p) => ({
                id: p.id,
                lat: p.lat,
                lng: p.lng,
                label: localName(p, locale),
                href: `/thailand/${slug}/${p.slug}`,
                color: p.kind === "attraction" ? "#234f39" : p.kind === "accommodation" ? "#c99a3b" : "#c4693f",
              }))}
            />
          </section>
        </div>

        <aside className="space-y-5">
          <ProvinceProgress slug={slug} placeIds={places.map((p) => p.id)} />
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <CalendarDays className="h-5 w-5 text-forest-600" aria-hidden="true" /> {t("province.bestSeason")}
            </h2>
            <p className="mt-2 text-sm">{t(`seasons.${seasonKey}`)}</p>
            <p className="mt-2 text-xs muted">
              {t("province.seasonNote")}{" "}
              <a href={TMD_CLIMATE_URL} target="_blank" rel="noopener noreferrer" className="underline">
                {t("seasons.source")}
              </a>
            </p>
          </div>
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Car className="h-5 w-5 text-forest-600" aria-hidden="true" /> {t("province.transport")}
            </h2>
            {slug !== "bangkok" && <p className="mt-2 text-sm">{t("province.distanceFromBkk", { km })}</p>}
            <p className="mt-2 text-sm muted">{t("province.costUnknown")}</p>
          </div>
          <div className="card p-5">
            <h2 className="text-lg font-bold">{t("province.usefulLinks")}</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {province.summaryThUrl && (
                <li>
                  <a className="text-forest-700 underline" href={province.summaryThUrl} target="_blank" rel="noopener noreferrer">
                    Wikipedia (ไทย)
                  </a>
                </li>
              )}
              {province.summaryEnUrl && (
                <li>
                  <a className="text-forest-700 underline" href={province.summaryEnUrl} target="_blank" rel="noopener noreferrer">
                    Wikipedia (English)
                  </a>
                </li>
              )}
              <li>
                <a className="text-forest-700 underline" href={`https://www.wikidata.org/wiki/${province.wikidataId}`} target="_blank" rel="noopener noreferrer">
                  Wikidata {province.wikidataId}
                </a>
              </li>
            </ul>
            <p className="mt-3 text-xs muted">{t("common.lastChecked", { date: formatDate(province.fetchedAt, locale) })}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
