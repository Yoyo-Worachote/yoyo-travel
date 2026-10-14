"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Info, Plus, Search, Trash2 } from "lucide-react";
import { PointsMap } from "@/components/map/PointsMap";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import { formatBaht, formatDate, localName } from "@/lib/display";
import { tripCostSummary, type Trip } from "@/lib/travel-state";
import type { PlaceSummary } from "@/lib/types";

type ProvinceOpt = { slug: string; nameTh: string; nameEn: string };

export function TripsClient({ provinces }: { provinces: ProvinceOpt[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const store = useTravelStore();
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("trip");
  const [name, setName] = useState("");
  const [prov, setProv] = useState("");

  const sortedProv = useMemo(
    () => [...provinces].sort((a, b) => localName(a, locale).localeCompare(localName(b, locale), locale)),
    [provinces, locale],
  );

  if (store.mode === "loading") return <div className="h-64 rounded-[var(--radius-card)] skeleton" aria-hidden="true" />;
  if (store.mode === "guest") {
    return (
      <EmptyState
        title={t("auth.signInRequired")}
        body={t("auth.signInToSave")}
        action={
          <Link href="/login?next=/trips" className="btn btn-primary">
            {t("auth.signIn")}
          </Link>
        }
      />
    );
  }

  const selected = store.state.trips.find((x) => x.id === selectedId) ?? null;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const trip = await store.createTrip({ name: name.trim(), provinceSlug: prov || null });
    setName("");
    if (trip) router.replace(`/trips?trip=${trip.id}`, { scroll: false });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <form onSubmit={create} className="card space-y-3 p-5">
          <h2 className="text-lg font-bold">{t("trips.create")}</h2>
          <div>
            <label htmlFor="trip-name" className="label">
              {t("trips.name")}
            </label>
            <input id="trip-name" className="input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("trips.namePlaceholder")} />
          </div>
          <div>
            <label htmlFor="trip-prov" className="label">
              {t("trips.province")} <span className="font-normal muted">({t("common.optional")})</span>
            </label>
            <select id="trip-prov" className="input" value={prov} onChange={(e) => setProv(e.target.value)}>
              <option value="">—</option>
              {sortedProv.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {localName(p, locale)}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary w-full">
            <Plus className="h-4 w-4" aria-hidden="true" /> {t("trips.create")}
          </button>
        </form>
        {store.state.trips.length === 0 ? (
          <p className="text-sm muted">{t("trips.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {store.state.trips.map((tr) => (
              <li key={tr.id}>
                <Link
                  href={`/trips?trip=${tr.id}`}
                  scroll={false}
                  aria-current={tr.id === selectedId ? "page" : undefined}
                  className={`card block px-4 py-3 hover:bg-forest-50 ${tr.id === selectedId ? "ring-2 ring-forest-500" : ""}`}
                >
                  <span className="block font-semibold">{tr.name}</span>
                  <span className="text-xs muted">
                    {tr.provinceSlug ? localName(provinces.find((p) => p.slug === tr.provinceSlug) ?? { nameTh: tr.provinceSlug, nameEn: tr.provinceSlug }, locale) + " · " : ""}
                    {t("common.places", { count: tr.items.length })}
                    {tr.startDate ? ` · ${formatDate(tr.startDate, locale)}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="min-w-0">
        {selected ? (
          <TripEditor key={selected.id} trip={selected} provinces={sortedProv} />
        ) : (
          <div className="grid min-h-64 place-items-center rounded-[var(--radius-card)] border-2 border-dashed border-sage-200 p-8 text-center muted">
            {store.state.trips.length ? t("trips.selectTrip") : t("trips.subtitle")}
          </div>
        )}
      </div>
    </div>
  );
}

function TripEditor({ trip, provinces }: { trip: Trip; provinces: ProvinceOpt[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const store = useTravelStore();
  const router = useRouter();
  const [details, setDetails] = useState({
    name: trip.name,
    provinceSlug: trip.provinceSlug ?? "",
    startDate: trip.startDate ?? "",
    endDate: trip.endDate ?? "",
    budget: trip.budget?.toString() ?? "",
    notes: trip.notes ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [extraDays, setExtraDays] = useState(0);
  const [coords, setCoords] = useState<Record<string, PlaceSummary>>({});
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlaceSummary[]>([]);
  const [addDay, setAddDay] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  const dateDays =
    trip.startDate && trip.endDate
      ? Math.min(30, Math.max(1, Math.round((Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86400000) + 1))
      : 1;
  const maxItemDay = trip.items.reduce((m, i) => Math.max(m, i.day), 1);
  const dayCount = Math.min(30, Math.max(dateDays, maxItemDay) + extraDays);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);

  const idsKey = trip.items.map((i) => i.placeId).sort().join(",");
  useEffect(() => {
    const missing = trip.items.map((i) => i.placeId).filter((id) => !coords[id]);
    if (!missing.length) return;
    fetch(`/api/places?ids=${missing.slice(0, 100).join(",")}`)
      .then((r) => r.json())
      .then((json: { places: PlaceSummary[] }) => setCoords((c) => ({ ...c, ...Object.fromEntries(json.places.map((p) => [p.id, p])) })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const h = setTimeout(async () => {
      const sp = new URLSearchParams({ q, limit: "8" });
      if (trip.provinceSlug) sp.set("province", trip.provinceSlug);
      try {
        const json = await (await fetch(`/api/search?${sp}`)).json();
        setResults(json.places ?? []);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [q, trip.provinceSlug]);

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    const budget = details.budget ? Math.max(0, Number(details.budget)) : null;
    if (details.startDate && details.endDate && details.endDate < details.startDate) return;
    await store.updateTrip(trip.id, {
      name: details.name.trim().slice(0, 120) || trip.name,
      provinceSlug: details.provinceSlug || null,
      startDate: details.startDate || null,
      endDate: details.endDate || null,
      budget: Number.isFinite(budget) ? budget : null,
      notes: details.notes.slice(0, 4000) || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const add = async (p: PlaceSummary) => {
    const ok = await store.addTripItem(trip.id, { placeId: p.id, provinceSlug: p.provinceSlug, category: p.category, nameTh: p.nameTh, nameEn: p.nameEn }, addDay);
    setNotice(ok ? t("place.addedToTrip") : t("trips.duplicate"));
    setTimeout(() => setNotice(null), 2000);
    if (ok) setQ("");
  };

  const cost = tripCostSummary(trip);
  const ordered = [...trip.items].sort((a, b) => a.day - b.day || a.position - b.position);
  const points = ordered
    .filter((i) => coords[i.placeId])
    .map((i, n) => ({
      id: i.id,
      lat: coords[i.placeId].lat,
      lng: coords[i.placeId].lng,
      label: `${t("place.day", { day: i.day })}: ${localName(i, locale)}`,
      href: `/thailand/${coords[i.placeId].provinceSlug}/${coords[i.placeId].slug}`,
      order: n + 1,
    }));

  return (
    <div className="space-y-6">
      <form onSubmit={saveDetails} className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="d-name" className="label">
            {t("trips.name")}
          </label>
          <input id="d-name" className="input text-lg font-semibold" required maxLength={120} value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="d-prov" className="label">
            {t("trips.province")}
          </label>
          <select id="d-prov" className="input" value={details.provinceSlug} onChange={(e) => setDetails({ ...details, provinceSlug: e.target.value })}>
            <option value="">—</option>
            {provinces.map((p) => (
              <option key={p.slug} value={p.slug}>
                {localName(p, locale)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="d-budget" className="label">
            {t("trips.budget")}
          </label>
          <input id="d-budget" type="number" min={0} step={100} inputMode="numeric" className="input" value={details.budget} onChange={(e) => setDetails({ ...details, budget: e.target.value })} />
        </div>
        <div>
          <label htmlFor="d-start" className="label">
            {t("trips.startDate")}
          </label>
          <input id="d-start" type="date" className="input" value={details.startDate} onChange={(e) => setDetails({ ...details, startDate: e.target.value })} />
        </div>
        <div>
          <label htmlFor="d-end" className="label">
            {t("trips.endDate")}
          </label>
          <input id="d-end" type="date" className="input" min={details.startDate || undefined} value={details.endDate} onChange={(e) => setDetails({ ...details, endDate: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="d-notes" className="label">
            {t("trips.notes")}
          </label>
          <textarea id="d-notes" rows={2} maxLength={4000} className="input" value={details.notes} onChange={(e) => setDetails({ ...details, notes: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" className="btn btn-primary btn-sm">
            {t("common.save")}
          </button>
          {saved && <span role="status" className="text-sm text-forest-700">{t("common.saved")}</span>}
          <button
            type="button"
            className="btn btn-ghost btn-sm ml-auto text-clay"
            onClick={async () => {
              if (window.confirm(t("trips.deleteConfirm"))) {
                await store.deleteTrip(trip.id);
                router.replace("/trips");
              }
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> {t("common.delete")}
          </button>
        </div>
      </form>

      <p className="flex items-start gap-2 rounded-xl bg-gold-soft px-4 py-3 text-sm text-[#5f4612]">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {t("trips.noBooking")}
      </p>

      <section className="card space-y-3 p-5" aria-labelledby="add-place">
        <h2 id="add-place" className="text-lg font-bold">
          {t("trips.addPlace")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-500" aria-hidden="true" />
            <label htmlFor="add-q" className="sr-only">
              {t("trips.searchPlace")}
            </label>
            <input id="add-q" type="search" maxLength={100} className="input pl-9" placeholder={t("trips.searchPlace")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <label htmlFor="add-day" className="sr-only">
            {t("trips.moveDay")}
          </label>
          <select id="add-day" className="input !w-auto" value={addDay} onChange={(e) => setAddDay(Number(e.target.value))}>
            {days.map((d) => (
              <option key={d} value={d}>
                {t("trips.day", { day: d })}
              </option>
            ))}
          </select>
        </div>
        {notice && <p role="status" className="text-sm text-forest-700">{notice}</p>}
        {results.length > 0 && (
          <ul className="divide-y divide-sage-100 rounded-xl border border-sage-200">
            {results.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{localName(p, locale)}</span>
                  <span className="text-xs muted">{t(`categories.${p.category}`)}</span>
                </span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => add(p)}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> {t("common.add")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {trip.items.length === 0 ? (
        <p className="muted">{t("trips.noItems")}</p>
      ) : (
        days.map((d) => {
          const items = ordered.filter((i) => i.day === d);
          return (
            <section key={d} className="card p-5" aria-labelledby={`day-${d}`}>
              <h2 id={`day-${d}`} className="mb-3 text-lg font-bold">
                {t("trips.day", { day: d })}
              </h2>
              {items.length === 0 ? (
                <p className="text-sm muted">—</p>
              ) : (
                <ol className="space-y-3">
                  {items.map((i, idx) => (
                    <li key={i.id} className="rounded-xl border border-sage-100 p-3">
                      <div className="flex flex-wrap items-start gap-2">
                        <div className="min-w-0 flex-1">
                          {coords[i.placeId] ? (
                            <Link href={`/thailand/${coords[i.placeId].provinceSlug}/${coords[i.placeId].slug}`} className="font-semibold hover:underline">
                              {localName(i, locale)}
                            </Link>
                          ) : (
                            <span className="font-semibold">{localName(i, locale)}</span>
                          )}
                          <p className="text-xs muted">{i.category ? t(`categories.${i.category}`) : ""}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" className="btn btn-ghost btn-sm !p-2" disabled={idx === 0} onClick={() => store.moveTripItem(trip.id, i.id, -1)} aria-label={t("trips.moveUp")}>
                            <ArrowUp className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm !p-2" disabled={idx === items.length - 1} onClick={() => store.moveTripItem(trip.id, i.id, 1)} aria-label={t("trips.moveDown")}>
                            <ArrowDown className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <label className="sr-only" htmlFor={`mv-${i.id}`}>
                            {t("trips.moveDay")}
                          </label>
                          <select
                            id={`mv-${i.id}`}
                            className="input !w-auto !py-1 text-sm"
                            value={i.day}
                            onChange={(e) => store.updateTripItem(trip.id, i.id, { day: Number(e.target.value), position: 999 })}
                          >
                            {days.map((dd) => (
                              <option key={dd} value={dd}>
                                {t("trips.day", { day: dd })}
                              </option>
                            ))}
                          </select>
                          <button type="button" className="btn btn-ghost btn-sm !p-2 text-clay" onClick={() => store.removeTripItem(trip.id, i.id)} aria-label={t("common.remove")}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_180px]">
                        <input
                          className="input text-sm"
                          aria-label={t("trips.notes")}
                          placeholder={t("trips.notes")}
                          maxLength={1000}
                          defaultValue={i.note ?? ""}
                          onBlur={(e) => e.target.value !== (i.note ?? "") && store.updateTripItem(trip.id, i.id, { note: e.target.value || null })}
                        />
                        <input
                          className="input text-sm"
                          type="number"
                          min={0}
                          step={10}
                          inputMode="numeric"
                          aria-label={t("trips.itemCost")}
                          placeholder={t("trips.itemCost")}
                          defaultValue={i.estimatedCost ?? ""}
                          onBlur={(e) => {
                            const v = e.target.value === "" ? null : Math.max(0, Number(e.target.value));
                            if (v !== (i.estimatedCost ?? null)) store.updateTripItem(trip.id, i.id, { estimatedCost: Number.isFinite(v as number) ? v : null });
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })
      )}
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExtraDays((x) => x + 1)} disabled={dayCount >= 30}>
        <Plus className="h-4 w-4" aria-hidden="true" /> {t("trips.addDay")}
      </button>

      <section className="card p-5" aria-labelledby="cost">
        <h2 id="cost" className="mb-3 text-lg font-bold">
          {t("trips.costSummary")}
        </h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="muted">{t("trips.knownCosts")}</dt>
            <dd className="font-semibold">{t("trips.knownCostsNone")}</dd>
          </div>
          <div>
            <dt className="muted">
              {t("trips.yourEstimate")} <span className="badge">{t("labels.estimated")}</span>
            </dt>
            <dd className="text-lg font-semibold">{formatBaht(cost.userEstimatedTotal, locale)}</dd>
            {cost.itemsWithoutCost > 0 && <dd className="text-xs muted">{t("trips.itemsNoCost", { count: cost.itemsWithoutCost })}</dd>}
          </div>
          {cost.budget != null && (
            <>
              <div>
                <dt className="muted">{t("trips.budget")}</dt>
                <dd className="font-semibold">{formatBaht(cost.budget, locale)}</dd>
              </div>
              <div>
                <dt className="muted">{t("trips.remaining")}</dt>
                <dd className={`font-semibold ${cost.remaining! < 0 ? "text-clay" : "text-forest-700"}`}>{formatBaht(cost.remaining!, locale)}</dd>
              </div>
            </>
          )}
        </dl>
      </section>

      {points.length > 0 && <PointsMap label={t("trips.routeMap")} points={points} route height={360} />}
    </div>
  );
}
