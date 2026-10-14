"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BedDouble,
  Bus,
  Coffee,
  Hotel,
  Landmark,
  List,
  Loader2,
  LocateFixed,
  Map as MapIcon,
  Mountain,
  Search,
  ShoppingBag,
  Tent,
  Ticket,
  UtensilsCrossed,
} from "lucide-react";
import { PointsMap } from "@/components/map/PointsMap";
import { PlaceResultCard } from "@/components/place/PlaceResultCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import { AMENITIES, EXPLORE_CATEGORY_IDS, type ExploreCategory } from "@/lib/categories";
import { altName, localName } from "@/lib/display";
import type { ImageInfo, PlaceSummary, RegionId } from "@/lib/types";

const CAT_ICONS: Record<ExploreCategory, typeof Landmark> = {
  attractions: Landmark,
  restaurants: UtensilsCrossed,
  cafes: Coffee,
  hotels: Hotel,
  resorts: BedDouble,
  hostels: Tent,
  activities: Ticket,
  nature: Mountain,
  shopping: ShoppingBag,
  transport: Bus,
};
const PAGE = 24;

interface ProvinceHit {
  slug: string;
  nameTh: string;
  nameEn: string;
  region: RegionId;
  image: ImageInfo | null;
}
interface Result {
  provinces: ProvinceHit[];
  places: PlaceSummary[];
  total: number;
  ratingAvailable: boolean;
}

