"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Lock, MapPinned, Route, Star } from "lucide-react";
import { ThailandMap } from "@/components/map/ThailandMap";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import { computePassport } from "@/lib/passport";
import { formatDate, localName } from "@/lib/display";
import type { ProvinceSummary, RegionId } from "@/lib/types";

const REGIONS: RegionId[] = ["north", "northeast", "central", "east", "west", "south"];

export function PassportClient({ provinces }: { provinces: ProvinceSummary[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const { state, mode } = useTravelStore();

  if (mode === "loading") return <div className="h-96 rounded-[var(--radius-card)] skeleton" aria-hidden="true" />;
  if (mode === "guest") {
    return (
      <EmptyState
        title={t("auth.signInRequired")}
        body={t("auth.signInToSave")}
        action={
          <Link href="/login?next=/passport" className="btn btn-primary">
            {t("auth.signIn")}
          </Link>
        }
      />
    );
  }

  const m = computePassport(state, provinces);
  const pBySlug = new Map(provinces.map((p) => [p.slug, p]));
  const pName = (slug: string) => {
    const p = pBySlug.get(slug);
    return p ? localName(p, locale) : slug;
  };
  const stat = (label: string, value: string | number, accent = false) => (
    <div className={`card p-5 ${accent ? "bg-forest-700 text-white" : ""}`}>
      <p className={`text-sm ${accent ? "text-forest-100" : "muted"}`}>{label}</p>
      <p className={`mt-1 text-3xl font-bold ${accent ? "text-white" : "text-forest-900"}`}>{value}</p>
    </div>
  );
  const visitedList = Object.entries(state.provinces).filter(([, v]) => v.status === "visited");
  const wantList = Object.entries(state.provinces).filter(([, v]) => v.status === "want");
  const empty = m.visitedProvinces === 0 && m.visitedPlaces === 0 && m.wantProvinces === 0 && m.wishlistCount === 0;

  return (
    <div className="space-y-10">
      <p className="flex items-center gap-2 text-sm muted">
        <Lock className="h-4 w-4" aria-hidden="true" /> {t("passport.privacy")}
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stat(t("passport.visitedProvinces"), `${m.visitedProvinces}/77`, true)}
        {stat(t("passport.unvisitedProvinces"), m.unvisitedProvinces)}
        {stat(t("passport.visitedPlaces"), m.visitedPlaces)}
        {stat(t("passport.wantProvinces"), m.wantProvinces)}
      </div>

      <section aria-labelledby="progress" className="card p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="progress" className="text-xl font-bold">
            {t("passport.progress")}
          </h2>
          <p className="text-3xl font-bold text-forest-700">{m.progressPct}%</p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-sage-100" role="progressbar" aria-valuenow={m.progressPct} aria-valuemin={0} aria-valuemax={100} aria-labelledby="progress">
          <div className="h-full rounded-full bg-gradient-to-r from-forest-500 to-forest-700" style={{ width: `${m.progressPct}%` }} />
        </div>
        <p className="mt-2 text-xs muted">{t("passport.progressDef")}</p>
        {m.partialProvinces > 0 && (
          <p className="mt-1 text-sm">
            {t("passport.partialProvinces")}: <strong>{m.partialProvinces}</strong>
          </p>
        )}
      </section>

      {empty && (
        <EmptyState
          title={t("passport.empty")}
          action={
            <Link href="/explore" className="btn btn-primary">
              {t("passport.startExploring")}
            </Link>
          }
        />
      )}

      <section aria-labelledby="pmap">
        <h2 id="pmap" className="section-title mb-4">
          {t("passport.mapTitle")}
        </h2>
        <ThailandMap provinces={provinces} height="clamp(360px, 60vh, 560px)" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="byregion" className="card p-6">
          <h2 id="byregion" className="mb-4 text-xl font-bold">
            {t("passport.byRegion")}
          </h2>
          <ul className="space-y-3">
            {REGIONS.map((r) => {
              const v = m.byRegion[r] ?? { visited: 0, total: 0 };
              return (
                <li key={r}>
                  <div className="flex justify-between text-sm">
                    <span>{t(`regions.${r}`)}</span>
                    <span className="font-semibold">
                      {v.visited}/{v.total}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-sage-100">
                    <div className="h-full rounded-full bg-forest-500" style={{ width: `${v.total ? (v.visited / v.total) * 100 : 0}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-labelledby="bycat" className="card p-6">
          <h2 id="bycat" className="mb-4 text-xl font-bold">
            {t("passport.byCategory")}
          </h2>
          {m.byCategory.length === 0 ? (
            <p className="text-sm muted">—</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {m.byCategory.map((c) => (
                <li key={c.category} className="badge text-sm">
                  {c.category ? t(`categories.${c.category}`) : "—"} · {c.count}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="pstates" className="card p-6">
          <h2 id="pstates" className="mb-4 text-xl font-bold">
            {t("passport.provinceStates")}
          </h2>
          <h3 className="text-sm font-semibold text-forest-700">{t("explore.statusVisited")}</h3>
          <div className="mb-4 mt-2 flex flex-wrap gap-2">
            {visitedList.length ? visitedList.map(([s]) => <Link key={s} href={`/thailand/${s}`} className="chip">{pName(s)}</Link>) : <span className="text-sm muted">—</span>}
          </div>
          <h3 className="text-sm font-semibold text-[#8a6416]">{t("explore.statusWant")}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {wantList.length ? wantList.map(([s]) => <Link key={s} href={`/thailand/${s}`} className="chip">{pName(s)}</Link>) : <span className="text-sm muted">—</span>}
          </div>
        </section>
        <section aria-labelledby="trips" className="card p-6">
          <h2 id="trips" className="mb-4 flex items-center gap-2 text-xl font-bold">
            <Route className="h-5 w-5 text-forest-600" aria-hidden="true" />
            {t("passport.plannedTrips")}
          </h2>
          {state.trips.length === 0 ? (
            <Link href="/trips" className="btn btn-secondary btn-sm">
              {t("trips.create")}
            </Link>
          ) : (
            <ul className="space-y-2">
              {state.trips.slice(0, 5).map((tr) => (
                <li key={tr.id}>
                  <Link href={`/trips?trip=${tr.id}`} className="flex justify-between gap-3 rounded-xl px-3 py-2 hover:bg-forest-50">
                    <span className="font-medium">{tr.name}</span>
                    <span className="text-sm muted">{tr.startDate ? formatDate(tr.startDate, locale) : t("common.places", { count: tr.items.length })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="timeline">
        <h2 id="timeline" className="section-title mb-4 flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-forest-600" aria-hidden="true" /> {t("passport.timeline")}
        </h2>
        {m.timeline.length === 0 ? (
          <p className="muted">—</p>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-forest-200 pl-6">
            {m.timeline.slice(0, 50).map((v) => (
              <li key={v.placeId} className="relative">
                <span className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full border-2 border-white bg-forest-600" aria-hidden="true" />
                <p className="text-xs font-semibold text-forest-600">{formatDate(v.visitedOn, locale)}</p>
                <p className="font-semibold">{localName(v, locale)}</p>
                <p className="text-sm muted">
                  <MapPinned className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                  {pName(v.provinceSlug)} · {v.category ? t(`categories.${v.category}`) : ""}
                  {v.rating ? (
                    <span className="ml-2 inline-flex items-center gap-0.5 text-gold">
                      <Star className="h-3.5 w-3.5 fill-gold" aria-hidden="true" /> {v.rating}/5
                    </span>
                  ) : null}
                </p>
                {v.note && <p className="mt-1 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">{v.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="tovisit">
        <h2 id="tovisit" className="section-title mb-4">
          {t("passport.toVisit")}
        </h2>
        {m.wishlistCount === 0 ? (
          <p className="muted">{t("wishlist.empty")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.values(state.wishlist)
              .slice(0, 20)
              .map((w) => (
                <span key={w.placeId} className="chip">
                  {localName(w, locale)} <span className="opacity-60">· {pName(w.provinceSlug)}</span>
                </span>
              ))}
            <Link href="/wishlist" className="btn btn-secondary btn-sm">
              {t("common.seeAll")}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
