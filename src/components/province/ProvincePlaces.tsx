"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { PlaceCard } from "@/components/place/PlaceCard";
import { VenueCard } from "@/components/place/VenueCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import { CATEGORY_GROUP_IDS, groupOfCategory, type CategoryGroup } from "@/lib/categories";
import type { PlaceSummary } from "@/lib/types";

export type ProvincePlace = PlaceSummary & { cuisine?: string[] | null; openingHours?: string | null };

const PAGE = 12;

export function ProvincePlaces({ places }: { places: ProvincePlace[] }) {
  const t = useTranslations();
  const { state } = useTravelStore();
  const [group, setGroup] = useState<CategoryGroup | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const [visit, setVisit] = useState<"all" | "visited" | "unvisited">("all");
  const [shown, setShown] = useState(PAGE);

  const counts = useMemo(() => {
    const c = new Map<CategoryGroup, number>();
    for (const p of places) {
      const g = groupOfCategory(p.category);
      if (g) c.set(g, (c.get(g) ?? 0) + 1);
    }
    return c;
  }, [places]);
  const hasFree = places.some((p) => p.fee === "free");

  const filtered = places.filter(
    (p) =>
      (!group || groupOfCategory(p.category) === group) &&
      (!freeOnly || p.fee === "free") &&
      (visit === "all" || (visit === "visited" ? !!state.visits[p.id] : !state.visits[p.id])),
  );

  const reset = () => setShown(PAGE);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("common.filters")}>
        <button type="button" className="chip" aria-pressed={!group} onClick={() => (setGroup(null), reset())}>
          {t("province.filterAll")} <span className="opacity-70">{places.length}</span>
        </button>
        {CATEGORY_GROUP_IDS.filter((g) => counts.get(g)).map((g) => (
          <button key={g} type="button" className="chip" aria-pressed={group === g} onClick={() => (setGroup(group === g ? null : g), reset())}>
            {t(`groups.${g}`)} <span className="opacity-70">{counts.get(g)}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {hasFree && (
          <button type="button" className="chip" aria-pressed={freeOnly} onClick={() => (setFreeOnly(!freeOnly), reset())}>
            {t("province.filterFree")}
          </button>
        )}
        {(["all", "unvisited", "visited"] as const).map((v) => (
          <button key={v} type="button" className="chip" aria-pressed={visit === v} onClick={() => (setVisit(v), reset())}>
            {v === "all" ? t("common.all") : v === "visited" ? t("province.filterVisited") : t("province.filterUnvisited")}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState title={t("common.noResults")} body={t("province.empty")} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.slice(0, shown).map((p) =>
              p.image || p.kind === "attraction" ? (
                <PlaceCard key={p.id} place={p} />
              ) : (
                <VenueCard key={p.id} place={p} cuisine={p.cuisine} openingHours={p.openingHours} />
              ),
            )}
          </div>
          {shown < filtered.length && (
            <div className="text-center">
              <button type="button" className="btn btn-secondary" onClick={() => setShown((s) => s + PAGE)}>
                {t("common.showMore")} ({filtered.length - shown})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
