"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { AlertTriangle, Dices, Loader2, MapPin, Route, Sparkles } from "lucide-react";
import { PlaceCard } from "@/components/place/PlaceCard";
import { PointsMap } from "@/components/map/PointsMap";
import { Photo } from "@/components/ui/Photo";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import { COMPANIONS, INTERESTS, type Companion, type Interest } from "@/lib/categories";
import { altName, localName, localText } from "@/lib/display";
import type { Reason } from "@/lib/random";
import type { ImageInfo, PlaceKind, PlaceSummary, RegionId } from "@/lib/types";

type Tab = "province" | "place" | "trip";
const REGIONS: RegionId[] = ["north", "northeast", "central", "east", "west", "south"];
const KINDS: PlaceKind[] = ["attraction", "activity", "restaurant", "cafe", "accommodation"];

interface ProvinceResult {
  province: { slug: string; nameTh: string; nameEn: string; region: RegionId; image: ImageInfo | null; summaryTh: string | null; summaryEn: string | null };
  reasons: Reason[];
  candidates: number;
}
interface PlaceResult {
  place: PlaceSummary & { descriptionTh: string | null; descriptionEn: string | null };
  reasons: Reason[];
  candidates: number;
}
interface TripResult {
  province: { slug: string; nameTh: string; nameEn: string; region: RegionId };
  warnings: string[];
  days: Array<{ day: number; stops: Array<{ placeId: string; role: "sight" | "food" | "activity"; kmFromPrevious: number | null; openingHours: string | null; place: PlaceSummary }> }>;
}

