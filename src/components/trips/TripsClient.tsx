"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Dices, Info, Navigation, Plus, Search, Trash2 } from "lucide-react";
import { PointsMap } from "@/components/map/PointsMap";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import type { ProviderPrice } from "@/lib/budget";
import { defaultCostCategory } from "@/lib/budget";
import { CATEGORY_GROUP_IDS, type CategoryGroup } from "@/lib/categories";
import { formatDate, localName } from "@/lib/display";
import {
  COST_CATEGORIES,
  TRANSPORT_MODES,
  TRAVEL_STYLES,
  type CostCategory,
  type TransportMode,
  type TravelStyle,
  type Trip,
  type TripItem,
} from "@/lib/travel-state";
import type { PlaceSummary } from "@/lib/types";
import { SaveIndicator } from "./SaveIndicator";
import { TripBudget } from "./TripBudget";

type ProvinceOpt = { slug: string; nameTh: string; nameEn: string };
type PlaceInfo = PlaceSummary & { price: ProviderPrice | null; openingHours: string | null };

const daysBetween = (a: string | null, b: string | null) =>
  a && b ? Math.min(30, Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1)) : null;

/** Google Maps directions through a day's stops (origin → waypoints → destination). */
function directionsUrl(stops: Array<{ lat: number; lng: number }>): string | null {
  if (!stops.length) return null;
  const fmt = (s: { lat: number; lng: number }) => `${s.lat},${s.lng}`;
  if (stops.length === 1) return `https://www.google.com/maps/dir/?api=1&destination=${fmt(stops[0])}`;
  const way = stops.slice(1, -1).slice(0, 9).map(fmt).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${fmt(stops[0])}&destination=${fmt(stops[stops.length - 1])}${
    way ? `&waypoints=${encodeURIComponent(way)}` : ""
  }`;
}

export function TripsClient({ provinces }: { provinces: ProvinceOpt[] }) {
  const t = useTranslations("trips");
  const tAll = useTranslations();
  const locale = useLocale();
  const store = useTravelStore();
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("trip");
  const sortedProv = useMemo(
    () => [...provinces].sort((a, b) => localName(a, locale).localeCompare(localName(b, locale), locale)),
    [provinces, locale],
  );

  if (store.mode === "loading") return <div className="h-64 rounded-[var(--radius-card)] skeleton" aria-hidden="true" />;
  const selected = store.state.trips.find((x) => x.id === selectedId) ?? null;
  const pName = (slug: string | null) => {
    const p = slug ? provinces.find((x) => x.slug === slug) : null;
    return p ? localName(p, locale) : "";
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-4">
        <CreateTripForm
          provinces={sortedProv}
          onCreated={(id) => router.replace(`/trips?trip=${id}`, { scroll: false })}
        />
        <Link href="/random?tab=trip" className="btn btn-secondary w-full">
          <Dices className="h-4 w-4" aria-hidden="true" /> {t("randomTrip")}
        </Link>
        {store.state.trips.length === 0 ? (
          <p className="text-sm muted">{t("empty")}</p>
        ) : (
          <ul className="space-y-2" aria-label={t("myTrips")}>
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
                    {[pName(tr.provinceSlug), tAll("common.places", { count: tr.items.length }), tr.startDate ? formatDate(tr.startDate, locale) : ""]
                      .filter(Boolean)
                      .join(" · ")}
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
          <EmptyState
            title={store.state.trips.length ? t("selectTrip") : t("emptyTitle")}
            body={t("subtitle")}
            action={
              <Link href="/places" className="btn btn-primary">
                {t("browsePlaces")}
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}

function StyleChips({ value, onChange }: { value: TravelStyle[]; onChange: (v: TravelStyle[]) => void }) {
  const t = useTranslations("trips");
  return (
    <fieldset>
      <legend className="label">{t("styles")}</legend>
      <div className="flex flex-wrap gap-1.5">
        {TRAVEL_STYLES.map((s) => (
          <button
            key={s}
            type="button"
            className="chip !px-3 !py-1 text-xs"
            aria-pressed={value.includes(s)}
            onClick={() => onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s])}
          >
            {t(`style.${s}`)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function CreateTripForm({ provinces, onCreated }: { provinces: ProvinceOpt[]; onCreated: (id: string) => void }) {
  const t = useTranslations("trips");
  const locale = useLocale();
  const store = useTravelStore();
  const [f, setF] = useState({ name: "", province: "", start: "", end: "", travelers: "2", budget: "", transport: "" });
  const [styles, setStyles] = useState<TravelStyle[]>([]);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return setError("nameRequired");
    if (f.start && f.end && f.end < f.start) return setError("dateOrder");
    const budget = f.budget === "" ? null : Number(f.budget);
    if (budget != null && (!Number.isFinite(budget) || budget < 0)) return setError("budgetInvalid");
    setError(null);
    const trip = await store.createTrip({
      name: f.name.trim(),
      provinceSlug: f.province || null,
      startDate: f.start || null,
      endDate: f.end || null,
      travelerCount: Number(f.travelers) || 1,
      budget,
      travelStyles: styles,
      transportMode: (f.transport || null) as TransportMode | null,
    });
    if (trip) {
      setF({ name: "", province: "", start: "", end: "", travelers: "2", budget: "", transport: "" });
      setStyles([]);
      onCreated(trip.id);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-3 p-5" noValidate>
      <h2 className="text-lg font-bold">{t("create")}</h2>
      <div>
        <label htmlFor="trip-name" className="label">
          {t("name")}
        </label>
        <input id="trip-name" className="input" required maxLength={120} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t("namePlaceholder")} />
      </div>
      <div>
        <label htmlFor="trip-prov" className="label">
          {t("destination")}
        </label>
        <select id="trip-prov" className="input" value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })}>
          <option value="">—</option>
          {provinces.map((p) => (
            <option key={p.slug} value={p.slug}>
              {localName(p, locale)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="trip-start" className="label">
            {t("startDate")}
          </label>
          <input id="trip-start" type="date" className="input" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
        </div>
        <div>
          <label htmlFor="trip-end" className="label">
            {t("endDate")}
          </label>
          <input id="trip-end" type="date" className="input" min={f.start || undefined} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="trip-trav" className="label">
            {t("travelers")}
          </label>
          <input id="trip-trav" type="number" min={1} max={50} className="input" value={f.travelers} onChange={(e) => setF({ ...f, travelers: e.target.value })} />
        </div>
        <div>
          <label htmlFor="trip-budget" className="label">
            {t("budget")}
          </label>
          <input id="trip-budget" type="number" min={0} step={100} inputMode="numeric" className="input" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} />
        </div>
      </div>
      <div>
        <label htmlFor="trip-transport" className="label">
          {t("transport")}
        </label>
        <select id="trip-transport" className="input" value={f.transport} onChange={(e) => setF({ ...f, transport: e.target.value })}>
          <option value="">—</option>
          {TRANSPORT_MODES.map((m) => (
            <option key={m} value={m}>
              {t(`mode.${m}`)}
            </option>
          ))}
        </select>
      </div>
      <StyleChips value={styles} onChange={setStyles} />
      {error && (
        <p role="alert" className="text-sm text-clay">
          {t(`errors.${error}`)}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={store.mode === "loading"}>
        <Plus className="h-4 w-4" aria-hidden="true" /> {t("create")}
      </button>
    </form>
  );
}

function TripEditor({ trip, provinces }: { trip: Trip; provinces: ProvinceOpt[] }) {
  const t = useTranslations("trips");
  const locale = useLocale();
  const store = useTravelStore();
  const router = useRouter();
  const [details, setDetails] = useState(() => ({
    name: trip.name,
    description: trip.description ?? "",
    provinceSlug: trip.provinceSlug ?? "",
    startDate: trip.startDate ?? "",
    endDate: trip.endDate ?? "",
    travelerCount: String(trip.travelerCount),
    budget: trip.budget?.toString() ?? "",
    transportMode: trip.transportMode ?? "",
    status: trip.status,
  }));
  const [styles, setStyles] = useState<TravelStyle[]>(trip.travelStyles);
  const [dirty, setDirty] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [extraDays, setExtraDays] = useState(0);
  const [info, setInfo] = useState<Record<string, PlaceInfo>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeItem, setRemoveItem] = useState<TripItem | null>(null);
  const first = useRef(true);

  // Autosave trip details (debounced).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setDirty(true);
    const h = setTimeout(() => {
      if (!details.name.trim()) return setDetailError("nameRequired");
      if (details.startDate && details.endDate && details.endDate < details.startDate) return setDetailError("dateOrder");
      const budget = details.budget === "" ? null : Number(details.budget);
      if (budget != null && (!Number.isFinite(budget) || budget < 0)) return setDetailError("budgetInvalid");
      setDetailError(null);
      store.updateTrip(trip.id, {
        name: details.name.trim().slice(0, 120),
        description: details.description.slice(0, 2000) || null,
        provinceSlug: details.provinceSlug || null,
        startDate: details.startDate || null,
        endDate: details.endDate || null,
        travelerCount: Number(details.travelerCount) || 1,
        budget,
        transportMode: (details.transportMode || null) as TransportMode | null,
        status: details.status,
        travelStyles: styles,
      });
      setDirty(false);
    }, 700);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details, styles]);

  // Place data (coordinates, sourced prices, opening hours) for items.
  const idsKey = trip.items.map((i) => i.placeId).sort().join(",");
  useEffect(() => {
    const missing = trip.items.map((i) => i.placeId).filter((id) => !info[id]);
    if (!missing.length) return;
    fetch(`/api/places?ids=${missing.slice(0, 100).join(",")}`)
      .then((r) => r.json())
      .then((json: { places: PlaceInfo[] }) => setInfo((c) => ({ ...c, ...Object.fromEntries(json.places.map((p) => [p.id, p])) })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const dayCount = Math.min(30, Math.max(daysBetween(trip.startDate, trip.endDate) ?? 1, trip.items.reduce((m, i) => Math.max(m, i.day), 1)) + extraDays);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);
  const ordered = [...trip.items].sort((a, b) => a.day - b.day || a.position - b.position);
  const prices = Object.fromEntries(Object.entries(info).map(([id, p]) => [id, p.price]));
  const points = ordered
    .filter((i) => info[i.placeId])
    .map((i, n) => ({
      id: i.id,
      lat: info[i.placeId].lat,
      lng: info[i.placeId].lng,
      label: `${t("day", { day: i.day })}: ${localName(i, locale)}`,
      href: `/thailand/${info[i.placeId].provinceSlug}/${info[i.placeId].slug}`,
      order: n + 1,
    }));
  const dateOfDay = (d: number) => {
    if (!trip.startDate) return null;
    const dt = new Date(`${trip.startDate}T00:00:00`);
    dt.setDate(dt.getDate() + d - 1);
    return dt.toISOString().slice(0, 10);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SaveIndicator dirty={dirty} />
        {store.mode === "local" && store.authConfigured && (
          <Link href={`/login?next=${encodeURIComponent(`/trips?trip=${trip.id}`)}`} className="text-xs font-semibold text-forest-700 underline">
            {t("signInToSync")}
          </Link>
        )}
      </div>

      <form className="card grid gap-4 p-5 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="sm:col-span-2">
          <label htmlFor="d-name" className="label">
            {t("name")}
          </label>
          <input id="d-name" className="input text-lg font-semibold" required maxLength={120} value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="d-desc" className="label">
            {t("description")}
          </label>
          <textarea id="d-desc" rows={2} maxLength={2000} className="input" value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} />
        </div>
        <div>
          <label htmlFor="d-prov" className="label">
            {t("destination")}
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
          <label htmlFor="d-status" className="label">
            {t("status")}
          </label>
          <select id="d-status" className="input" value={details.status} onChange={(e) => setDetails({ ...details, status: e.target.value as Trip["status"] })}>
            {(["planning", "booked", "completed", "archived"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`statusOpt.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="d-start" className="label">
            {t("startDate")}
          </label>
          <input id="d-start" type="date" className="input" value={details.startDate} onChange={(e) => setDetails({ ...details, startDate: e.target.value })} />
        </div>
        <div>
          <label htmlFor="d-end" className="label">
            {t("endDate")}
          </label>
          <input id="d-end" type="date" className="input" min={details.startDate || undefined} value={details.endDate} onChange={(e) => setDetails({ ...details, endDate: e.target.value })} />
        </div>
        <div>
          <label htmlFor="d-trav" className="label">
            {t("travelers")}
          </label>
          <input id="d-trav" type="number" min={1} max={50} className="input" value={details.travelerCount} onChange={(e) => setDetails({ ...details, travelerCount: e.target.value })} />
        </div>
        <div>
          <label htmlFor="d-budget" className="label">
            {t("budget")}
          </label>
          <input id="d-budget" type="number" min={0} step={100} inputMode="numeric" className="input" value={details.budget} onChange={(e) => setDetails({ ...details, budget: e.target.value })} />
        </div>
        <div>
          <label htmlFor="d-transport" className="label">
            {t("transport")}
          </label>
          <select id="d-transport" className="input" value={details.transportMode} onChange={(e) => setDetails({ ...details, transportMode: e.target.value as TransportMode })}>
            <option value="">—</option>
            {TRANSPORT_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`mode.${m}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <StyleChips value={styles} onChange={setStyles} />
        </div>
        {detailError && (
          <p role="alert" className="text-sm text-clay sm:col-span-2">
            {t(`errors.${detailError}`)}
          </p>
        )}
        <div className="flex justify-end sm:col-span-2">
          <button type="button" className="btn btn-ghost btn-sm text-clay" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> {t("deleteTrip")}
          </button>
        </div>
      </form>

      <p className="flex items-start gap-2 rounded-xl bg-gold-soft px-4 py-3 text-sm text-[#5f4612]">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {t("noBooking")}
      </p>

      <AddPlacePanel trip={trip} days={days} />

      {trip.items.length === 0 ? (
        <p className="muted">{t("noItems")}</p>
      ) : (
        days.map((d) => {
          const items = ordered.filter((i) => i.day === d);
          const stops = items.filter((i) => info[i.placeId]).map((i) => info[i.placeId]);
          const dir = directionsUrl(stops);
          return (
            <section key={d} className="card p-5" aria-labelledby={`day-${d}`}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`day-${d}`} className="text-lg font-bold">
                  {t("day", { day: d })}
                  {dateOfDay(d) && <span className="ml-2 text-sm font-normal muted">{formatDate(dateOfDay(d), locale)}</span>}
                </h2>
                {dir && (
                  <a href={dir} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-forest-700 hover:underline">
                    <Navigation className="h-4 w-4" aria-hidden="true" /> {t("directions")}
                  </a>
                )}
              </div>
              {items.length === 0 ? (
                <p className="text-sm muted">—</p>
              ) : (
                <ol className="space-y-3">
                  {items.map((i, idx) => (
                    <ItemRow
                      key={i.id}
                      trip={trip}
                      item={i}
                      info={info[i.placeId]}
                      days={days}
                      first={idx === 0}
                      last={idx === items.length - 1}
                      onRemove={() => setRemoveItem(i)}
                    />
                  ))}
                </ol>
              )}
            </section>
          );
        })
      )}
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExtraDays((x) => x + 1)} disabled={dayCount >= 30}>
        <Plus className="h-4 w-4" aria-hidden="true" /> {t("addDay")}
      </button>

      <TripBudget trip={trip} prices={prices} />

      {points.length > 0 && <PointsMap label={t("routeMap")} points={points} route height={360} />}

      <ConfirmDialog
        open={confirmDelete}
        title={t("deleteConfirm")}
        body={t("deleteConfirmBody")}
        confirmLabel={t("deleteTrip")}
        cancelLabel={t("cancel")}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          store.deleteTrip(trip.id);
          router.replace("/trips");
        }}
      />
      <ConfirmDialog
        open={Boolean(removeItem)}
        title={t("removeItemConfirm", { name: removeItem ? localName(removeItem, locale) : "" })}
        confirmLabel={t("remove")}
        cancelLabel={t("cancel")}
        danger
        onCancel={() => setRemoveItem(null)}
        onConfirm={() => {
          if (removeItem) store.removeTripItem(trip.id, removeItem.id);
          setRemoveItem(null);
        }}
      />
    </div>
  );
}

function ItemRow({
  trip,
  item: i,
  info,
  days,
  first,
  last,
  onRemove,
}: {
  trip: Trip;
  item: TripItem;
  info?: PlaceInfo;
  days: number[];
  first: boolean;
  last: boolean;
  onRemove: () => void;
}) {
  const t = useTranslations("trips");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const store = useTravelStore();
  const numOrNull = (v: string) => (v === "" ? null : Math.max(0, Number(v)));
  const category: CostCategory = i.costCategory ?? defaultCostCategory(i.category);
  return (
    <li className="rounded-xl border border-sage-100 p-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          {info ? (
            <Link href={`/thailand/${info.provinceSlug}/${info.slug}`} className="font-semibold hover:underline">
              {localName(i, locale)}
            </Link>
          ) : (
            <span className="font-semibold">{localName(i, locale)}</span>
          )}
          <p className="text-xs muted">
            {i.category ? tc(i.category) : ""}
            {info?.openingHours ? ` · ${t("hours")}: ${info.openingHours}` : ` · ${t("hoursUnknown")}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="btn btn-ghost btn-sm !p-2" disabled={first} onClick={() => store.moveTripItem(trip.id, i.id, -1)} aria-label={t("moveUp")}>
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-ghost btn-sm !p-2" disabled={last} onClick={() => store.moveTripItem(trip.id, i.id, 1)} aria-label={t("moveDown")}>
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <label className="sr-only" htmlFor={`mv-${i.id}`}>
            {t("moveDay")}
          </label>
          <select id={`mv-${i.id}`} className="input !w-auto !py-1 text-sm" value={i.day} onChange={(e) => store.updateTripItem(trip.id, i.id, { day: Number(e.target.value), position: 999 })}>
            {days.map((dd) => (
              <option key={dd} value={dd}>
                {t("day", { day: dd })}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-ghost btn-sm !p-2 text-clay" onClick={onRemove} aria-label={`${t("remove")} ${localName(i, locale)}`}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[repeat(2,110px)_minmax(0,1fr)]">
        <label className="text-xs">
          <span className="muted">{t("startTime")}</span>
          <input type="time" className="input !py-1 text-sm" defaultValue={i.startTime ?? ""} onBlur={(e) => e.target.value !== (i.startTime ?? "") && store.updateTripItem(trip.id, i.id, { startTime: e.target.value || null })} />
        </label>
        <label className="text-xs">
          <span className="muted">{t("endTime")}</span>
          <input type="time" className="input !py-1 text-sm" defaultValue={i.endTime ?? ""} onBlur={(e) => e.target.value !== (i.endTime ?? "") && store.updateTripItem(trip.id, i.id, { endTime: e.target.value || null })} />
        </label>
        <label className="text-xs">
          <span className="muted">{t("notes")}</span>
          <input className="input !py-1 text-sm" maxLength={1000} defaultValue={i.note ?? ""} onBlur={(e) => e.target.value !== (i.note ?? "") && store.updateTripItem(trip.id, i.id, { note: e.target.value || null })} />
        </label>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label className="text-xs">
          <span className="muted">{t("category")}</span>
          <select className="input !py-1 text-sm" value={category} onChange={(e) => store.updateTripItem(trip.id, i.id, { costCategory: e.target.value as CostCategory })}>
            {COST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`cost.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="muted">
            {t("itemCost")} <span className="badge !px-1.5 !py-0">{t("estimated")}</span>
          </span>
          <input type="number" min={0} step={10} inputMode="numeric" className="input !py-1 text-sm" defaultValue={i.estimatedCost ?? ""} onBlur={(e) => numOrNull(e.target.value) !== (i.estimatedCost ?? null) && store.updateTripItem(trip.id, i.id, { estimatedCost: numOrNull(e.target.value) })} />
        </label>
        <label className="text-xs">
          <span className="muted">{t("actualCost")}</span>
          <input type="number" min={0} step={10} inputMode="numeric" className="input !py-1 text-sm" defaultValue={i.actualCost ?? ""} onBlur={(e) => numOrNull(e.target.value) !== (i.actualCost ?? null) && store.updateTripItem(trip.id, i.id, { actualCost: numOrNull(e.target.value) })} />
        </label>
      </div>
      {info?.price && i.estimatedCost == null && i.actualCost == null && (
        <p className="mt-1 text-xs text-forest-700">
          {t("providerPriceUsed", {
            price: info.price.min === info.price.max ? `${info.price.min}` : `${info.price.min}–${info.price.max}`,
            source: info.price.source,
          })}
        </p>
      )}
    </li>
  );
}

function AddPlacePanel({ trip, days }: { trip: Trip; days: number[] }) {
  const t = useTranslations("trips");
  const tg = useTranslations("groups");
  const tc = useTranslations("categories");
  const locale = useLocale();
  const store = useTravelStore();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<CategoryGroup | "">("");
  const [day, setDay] = useState(1);
  const [results, setResults] = useState<PlaceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim() && !group) return setResults([]);
    setLoading(true);
    const h = setTimeout(async () => {
      const sp = new URLSearchParams({ q, limit: "10" });
      if (trip.provinceSlug) sp.set("province", trip.provinceSlug);
      if (group) sp.set("group", group);
      try {
        const json = await (await fetch(`/api/search?${sp}`)).json();
        setResults(json.places ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [q, group, trip.provinceSlug]);

  const add = async (p: PlaceSummary) => {
    const ok = await store.addTripItem(trip.id, { placeId: p.id, provinceSlug: p.provinceSlug, category: p.category, nameTh: p.nameTh, nameEn: p.nameEn }, day);
    setNotice(ok ? t("addedToTrip", { name: localName(p, locale) }) : t("duplicate"));
    setTimeout(() => setNotice(null), 2500);
  };

  return (
    <section className="card space-y-3 p-5" aria-labelledby="add-place">
      <h2 id="add-place" className="text-lg font-bold">
        {t("addPlace")}
      </h2>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("category")}>
        <button type="button" className="chip !px-3 !py-1 text-xs" aria-pressed={!group} onClick={() => setGroup("")}>
          {t("all")}
        </button>
        {CATEGORY_GROUP_IDS.map((g) => (
          <button key={g} type="button" className="chip !px-3 !py-1 text-xs" aria-pressed={group === g} onClick={() => setGroup(group === g ? "" : g)}>
            {tg(g)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-500" aria-hidden="true" />
          <label htmlFor="add-q" className="sr-only">
            {t("searchPlace")}
          </label>
          <input id="add-q" type="search" maxLength={100} className="input pl-9" placeholder={t("searchPlace")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label htmlFor="add-day" className="sr-only">
          {t("moveDay")}
        </label>
        <select id="add-day" className="input !w-auto" value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {days.map((d) => (
            <option key={d} value={d}>
              {t("day", { day: d })}
            </option>
          ))}
        </select>
      </div>
      {trip.provinceSlug && <p className="text-xs muted">{t("searchScoped")}</p>}
      {notice && (
        <p role="status" className="text-sm text-forest-700">
          {notice}
        </p>
      )}
      {loading && <p className="text-sm muted">{t("loading")}</p>}
      {!loading && (q.trim() || group) && results.length === 0 && <p className="text-sm muted">{t("noResults")}</p>}
      {results.length > 0 && (
        <ul className="divide-y divide-sage-100 rounded-xl border border-sage-200">
          {results.map((p) => {
            const inTrip = trip.items.some((i) => i.placeId === p.id);
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{localName(p, locale)}</span>
                  <span className="text-xs muted">{tc(p.category)}</span>
                </span>
                <button type="button" className="btn btn-secondary btn-sm" disabled={inTrip} onClick={() => add(p)}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> {inTrip ? t("inTrip") : t("add")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
