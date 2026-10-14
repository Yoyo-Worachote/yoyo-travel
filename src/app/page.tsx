import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Dices, MapPin, Route, Search, Sun } from "lucide-react";
import { ThailandMap } from "@/components/map/ThailandMap";
import { PlaceCard } from "@/components/place/PlaceCard";
import { VenueCard } from "@/components/place/VenueCard";
import { ProvinceCard } from "@/components/province/ProvinceCard";
import { PassportTeaser } from "@/components/passport/PassportTeaser";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cleanAuthor, Photo, PhotoCredit } from "@/components/ui/Photo";
import { getProvince, getProvinceSummaries, toPlaceSummary } from "@/lib/catalog";
import { localName, formatDate } from "@/lib/display";
import { rankingAsOf, sampleVenues, seasonalPicks, topBySitelinks, topProvincesByAttractions } from "@/lib/rankings";
import { bangkokMonth, seasonOfMonth, seasonTipKey, TMD_CLIMATE_URL } from "@/lib/seasons";
import { ensureLiveCatalog } from "@/lib/catalog-live";

export default async function HomePage() {
  await ensureLiveCatalog();
  const t = await getTranslations();
  const locale = await getLocale();
  const provinces = getProvinceSummaries();
  const pName = (slug: string) => {
    const p = getProvince(slug);
    return p ? localName(p, locale) : slug;
  };

  const curated = topBySitelinks(8, { requireImage: true });
  const hero = curated.find((p) => p.image && (p.image.width ?? 0) > (p.image.height ?? 0)) ?? curated[0];
  const popular = topProvincesByAttractions(8);
  const month = bangkokMonth();
  const season = seasonOfMonth(month);
  const seasonal = seasonalPicks(month, 8);
  const food = sampleVenues(["restaurant", "cafe"], 8);
  const stays = sampleVenues(["accommodation", "activity"], 8);
  const asOf = rankingAsOf();

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Photo image={hero?.image ?? null} alt="" className="h-full w-full" priority sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-r from-forest-900/90 via-forest-900/65 to-forest-900/20" />
        </div>
        <div className="container-page flex min-h-[520px] flex-col justify-center gap-6 py-16 text-white md:min-h-[600px]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">{t("meta.tagline")}</p>
          <h1 className="max-w-3xl text-4xl font-bold text-white md:text-6xl">{t("home.heroTitle")}</h1>
          <p className="max-w-2xl text-lg text-forest-100">{t("home.heroSubtitle")}</p>
          <form action="/search" method="get" role="search" className="flex w-full max-w-2xl gap-2 rounded-full bg-white p-1.5 shadow-[var(--shadow-lift)]">
            <label htmlFor="hero-search" className="sr-only">
              {t("nav.search")}
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-sage-500" aria-hidden="true" />
              <input
                id="hero-search"
                name="q"
                type="search"
                maxLength={100}
                placeholder={t("home.searchPlaceholder")}
                className="h-12 w-full rounded-full bg-transparent pl-12 pr-3 text-charcoal outline-none placeholder:text-sage-500"
              />
            </div>
            <button type="submit" className="btn btn-primary h-12 px-6">
              {t("nav.search")}
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            <Link href="/random?tab=province" className="btn bg-white/15 text-white backdrop-blur hover:bg-white/25">
              <MapPin className="h-4 w-4" aria-hidden="true" /> {t("home.randomProvince")}
            </Link>
            <Link href="/random?tab=place" className="btn bg-white/15 text-white backdrop-blur hover:bg-white/25">
              <Dices className="h-4 w-4" aria-hidden="true" /> {t("home.randomPlace")}
            </Link>
            <Link href="/random?tab=trip" className="btn btn-accent">
              <Route className="h-4 w-4" aria-hidden="true" /> {t("home.randomTrip")}
            </Link>
          </div>
          {hero?.image && (
            <PhotoCredit
              compact
              image={hero.image}
              className="!text-forest-200 mt-4"
              labels={{
                photoBy: `${localName(hero, locale)} — ${t("common.photoBy", { author: cleanAuthor(hero.image.author) })}`,
                license: hero.image.license,
              }}
            />
          )}
        </div>
      </section>

      <div className="container-page space-y-16 pt-12">
        {/* Passport teaser */}
        <PassportTeaser provinces={provinces.map((p) => ({ slug: p.slug, region: p.region }))} />

        {/* Map */}
        <section aria-labelledby="map-title">
          <SectionHeader id="map-title" title={t("home.mapTitle")} subtitle={t("home.mapSubtitle")} href="/explore" linkLabel={t("common.seeAll")} />
          <ThailandMap provinces={provinces} height="clamp(380px, 62vh, 620px)" />
        </section>

        {/* Popular provinces */}
        <section aria-labelledby="popular-title">
          <SectionHeader id="popular-title" title={t("home.popularTitle")} subtitle={t("home.popularBasis")} href="/top" linkLabel={t("common.seeAll")} />
          <div className="scroll-row">
            {popular.map(({ province, count }) => (
              <ProvinceCard
                key={province.slug}
                province={provinces.find((p) => p.slug === province.slug)!}
                note={t("explore.placesInData", { count })}
              />
            ))}
          </div>
        </section>

        {/* Curated destinations */}
        <section aria-labelledby="curated-title">
          <SectionHeader
            id="curated-title"
            title={t("home.curatedTitle")}
            subtitle={`${t("home.curatedBasis")}${asOf ? ` · ${t("top.asOf", { date: formatDate(asOf, locale) })}` : ""}`}
            href="/top"
            linkLabel={t("common.seeAll")}
          />
          <div className="scroll-row">
            {curated.map((p) => (
              <PlaceCard key={p.id} place={toPlaceSummary(p)} provinceName={pName(p.provinceSlug)} />
            ))}
          </div>
        </section>

        {/* Seasonal */}
        <section aria-labelledby="season-title" className="rounded-[2rem] bg-sage-100/70 p-6 md:p-10">
          <div className="mb-6 flex flex-wrap items-start gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-gold">
              <Sun className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="max-w-3xl">
              <h2 id="season-title" className="section-title">
                {t("home.seasonalTitle")}
              </h2>
              <p className="mt-1 font-semibold text-forest-800">
                {t("seasons.currentSeason", { season: t(`seasons.${season}`) })}
              </p>
              <p className="text-sm muted">{t(`seasons.${seasonTipKey(season)}`)}</p>
              <p className="mt-1 text-xs muted">
                {t("top.seasonalBasis")} ·{" "}
                <a href={TMD_CLIMATE_URL} target="_blank" rel="noopener noreferrer" className="underline">
                  {t("seasons.source")}
                </a>
              </p>
            </div>
          </div>
          <div className="scroll-row">
            {seasonal.map((p) => (
              <PlaceCard key={p.id} place={toPlaceSummary(p)} provinceName={pName(p.provinceSlug)} />
            ))}
          </div>
        </section>

        {/* Food */}
        <section aria-labelledby="food-title">
          <SectionHeader id="food-title" title={t("home.foodTitle")} subtitle={t("home.foodBasis")} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {food.map((p) => (
              <VenueCard key={p.id} place={toPlaceSummary(p)} provinceName={pName(p.provinceSlug)} cuisine={p.cuisine} openingHours={p.openingHours} />
            ))}
          </div>
        </section>

        {/* Stays & activities */}
        <section aria-labelledby="stay-title">
          <SectionHeader id="stay-title" title={t("home.stayTitle")} subtitle={t("home.foodBasis")} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stays.map((p) => (
              <VenueCard key={p.id} place={toPlaceSummary(p)} provinceName={pName(p.provinceSlug)} openingHours={p.openingHours} />
            ))}
          </div>
        </section>

        <p className="text-center text-sm muted">{t("home.dataNote")}</p>
      </div>
    </>
  );
}