export function PlacesExplorer({ provinces }: { provinces: Array<{ slug: string; nameTh: string; nameEn: string }> }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const { state } = useTravelStore();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState<ExploreCategory | "">((params.get("category") as ExploreCategory) || "");
  const [province, setProvince] = useState(params.get("province") ?? "");
  const [price, setPrice] = useState(params.get("price") ?? "any");
  const [sort, setSort] = useState(params.get("sort") ?? "recommended");
  const [amenities, setAmenities] = useState<string[]>(params.get("amenities")?.split(",").filter(Boolean) ?? []);
  const [status, setStatus] = useState<"all" | "visited" | "unvisited" | "wishlist">("all");
  const [view, setView] = useState<"list" | "map">(params.get("view") === "map" ? "map" : "list");
  const [page, setPage] = useState(Math.max(1, Number(params.get("page")) || 1));
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reqId = useRef(0);
  const firstRender = useRef(true);

  const filterKey = `${q}|${category}|${province}|${price}|${sort}|${amenities.join(",")}|${coords?.lat ?? ""}`;
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError(false);
    const h = setTimeout(async () => {
      const sp = new URLSearchParams({ q, price, sort, locale, offset: String((page - 1) * PAGE), limit: String(view === "map" ? 60 : PAGE) });
      if (category) sp.set("category", category);
      if (province) sp.set("province", province);
      if (amenities.length) sp.set("amenities", amenities.join(","));
      if (coords) {
        sp.set("lat", String(coords.lat));
        sp.set("lng", String(coords.lng));
      }
      try {
        const res = await fetch(`/api/search?${sp}`);
        if (!res.ok) throw new Error();
        const json = (await res.json()) as Result;
        if (id === reqId.current) setData(json);
      } catch {
        if (id === reqId.current) setError(true);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
      const url = new URLSearchParams();
      if (q) url.set("q", q);
      if (category) url.set("category", category);
      if (province) url.set("province", province);
      if (price !== "any") url.set("price", price);
      if (sort !== "recommended") url.set("sort", sort);
      if (amenities.length) url.set("amenities", amenities.join(","));
      if (view === "map") url.set("view", "map");
      if (page > 1) url.set("page", String(page));
      router.replace(`/places${url.toString() ? `?${url}` : ""}`, { scroll: false });
    }, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, page, view, attempt, locale]);

  const pName = (slug: string) => {
    const p = provinces.find((x) => x.slug === slug);
    return p ? localName(p, locale) : slug;
  };
  const places = useMemo(
    () =>
      (data?.places ?? []).filter((p) =>
        status === "all" ? true : status === "visited" ? !!state.visits[p.id] : status === "unvisited" ? !state.visits[p.id] : !!state.wishlist[p.id],
      ),
    [data, status, state],
  );
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;
  const sortedProvinces = useMemo(
    () => [...provinces].sort((a, b) => localName(a, locale).localeCompare(localName(b, locale), locale)),
    [provinces, locale],
  );
  const clearAll = () => {
    setQ("");
    setCategory("");
    setProvince("");
    setPrice("any");
    setSort("recommended");
    setAmenities([]);
    setStatus("all");
    setCoords(null);
  };
  const locate = () => {
    if (!("geolocation" in navigator)) return setGeoMsg(t("search.locationDenied"));
    setGeoMsg(t("search.nearMeAsk"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoMsg(null);
        setProvince("");
        setCoords({ lat: Math.round(pos.coords.latitude * 1000) / 1000, lng: Math.round(pos.coords.longitude * 1000) / 1000 });
      },
      () => setGeoMsg(t("search.locationDenied")),
      { timeout: 10000, maximumAge: 300000 },
    );
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-sage-500" aria-hidden="true" />
        <label htmlFor="places-q" className="sr-only">
          {t("places.searchLabel")}
        </label>
        <input
          id="places-q"
          type="search"
          value={q}
          maxLength={100}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("places.searchPlaceholder")}
          className="input h-14 rounded-full pl-12 text-lg"
        />
      </div>

      <nav aria-label={t("places.categories")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button type="button" className="chip shrink-0" aria-pressed={!category} onClick={() => setCategory("")}>
          {t("common.all")}
        </button>
        {EXPLORE_CATEGORY_IDS.map((c) => {
          const Icon = CAT_ICONS[c];
          return (
            <button key={c} type="button" className="chip shrink-0" aria-pressed={category === c} onClick={() => setCategory(category === c ? "" : c)}>
              <Icon className="h-4 w-4" aria-hidden="true" /> {t(`places.cat.${c}`)}
            </button>
          );
        })}
      </nav>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="f-prov" className="label">
            {t("random.province")}
          </label>
          <select
            id="f-prov"
            className="input"
            value={province}
            onChange={(e) => {
              setCoords(null);
              setProvince(e.target.value);
            }}
          >
            <option value="">{t("random.anyProvince")}</option>
            {sortedProvinces.map((p) => (
              <option key={p.slug} value={p.slug}>
                {localName(p, locale)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-price" className="label">
            {t("places.price")}
          </label>
          <select id="f-price" className="input" value={price} onChange={(e) => setPrice(e.target.value)}>
            <option value="any">{t("places.priceAny")}</option>
            <option value="free">{t("places.priceFree")}</option>
            <option value="priced">{t("places.pricePriced")}</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-rating" className="label">
            {t("places.rating")}
          </label>
          <select id="f-rating" className="input" disabled aria-describedby="rating-note">
            <option>{t("places.ratingUnavailable")}</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-status" className="label">
            {t("search.status")}
          </label>
          <select id="f-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">{t("search.statusAll")}</option>
            <option value="visited">{t("search.statusVisited")}</option>
            <option value="unvisited">{t("search.statusUnvisited")}</option>
            <option value="wishlist">{t("search.statusWishlist")}</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-sort" className="label">
            {t("places.sort")}
          </label>
          <select id="f-sort" className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recommended">{t("places.sortRecommended")}</option>
            <option value="name">{t("places.sortName")}</option>
            <option value="price">{t("places.sortPrice")}</option>
            <option value="rating" disabled>
              {t("places.sortRating")}
            </option>
          </select>
        </div>
      </div>
      <p id="rating-note" className="-mt-3 text-xs muted">
        {t("places.ratingNote")}
      </p>

      <fieldset>
        <legend className="label">{t("places.amenities")}</legend>
        <div className="flex flex-wrap gap-1.5">
          {AMENITIES.map((a) => (
            <button
              key={a}
              type="button"
              className="chip !px-3 !py-1 text-xs"
              aria-pressed={amenities.includes(a)}
              onClick={() => setAmenities(amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a])}
            >
              {t(`amenity.${a}`)}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs muted">{t("places.amenitiesNote")}</p>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold" aria-live="polite">
            {data ? t("search.results", { count: data.total }) : ""}
          </span>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-forest-600" aria-label={t("common.loading")} />}
          <button type="button" className="btn btn-ghost btn-sm" aria-pressed={!!coords} onClick={() => (coords ? setCoords(null) : locate())}>
            <LocateFixed className="h-4 w-4" aria-hidden="true" /> {t("search.nearMe")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>
            {t("common.clearFilters")}
          </button>
        </div>
        <div className="inline-flex rounded-full border border-sage-200 bg-white p-0.5 text-sm" role="group" aria-label={t("places.view")}>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${view === "list" ? "bg-forest-700 text-white" : ""}`}>
            <List className="h-4 w-4" aria-hidden="true" /> {t("explore.showList")}
          </button>
          <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${view === "map" ? "bg-forest-700 text-white" : ""}`}>
            <MapIcon className="h-4 w-4" aria-hidden="true" /> {t("explore.showMap")}
          </button>
        </div>
      </div>
      {geoMsg && (
        <p role="status" className="text-sm muted">
          {geoMsg}
        </p>
      )}

      {data && data.provinces.length > 0 && (
        <section aria-labelledby="prov-hits">
          <h2 id="prov-hits" className="mb-2 text-sm font-semibold">
            {t("search.provinces")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.provinces.map((p) => (
              <Link key={p.slug} href={`/thailand/${p.slug}`} className="chip">
                {localName(p, locale)} <span className="opacity-60">{altName(p, locale)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-clay-soft px-4 py-3 text-sm">
          {t("errors.loadFailed")}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAttempt((a) => a + 1)}>
            {t("common.retry")}
          </button>
        </div>
      ) : !data && loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 rounded-[var(--radius-card)] skeleton" />
          ))}
        </div>
      ) : places.length === 0 ? (
        <EmptyState
          title={t("common.noResults")}
          body={t("places.emptyBody")}
          action={
            <button type="button" className="btn btn-primary" onClick={clearAll}>
              {t("common.clearFilters")}
            </button>
          }
        />
      ) : view === "map" ? (
        <>
          <PointsMap
            label={t("places.mapLabel")}
            height="clamp(380px, 65vh, 640px)"
            points={places.map((p) => ({
              id: p.id,
              lat: p.lat,
              lng: p.lng,
              label: localName(p, locale),
              href: `/thailand/${p.provinceSlug}/${p.slug}`,
              color: p.kind === "accommodation" ? "#c99a3b" : p.kind === "restaurant" || p.kind === "cafe" ? "#c4693f" : "#234f39",
            }))}
          />
          {data && data.total > places.length && <p className="text-xs muted">{t("places.mapLimit", { shown: places.length })}</p>}
        </>
      ) : (
        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
          {places.map((p) => (
            <PlaceResultCard key={p.id} place={p} provinceName={pName(p.provinceSlug)} />
          ))}
        </div>
      )}

      {view === "list" && data && totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-2" aria-label={t("places.pagination")}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            {t("common.previous")}
          </button>
          <span className="text-sm" aria-current="page">
            {t("places.pageOf", { page, total: totalPages })}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)}>
            {t("common.next")}
          </button>
        </nav>
      )}
      <p className="text-xs muted">{t("places.dataNote")}</p>
    </div>
  );
}
