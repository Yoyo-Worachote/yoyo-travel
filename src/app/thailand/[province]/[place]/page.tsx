import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Clock, ExternalLink, Globe, MapPin, Navigation, Ticket, UtensilsCrossed } from "lucide-react";
import { SetChatContext } from "@/components/chat/ChatContext";
import { AskAiButtons } from "@/components/chat/AskAiButtons";
import { PointsMap } from "@/components/map/PointsMap";
import { PlaceActions } from "@/components/place/PlaceActions";
import { DataLabelBadge } from "@/components/ui/DataLabel";
import { cleanAuthor, Photo, PhotoCredit } from "@/components/ui/Photo";
import { getNearbyPlaces, getPlaceBySlug, getProvince } from "@/lib/catalog";
import { altName, formatDate, localName, localText } from "@/lib/display";
import { googleMapsDirectionsUrl, osmUrl } from "@/lib/geo";
import { ensureLiveCatalog } from "@/lib/catalog-live";

type Params = { params: Promise<{ province: string; place: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { province, place } = await params;
  await ensureLiveCatalog();
  const p = getPlaceBySlug(province, place);
  if (!p) return {};
  const locale = await getLocale();
  const prov = getProvince(province);
  return {
    title: `${localName(p, locale)}${prov ? ` · ${localName(prov, locale)}` : ""}`,
    description: localText(p.descriptionTh, p.descriptionEn, locale) ?? undefined,
    alternates: { canonical: `/thailand/${province}/${place}` },
    openGraph: p.image ? { images: [{ url: p.image.url }] } : undefined,
  };
}

export default async function PlacePage({ params }: Params) {
  await ensureLiveCatalog();
  const { province: provinceSlug, place: placeSlug } = await params;
  const place = getPlaceBySlug(provinceSlug, placeSlug);
  const province = getProvince(provinceSlug);
  if (!place || !province) notFound();
  const t = await getTranslations();
  const locale = await getLocale();
  const name = localName(place, locale);
  const alt = altName(place, locale);
  const description = localText(place.descriptionTh, place.descriptionEn, locale);
  const wiki = locale === "en" ? place.wikipediaEn ?? place.wikipediaTh : place.wikipediaTh ?? place.wikipediaEn;
  const nearby = getNearbyPlaces(place, 6);
  const provName = localName(province, locale);

  return (
    <>
      <SetChatContext
        provinceSlug={province.slug}
        placeId={place.id}
        label={`${name} · ${provName}`}
        suggestions={[t("place.aiQ1", { name }), t("place.aiQ2", { name }), t("place.aiQ3", { name })]}
      />
      <div className="container-page pt-6">
        <Link href={`/thailand/${province.slug}`} className="inline-flex items-center gap-1 text-sm text-forest-700 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {provName}
        </Link>
      </div>
      <div className="container-page grid gap-10 pt-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="min-w-0 space-y-6">
          <figure className="overflow-hidden rounded-[var(--radius-card)]">
            <Photo image={place.image} alt={name} className="aspect-[16/10] w-full" priority sizes="(min-width:1024px) 60vw, 100vw" />
            <figcaption className="px-1 pt-2">
              {place.image ? (
                <PhotoCredit
                  image={place.image}
                  labels={{ photoBy: t("common.photoBy", { author: cleanAuthor(place.image.author) }), license: t("common.license", { license: place.image.license }) }}
                />
              ) : (
                <span className="text-xs muted">{t("common.noPhoto")}</span>
              )}
            </figcaption>
          </figure>

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="badge">{t(`categories.${place.category}`)}</span>
              <DataLabelBadge label={place.label ?? "provider"} provider={place.source.provider} />
            </div>
            <h1 className="text-3xl font-bold md:text-4xl">{name}</h1>
            {alt && <p className="mt-1 text-lg muted">{alt}</p>}
            <p className="mt-2 flex items-center gap-1 text-forest-700">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              <Link href={`/thailand/${province.slug}`} className="hover:underline">
                {provName}
              </Link>
              <span className="muted">· {t(`regions.${province.region}`)}</span>
            </p>
          </div>

          <PlaceActions
            shareTitle={name}
            place={{ placeId: place.id, provinceSlug: place.provinceSlug, category: place.category, nameTh: place.nameTh, nameEn: place.nameEn }}
          />

          <section aria-labelledby="desc">
            <h2 id="desc" className="text-xl font-bold">
              {t("place.description")}
            </h2>
            <p className="mt-2">{description ?? <span className="muted">{t("place.noDescription")}</span>}</p>
            {wiki && (
              <a href={wiki} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-forest-700 underline">
                {t("place.wikipedia")} <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </section>

          <AskAiButtons title={t("place.askAi")} questions={[t("place.aiQ1", { name }), t("place.aiQ2", { name }), t("place.aiQ3", { name })]} />
        </div>

        <aside className="space-y-5">
          <dl className="card divide-y divide-sage-100 text-sm">
            <div className="flex gap-3 p-4">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" aria-hidden="true" />
              <div>
                <dt className="font-semibold">{t("place.openingHours")}</dt>
                <dd>
                  {place.openingHours ? (
                    <>
                      <span className="font-mono text-[0.8rem]">{place.openingHours}</span>
                      <span className="block text-xs muted">{t("place.openingHoursOsm")}</span>
                    </>
                  ) : (
                    <span className="muted">{t("place.noOpeningHours")}</span>
                  )}
                </dd>
              </div>
            </div>
            <div className="flex gap-3 p-4">
              <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" aria-hidden="true" />
              <div>
                <dt className="font-semibold">{t("place.price")}</dt>
                <dd>
                  {place.fee === "free" ? t("place.feeFree") : place.fee === "paid" ? t("place.feePaid") : <span className="muted">{t("place.priceUnknown")}</span>}
                </dd>
              </div>
            </div>
            {place.cuisine?.length ? (
              <div className="flex gap-3 p-4">
                <UtensilsCrossed className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" aria-hidden="true" />
                <div>
                  <dt className="font-semibold">{t("place.cuisine")}</dt>
                  <dd>{place.cuisine.join(", ").replace(/_/g, " ")}</dd>
                </div>
              </div>
            ) : null}
            {place.stars ? (
              <div className="flex gap-3 p-4">
                <span className="mt-0.5 w-4 text-center text-gold" aria-hidden="true">★</span>
                <div>
                  <dt className="font-semibold">{t("place.stars")}</dt>
                  <dd>{place.stars}</dd>
                </div>
              </div>
            ) : null}
            {place.website && (
              <div className="flex gap-3 p-4">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="font-semibold">{t("common.website")}</dt>
                  <dd className="truncate">
                    <a href={place.website} target="_blank" rel="noopener noreferrer nofollow" className="text-forest-700 underline">
                      {place.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  </dd>
                </div>
              </div>
            )}
            <div className="flex gap-3 p-4">
              <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" aria-hidden="true" />
              <div>
                <dt className="font-semibold">{t("place.directions")}</dt>
                <dd className="flex flex-col gap-1">
                  <a href={googleMapsDirectionsUrl(place.lat, place.lng)} target="_blank" rel="noopener noreferrer" className="text-forest-700 underline">
                    {t("common.openInMaps")}
                  </a>
                  <a href={osmUrl(place.lat, place.lng)} target="_blank" rel="noopener noreferrer" className="text-forest-700 underline">
                    {t("common.openInOsm")}
                  </a>
                  <span className="text-xs muted">
                    {t("place.coordinates")}: {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
                  </span>
                </dd>
              </div>
            </div>
          </dl>

          <PointsMap
            label={name}
            height={280}
            points={[
              { id: place.id, lat: place.lat, lng: place.lng, label: name, color: "#c4693f" },
              ...nearby.map((n) => ({
                id: n.id,
                lat: n.lat,
                lng: n.lng,
                label: localName(n, locale),
                href: `/thailand/${n.provinceSlug}/${n.slug}`,
              })),
            ]}
          />

          <section className="card p-4 text-sm" aria-labelledby="source">
            <h2 id="source" className="font-bold">
              {t("place.sourceInfo")}
            </h2>
            <dl className="mt-2 space-y-1">
              <div>
                <dt className="inline font-semibold">{t("place.provider")}: </dt>
                <dd className="inline">
                  <a href={place.source.url} target="_blank" rel="noopener noreferrer" className="text-forest-700 underline">
                    {place.source.attribution}
                  </a>{" "}
                  ({place.source.license})
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold">{t("place.fetched")}: </dt>
                <dd className="inline">{formatDate(place.source.fetchedAt, locale)}</dd>
              </div>
            </dl>
          </section>

          {nearby.length > 0 && (
            <section aria-labelledby="nearby">
              <h2 id="nearby" className="text-lg font-bold">
                {t("place.nearby")}
              </h2>
              <ul className="mt-2 space-y-2">
                {nearby.map((n) => (
                  <li key={n.id}>
                    <Link href={`/thailand/${n.provinceSlug}/${n.slug}`} className="card flex items-center justify-between gap-3 px-4 py-3 hover:bg-forest-50">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{localName(n, locale)}</span>
                        <span className="text-xs muted">{t(`categories.${n.category}`)}</span>
                      </span>
                      <span className="shrink-0 text-xs muted">
                        {t("common.km", { km: n.distanceKm.toFixed(1) })} · {t("place.nearbyNote")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
