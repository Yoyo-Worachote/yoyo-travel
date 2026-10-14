"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, Search } from "lucide-react";
import { PlaceCard } from "@/components/place/PlaceCard";
import { VenueCard } from "@/components/place/VenueCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import { CATEGORY_GROUP_IDS, type CategoryGroup } from "@/lib/categories";
import { localName, altName } from "@/lib/display";
import type { ImageInfo, PlaceSummary, RegionId } from "@/lib/types";

interface ProvinceHit {
  slug: string;
  nameTh: string;
  nameEn: string;
  region: RegionId;
  image: ImageInfo | null;
}

export function SearchClient({ provinces }: { provinces: Array<{ slug: string; nameTh: string; nameEn: string }> }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const { state } = useTravelStore();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [group, setGroup] = useState<CategoryGroup | null>((params.get("group") as CategoryGroup) || null);
  const [province, setProvince] = useState(params.get("province") ?? "");
  const [status, setStatus] = useState<"all" | "visited" | "unvisited" | "wishlist">("all");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [data, setData] = useState<{ provinces: ProvinceHit[]; places: PlaceSummary[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [offset, setOffset] = useState(0);
  const reqId = useRef(0);

  const fetchPage = async (nextOffset: number, append: boolean) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(false);
    const sp = new URLSearchParams({ q, offset: String(nextOffset), limit: "24" });
    if (group) sp.set("group", group);
    if (province) sp.set("province", province);
    if (coords) {
      sp.set("lat", String(coords.lat));
      sp.set("lng", String(coords.lng));
    }
    try {
      const res = await fetch(`/api/search?${sp}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (id !== reqId.current) return;
      setData((prev) => (append && prev ? { ...json, places: [...prev.places, ...json.places] } : json));
      setOffset(nextOffset);
    } catch {
      if (id === reqId.current) setError(true);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  };

  // Debounced search on input/filter change
  useEffect(() => {
    const h = setTimeout(() => {
      fetchPage(0, false);
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (group) sp.set("group", group);
      if (province) sp.set("province", province);
      router.replace(`/search${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
    }, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, group, province, coords]);

  const locate = () => {
    setGeoMsg(t("search.nearMeAsk"));
    if (!("geolocation" in navigator)) {
      setGeoMsg(t("search.locationDenied"));
      return;
    }
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

  const places = (data?.places ?? []).filter((p) =>
    status === "all"
      ? true
      : status === "visited"
        ? !!state.visits[p.id]
        : status === "unvisited"
          ? !state.visits[p.id]
          : !!state.wishlist[p.id],
  );
  const pName = (slug: string) => {
    const p = provinces.find((x) => x.slug === slug);
    return p ? localName(p, locale) : slug;
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-sage-500" aria-hidden="true" />
        <label htmlFor="q" className="sr-only">
          {t("search.placeholder")}
        </label>
        <input
          id="q"
          type="search"
          autoFocus
          value={q}
          maxLength={100}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search.placeholder")}
          className="input h-14 rounded-full pl-12 text-lg"
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("search.type")}>
          <button type="button" className="chip" aria-pressed={!group} onClick={() => setGroup(null)}>
            {t("common.all")}
          </button>
          {CATEGORY_GROUP_IDS.map((g) => (
            <button key={g} type="button" className="chip" aria-pressed={group === g} onClick={() => setGroup(group === g ? null : g)}>
              {t(`groups.${g}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="prov" className="label">
            {t("search.chooseProvince")}
          </label>
          <select
            id="prov"
            className="input"
            value={province}
            onChange={(e) => {
              setCoords(null);
              setProvince(e.target.value);
            }}
          >
            <option value="">{t("random.anyProvince")}</option>
            {[...provinces]
              .sort((a, b) => localName(a, locale).localeCompare(localName(b, locale), locale))
              .map((p) => (
                <option key={p.slug} value={p.slug}>
                  {localName(p, locale)}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="label">
            {t("search.status")}
          </label>
          <select id="status" className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">{t("search.statusAll")}</option>
            <option value="visited">{t("search.statusVisited")}</option>
            <option value="unvisited">{t("search.statusUnvisited")}</option>
            <option value="wishlist">{t("search.statusWishlist")}</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="button" className="btn btn-secondary w-full" aria-pressed={!!coords} onClick={() => (coords ? setCoords(null) : locate())}>
            <LocateFixed className="h-4 w-4" aria-hidden="true" /> {t("search.nearMe")}
          </button>
        </div>
      </div>
      {geoMsg && (
        <p role="status" className="text-sm muted">
          {geoMsg}
        </p>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl bg-clay-soft px-4 py-3 text-sm">
          {t("errors.loadFailed")}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchPage(0, false)}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {data && data.provinces.length > 0 && (
        <section aria-labelledby="prov-results">
          <h2 id="prov-results" className="mb-3 text-lg font-bold">
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

      <section aria-labelledby="place-results" aria-busy={loading}>
        <div className="mb-3 flex items-center gap-3">
          <h2 id="place-results" className="text-lg font-bold">
            {t("search.places")}
          </h2>
          {data && <span className="text-sm muted">{t("search.results", { count: data.total })}</span>}
          {loading && <Loader2 className="h-4 w-4 animate-spin text-forest-600" aria-label={t("common.loading")} />}
        </div>
        {!loading && data && places.length === 0 ? (
          <EmptyState title={t("common.noResults")} />
        ) : !data && loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 rounded-[var(--radius-card)] skeleton" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {places.map((p) =>
              p.image || p.kind === "attraction" ? (
                <PlaceCard key={p.id} place={p} provinceName={pName(p.provinceSlug)} />
              ) : (
                <VenueCard key={p.id} place={p} provinceName={pName(p.provinceSlug)} />
              ),
            )}
          </div>
        )}
        {data && offset + 24 < data.total && (
          <div className="mt-6 text-center">
            <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => fetchPage(offset + 24, true)}>
              {t("search.loadMore")}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
