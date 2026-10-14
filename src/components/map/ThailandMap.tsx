"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { List, Map as MapIcon, Minus, Plus, RotateCcw, Search } from "lucide-react";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import { provinceStatusMap, type MapStatus } from "@/lib/passport";
import { localName, altName } from "@/lib/display";
import { normalizeText } from "@/lib/search";
import type { ProvinceSummary, RegionId } from "@/lib/types";
import { STATUS_COLORS, type MapHandle, type MapProvince } from "./constants";

const Canvas = dynamic(() => import("./ThailandMapCanvas"), { ssr: false });

const REGIONS: RegionId[] = ["north", "northeast", "central", "east", "west", "south"];

type LoadState = { status: "loading" } | { status: "ready"; geojson: GeoJSON.FeatureCollection } | { status: "error" };

export function ThailandMap({
  provinces,
  height = "clamp(420px, 70vh, 720px)",
}: {
  provinces: ProvinceSummary[];
  height?: string;
}) {
  const t = useTranslations("explore");
  const tr = useTranslations("regions");
  const locale = useLocale();
  const router = useRouter();
  const { state } = useTravelStore();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [region, setRegion] = useState<RegionId | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"map" | "list">("map");
  const [highlight, setHighlight] = useState<string | null>(null);
  const handle = useRef<MapHandle | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    fetch("/geo/thailand-provinces.geojson")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((geojson) => !cancelled && setLoad({ status: "ready", geojson }))
      .catch(() => !cancelled && setLoad({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const statuses = useMemo(() => provinceStatusMap(state, provinces.map((p) => p.slug)), [state, provinces]);

  const mapProvinces = useMemo(
    () =>
      new Map<string, MapProvince>(
        provinces.map((p) => [
          p.slug,
          {
            slug: p.slug,
            region: p.region,
            label: localName(p, locale),
            sublabel: `${altName(p, locale) ?? ""} · ${tr(p.region)}`,
          },
        ]),
      ),
    [provinces, locale, tr],
  );

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return provinces
      .filter((p) => !region || p.region === region)
      .filter((p) => !q || normalizeText(p.nameTh).includes(q) || normalizeText(p.nameEn).includes(q))
      .sort((a, b) => localName(a, locale).localeCompare(localName(b, locale), locale === "en" ? "en" : "th"));
  }, [provinces, region, query, locale]);

  useEffect(() => {
    if (query && filtered.length === 1) {
      setHighlight(filtered[0].slug);
      handle.current?.focus(filtered[0].slug);
    } else setHighlight(null);
  }, [query, filtered]);

  const statusLabel: Record<MapStatus, string> = {
    visited: t("statusVisited"),
    partial: t("statusPartial"),
    want: t("statusWant"),
    none: t("statusNone"),
  };

  const showList = view === "list" || load.status === "error";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-500" aria-hidden="true" />
          <label htmlFor="province-search" className="sr-only">
            {t("searchProvince")}
          </label>
          <input
            id="province-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchProvince")}
            className="input pl-9"
            maxLength={60}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("allRegions")}>
          <button type="button" className="chip" aria-pressed={region === null} onClick={() => setRegion(null)}>
            {t("allRegions")}
          </button>
          {REGIONS.map((r) => (
            <button key={r} type="button" className="chip" aria-pressed={region === r} onClick={() => setRegion(region === r ? null : r)}>
              {tr(r)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={t("legend")}>
          {(["visited", "partial", "want", "none"] as MapStatus[]).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3.5 w-3.5 rounded-sm border border-forest-800/40"
                style={{ background: STATUS_COLORS[s].fill }}
                aria-hidden="true"
              />
              {statusLabel[s]}
            </li>
          ))}
        </ul>
        {load.status !== "error" && (
          <div className="inline-flex rounded-full border border-sage-200 bg-white p-0.5 text-sm" role="group">
            <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${view === "map" ? "bg-forest-700 text-white" : ""}`}>
              <MapIcon className="h-4 w-4" aria-hidden="true" /> {t("showMap")}
            </button>
            <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${view === "list" ? "bg-forest-700 text-white" : ""}`}>
              <List className="h-4 w-4" aria-hidden="true" /> {t("showList")}
            </button>
          </div>
        )}
      </div>

      {!showList && (
        <div className="card relative overflow-hidden" style={{ height }}>
          {load.status === "loading" && (
            <div className="absolute inset-0 grid place-items-center skeleton text-sm muted">{t("mapLoading")}</div>
          )}
          {load.status === "ready" && (
            <Canvas
              geojson={load.geojson}
              provinces={mapProvinces}
              statuses={statuses}
              regionFilter={region}
              highlight={highlight}
              onSelect={(slug) => router.push(`/thailand/${slug}`)}
              handleRef={handle}
              boundaryAttribution={t("attribution")}
            />
          )}
          <div className="absolute right-3 top-3 z-[500] flex flex-col gap-1">
            <button type="button" className="btn btn-secondary btn-sm !p-2" onClick={() => handle.current?.zoomIn()} aria-label={t("zoomIn")}>
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-secondary btn-sm !p-2" onClick={() => handle.current?.zoomOut()} aria-label={t("zoomOut")}>
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-secondary btn-sm !p-2" onClick={() => handle.current?.reset()} aria-label={t("resetView")}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {load.status === "error" && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-clay-soft px-4 py-3 text-sm">
          {t("mapError")}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAttempt((a) => a + 1)}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Accessible list: always available as the mobile / keyboard fallback */}
      <div className={showList ? "" : "sr-only"}>
        {filtered.length === 0 ? (
          <p className="muted">{t("noProvinceMatch")}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/thailand/${p.slug}`}
                  className="card flex items-center gap-3 px-4 py-3 hover:bg-forest-50"
                  aria-label={t("openProvince", { name: localName(p, locale) })}
                >
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-sm border border-forest-800/40"
                    style={{ background: STATUS_COLORS[statuses[p.slug] ?? "none"].fill }}
                    aria-hidden="true"
                  />
                  <span className="flex-1">
                    <span className="block font-semibold">{localName(p, locale)}</span>
                    <span className="block text-xs muted">
                      {altName(p, locale)} · {tr(p.region)} · {statusLabel[statuses[p.slug] ?? "none"]}
                    </span>
                  </span>
                  <span className="text-xs muted">{t("placesInData", { count: p.placeCount })}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