export function RandomClient({ provinces }: { provinces: Array<{ slug: string; nameTh: string; nameEn: string }> }) {
  const t = useTranslations();
  const locale = useLocale();
  const params = useSearchParams();
  const store = useTravelStore();
  const initialTab = (["province", "place", "trip"].includes(params.get("tab") ?? "") ? params.get("tab") : "province") as Tab;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [regions, setRegions] = useState<RegionId[]>([]);
  const [duration, setDuration] = useState("any");
  const [budget, setBudget] = useState("any");
  const [companion, setCompanion] = useState<Companion | "">("");
  const [interests, setInterests] = useState<Interest[]>([]);
  const [visitedMode, setVisitedMode] = useState("any");
  const [preferWishlist, setPreferWishlist] = useState(false);
  const [provinceSlug, setProvinceSlug] = useState(params.get("province") ?? "");
  const [kinds, setKinds] = useState<PlaceKind[]>([]);
  const [freeOnly, setFreeOnly] = useState(false);
  const [excludeVisitedPlaces, setExcludeVisitedPlaces] = useState(false);
  const [days, setDays] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const [provRes, setProvRes] = useState<ProvinceResult | null>(null);
  const [placeRes, setPlaceRes] = useState<PlaceResult | null>(null);
  const [tripRes, setTripRes] = useState<TripResult | null>(null);
  const [tripSaved, setTripSaved] = useState(false);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const pName = (slug: string) => {
    const p = provinces.find((x) => x.slug === slug);
    return p ? localName(p, locale) : slug;
  };

  const spin = async () => {
    setLoading(true);
    setError(false);
    setNoMatch(false);
    setTripSaved(false);
    const visitedProvinces = Object.entries(store.state.provinces).filter(([, v]) => v.status === "visited").map(([s]) => s);
    const wishlistProvinces = [
      ...Object.entries(store.state.provinces).filter(([, v]) => v.status === "want").map(([s]) => s),
      ...Object.values(store.state.wishlist).map((w) => w.provinceSlug),
    ];
    try {
      const res = await fetch("/api/random", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: tab,
          regions,
          duration,
          budget,
          companion: companion || null,
          interests,
          visitedMode,
          visitedProvinces,
          wishlistProvinces: [...new Set(wishlistProvinces)],
          preferWishlist,
          provinceSlug: provinceSlug || null,
          kinds,
          freeOnly,
          excludePlaceIds: excludeVisitedPlaces ? Object.keys(store.state.visits).slice(0, 2000) : [],
          days,
        }),
      });
      if (!res.ok) throw new Error();
      const { result } = await res.json();
      if (!result) setNoMatch(true);
      if (tab === "province") setProvRes(result);
      if (tab === "place") setPlaceRes(result);
      if (tab === "trip") setTripRes(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const reasonText = (r: Reason, placeLevel = false) => {
    switch (r.code) {
      case "region":
        return t("random.reasonRegion", { region: t(`regions.${r.region}`) });
      case "interest":
        return placeLevel ? t("random.reasonInterestPlace", { interest: t(`interests.${r.interest}`) }) : t("random.reasonInterest", { interest: t(`interests.${r.interest}`), count: r.count });
      case "companion":
        return placeLevel
          ? t("random.reasonCompanionPlace", { companion: t(`companions.${r.companion}`) })
          : t("random.reasonCompanion", { companion: t(`companions.${r.companion}`), count: r.count });
      case "distance":
        return t("random.reasonDistance", { km: r.km });
      case "unvisited":
        return t("random.reasonUnvisited");
      case "wishlist":
        return t("random.reasonWishlist");
      case "free":
        return t("random.reasonFree");
      case "category":
        return t("random.reasonCategory", { category: t(`categories.${r.category}`) });
    }
  };

  const saveTrip = async () => {
    if (!tripRes) return;
    const refs = tripRes.days.flatMap((d) =>
      d.stops.map((s) => ({
        placeId: s.place.id,
        provinceSlug: s.place.provinceSlug,
        category: s.place.category,
        nameTh: s.place.nameTh,
        nameEn: s.place.nameEn,
        day: d.day,
      })),
    );
    const trip = await store.createTrip(
      { name: t("random.tripTitle", { days: tripRes.days.length, province: localName(tripRes.province, locale) }), provinceSlug: tripRes.province.slug },
      refs,
    );
    if (trip) setTripSaved(true);
  };

  const Chips = <T extends string>({ items, value, onToggle, label, render }: { items: readonly T[]; value: T[]; onToggle: (v: T) => void; label: string; render: (v: T) => string }) => (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <button key={i} type="button" className="chip" aria-pressed={value.includes(i)} onClick={() => onToggle(i)}>
            {render(i)}
          </button>
        ))}
      </div>
    </fieldset>
  );

  const sortedProvinces = [...provinces].sort((a, b) => localName(a, locale).localeCompare(localName(b, locale), locale));

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-sage-100 p-1" role="tablist">
          {(
            [
              ["province", t("random.tabProvince"), MapPin],
              ["place", t("random.tabPlace"), Dices],
              ["trip", t("random.tabTrip"), Route],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold sm:text-sm ${tab === id ? "bg-white text-forest-800 shadow" : "text-charcoal-soft"}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        <div className="card space-y-5 p-5">
          {tab !== "province" && (
            <div>
              <label htmlFor="r-prov" className="label">
                {t("random.province")}
              </label>
              <select id="r-prov" className="input" value={provinceSlug} onChange={(e) => setProvinceSlug(e.target.value)}>
                <option value="">{t("random.anyProvince")}</option>
                {sortedProvinces.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {localName(p, locale)}
                  </option>
                ))}
              </select>
              {tab === "trip" && <p className="mt-1 text-xs muted">{t("random.pickProvinceFirst")}</p>}
            </div>
          )}
          {(tab === "province" || !provinceSlug) && (
            <Chips items={REGIONS} value={regions} onToggle={(v) => setRegions(toggle(regions, v))} label={t("random.region")} render={(r) => t(`regions.${r}`)} />
          )}
          <Chips items={INTERESTS} value={interests} onToggle={(v) => setInterests(toggle(interests, v))} label={t("random.interests")} render={(i) => t(`interests.${i}`)} />
          <div>
            <label htmlFor="r-comp" className="label">
              {t("random.companion")}
            </label>
            <select id="r-comp" className="input" value={companion} onChange={(e) => setCompanion(e.target.value as Companion | "")}>
              <option value="">{t("random.companionAny")}</option>
              {COMPANIONS.map((c) => (
                <option key={c} value={c}>
                  {t(`companions.${c}`)}
                </option>
              ))}
            </select>
          </div>
          {(tab === "province" || (tab === "trip" && !provinceSlug)) && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="r-dur" className="label">
                    {t("random.duration")}
                  </label>
                  <select id="r-dur" className="input" value={duration} onChange={(e) => setDuration(e.target.value)}>
                    <option value="any">{t("random.durationAny")}</option>
                    <option value="day">{t("random.durationDay")}</option>
                    <option value="weekend">{t("random.durationWeekend")}</option>
                    <option value="long">{t("random.durationLong")}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="r-bud" className="label">
                    {t("random.budget")}
                  </label>
                  <select id="r-bud" className="input" value={budget} onChange={(e) => setBudget(e.target.value)}>
                    <option value="any">{t("random.budgetAny")}</option>
                    <option value="low">{t("random.budgetLow")}</option>
                    <option value="mid">{t("random.budgetMid")}</option>
                    <option value="high">{t("random.budgetHigh")}</option>
                  </select>
                </div>
              </div>
              <p className="-mt-3 text-xs muted">{t("random.budgetNote")}</p>
              <div>
                <label htmlFor="r-vis" className="label">
                  {t("random.visited")}
                </label>
                <select id="r-vis" className="input" value={visitedMode} onChange={(e) => setVisitedMode(e.target.value)}>
                  <option value="any">{t("random.visitedAny")}</option>
                  <option value="exclude">{t("random.visitedExclude")}</option>
                  <option value="prioritize_unvisited">{t("random.visitedPrioritize")}</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={preferWishlist} onChange={(e) => setPreferWishlist(e.target.checked)} className="h-4 w-4 accent-forest-700" />
                {t("random.preferWishlist")}
              </label>
            </>
          )}
          {tab === "place" && (
            <>
              <Chips items={KINDS} value={kinds} onToggle={(v) => setKinds(toggle(kinds, v))} label={t("random.kinds")} render={(k) => t(`kinds.${k}`)} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} className="h-4 w-4 accent-forest-700" />
                {t("random.freeOnly")}
              </label>
            </>
          )}
          {tab === "trip" && (
            <fieldset>
              <legend className="label">{t("random.days")}</legend>
              <div className="flex gap-2">
                {[1, 2, 3].map((d) => (
                  <button key={d} type="button" className="chip" aria-pressed={days === d} onClick={() => setDays(d)}>
                    {t("random.daysN", { n: d })}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {tab !== "province" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={excludeVisitedPlaces} onChange={(e) => setExcludeVisitedPlaces(e.target.checked)} className="h-4 w-4 accent-forest-700" />
              {t("random.excludeVisitedPlaces")}
            </label>
          )}
          <button type="button" className="btn btn-accent w-full py-3 text-base" onClick={spin} disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Dices className="h-5 w-5" aria-hidden="true" />}
            {loading ? t("random.spinning") : t("random.spin")}
          </button>
        </div>
      </div>

      <div aria-live="polite" className="min-w-0">
        {error && (
          <div role="alert" className="flex items-center gap-3 rounded-xl bg-clay-soft px-4 py-3 text-sm">
            {t("errors.loadFailed")}
            <button type="button" className="btn btn-secondary btn-sm" onClick={spin}>
              {t("common.retry")}
            </button>
          </div>
        )}
        {noMatch && !loading && <div className="card p-6 text-center muted">{t("random.noMatch")}</div>}

        {tab === "province" && provRes && !noMatch && (
          <article className="card overflow-hidden">
            <Photo image={provRes.province.image} alt={localName(provRes.province, locale)} className="aspect-[16/8] w-full" />
            <div className="space-y-4 p-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-forest-600">{t(`regions.${provRes.province.region}`)}</p>
              <h2 className="text-3xl font-bold">{localName(provRes.province, locale)}</h2>
              <p className="muted">{altName(provRes.province, locale)}</p>
              {localText(provRes.province.summaryTh, provRes.province.summaryEn, locale) && (
                <p className="line-clamp-4 text-sm">{localText(provRes.province.summaryTh, provRes.province.summaryEn, locale)}</p>
              )}
              <WhyFits title={t("random.whyFits")} reasons={provRes.reasons.map((r) => reasonText(r))} note={t("random.candidates", { count: provRes.candidates })} />
              <div className="flex flex-wrap gap-2">
                <Link href={`/thailand/${provRes.province.slug}`} className="btn btn-primary">
                  {t("random.openProvince")}
                </Link>
                <button type="button" className="btn btn-secondary" onClick={spin}>
                  {t("random.spinAgain")}
                </button>
              </div>
            </div>
          </article>
        )}

        {tab === "place" && placeRes && !noMatch && (
          <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
            <PlaceCard place={placeRes.place} provinceName={pName(placeRes.place.provinceSlug)} />
            <div className="space-y-4">
              {localText(placeRes.place.descriptionTh, placeRes.place.descriptionEn, locale) && (
                <p>{localText(placeRes.place.descriptionTh, placeRes.place.descriptionEn, locale)}</p>
              )}
              <WhyFits title={t("random.whyFits")} reasons={placeRes.reasons.map((r) => reasonText(r, true))} note={t("random.candidates", { count: placeRes.candidates })} />
              <div className="flex flex-wrap gap-2">
                <Link href={`/thailand/${placeRes.place.provinceSlug}/${placeRes.place.slug}`} className="btn btn-primary">
                  {t("random.openPlace")}
                </Link>
                <button type="button" className="btn btn-secondary" onClick={spin}>
                  {t("random.spinAgain")}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "trip" && tripRes && !noMatch && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold">{t("random.tripTitle", { days: tripRes.days.length, province: localName(tripRes.province, locale) })}</h2>
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-gold-soft px-4 py-3 text-sm text-[#5f4612]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {t("random.tripWarning")}
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs muted">
                {tripRes.warnings.map((w) => (
                  <li key={w}>
                    {t(
                      `random.${({ few_places: "warnFew", no_food_data: "warnNoFood", opening_hours_unknown: "warnHours", straight_line_distance: "warnStraight" } as Record<string, string>)[w] ?? "warnStraight"}`,
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <PointsMap
              label={t("trips.routeMap")}
              route
              height={320}
              points={tripRes.days.flatMap((d) => d.stops).map((s, i) => ({
                id: s.place.id,
                lat: s.place.lat,
                lng: s.place.lng,
                label: localName(s.place, locale),
                href: `/thailand/${s.place.provinceSlug}/${s.place.slug}`,
                order: i + 1,
                color: s.role === "food" ? "#c4693f" : "#234f39",
              }))}
            />
            {tripRes.days.map((d, di) => (
              <section key={d.day} className="card p-5">
                <h3 className="mb-3 text-lg font-bold">{t("place.day", { day: d.day })}</h3>
                <ol className="space-y-3">
                  {d.stops.map((s, i) => {
                    const n = tripRes.days.slice(0, di).reduce((acc, x) => acc + x.stops.length, 0) + i + 1;
                    return (
                      <li key={s.placeId} className="flex gap-3">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${s.role === "food" ? "bg-clay" : "bg-forest-700"}`}>{n}</span>
                        <div className="min-w-0">
                          <Link href={`/thailand/${s.place.provinceSlug}/${s.place.slug}`} className="font-semibold hover:underline">
                            {localName(s.place, locale)}
                          </Link>
                          <p className="text-xs muted">
                            {t(`random.${s.role === "food" ? "roleFood" : s.role === "activity" ? "roleActivity" : "roleSight"}`)} · {t(`categories.${s.place.category}`)}
                            {s.kmFromPrevious != null && ` · ${t("random.fromPrev", { km: s.kmFromPrevious })}`}
                          </p>
                          {s.openingHours && <p className="font-mono text-xs muted">{s.openingHours}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-primary" onClick={saveTrip} disabled={!store.canWrite || tripSaved}>
                <Sparkles className="h-4 w-4" aria-hidden="true" /> {t("random.saveAsTrip")}
              </button>
              <button type="button" className="btn btn-secondary" onClick={spin}>
                {t("random.spinAgain")}
              </button>
              {tripSaved && (
                <Link href="/trips" className="text-sm font-semibold text-forest-700 underline" role="status">
                  {t("random.tripSaved")}
                </Link>
              )}
            </div>
          </div>
        )}

        {!provRes && !placeRes && !tripRes && !noMatch && !error && (
          <div className="grid h-full min-h-64 place-items-center rounded-[var(--radius-card)] border-2 border-dashed border-sage-200 p-10 text-center">
            <div>
              <Dices className="mx-auto h-12 w-12 text-sage-300" aria-hidden="true" />
              <p className="mt-3 muted">{t("random.subtitle")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WhyFits({ title, reasons, note }: { title: string; reasons: string[]; note: string }) {
  return (
    <div className="rounded-xl bg-forest-50 p-4">
      <p className="mb-2 text-sm font-bold text-forest-800">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs muted">{note}</p>
    </div>
  );
}
