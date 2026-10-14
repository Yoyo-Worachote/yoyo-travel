"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Check, ListPlus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import { groupWishlistByProvince } from "@/lib/travel-state";
import { localName } from "@/lib/display";

export function WishlistClient({ provinces }: { provinces: Array<{ slug: string; nameTh: string; nameEn: string }> }) {
  const t = useTranslations();
  const locale = useLocale();
  const store = useTravelStore();
  const [tripFor, setTripFor] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const pBySlug = new Map(provinces.map((p) => [p.slug, p]));
  const pName = (slug: string) => {
    const p = pBySlug.get(slug);
    return p ? localName(p, locale) : slug;
  };

  if (store.mode === "loading") return <div className="h-64 rounded-[var(--radius-card)] skeleton" aria-hidden="true" />;
  if (store.mode === "guest") {
    return (
      <EmptyState
        title={t("auth.signInRequired")}
        body={t("auth.signInToSave")}
        action={
          <Link href="/login?next=/wishlist" className="btn btn-primary">
            {t("auth.signIn")}
          </Link>
        }
      />
    );
  }

  const groups = groupWishlistByProvince(store.state);
  const wantProvinces = Object.entries(store.state.provinces).filter(([, v]) => v.status === "want").map(([s]) => s);

  const addTo = async (placeId: string, tripId: string) => {
    const item = store.state.wishlist[placeId];
    if (!item) return;
    const { addedAt: _a, ...ref } = item;
    void _a;
    let ok = true;
    if (tripId === "__new") await store.createTrip({ name: pName(ref.provinceSlug), provinceSlug: ref.provinceSlug }, [ref]);
    else ok = await store.addTripItem(tripId, ref);
    setMsg(ok ? t("place.addedToTrip") : t("trips.duplicate"));
    setTripFor(null);
    setTimeout(() => setMsg(null), 2500);
  };

  return (
    <div className="space-y-8">
      {msg && (
        <p role="status" className="rounded-xl bg-forest-50 px-4 py-2 text-sm font-medium text-forest-800">
          {msg}
        </p>
      )}
      {wantProvinces.length > 0 && (
        <section aria-labelledby="want-prov">
          <h2 id="want-prov" className="mb-3 text-lg font-bold">
            {t("wishlist.wantProvinces")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {wantProvinces.map((s) => (
              <Link key={s} href={`/thailand/${s}`} className="chip">
                {pName(s)}
              </Link>
            ))}
          </div>
        </section>
      )}
      {Object.keys(groups).length === 0 ? (
        <EmptyState
          title={t("wishlist.empty")}
          action={
            <Link href="/explore" className="btn btn-primary">
              {t("passport.startExploring")}
            </Link>
          }
        />
      ) : (
        Object.entries(groups)
          .sort(([a], [b]) => pName(a).localeCompare(pName(b), locale))
          .map(([slug, items]) => (
            <section key={slug} aria-labelledby={`w-${slug}`} className="card p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 id={`w-${slug}`} className="text-xl font-bold">
                  <Link href={`/thailand/${slug}`} className="hover:underline">
                    {pName(slug)}
                  </Link>
                </h2>
                <span className="text-sm muted">{t("wishlist.count", { count: items.length })}</span>
              </div>
              <ul className="divide-y divide-sage-100">
                {items.map((w) => (
                  <li key={w.placeId} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{localName(w, locale)}</p>
                      <p className="text-xs muted">{w.category ? t(`categories.${w.category}`) : ""}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => store.moveWishlistToVisited(w.placeId)}>
                        <Check className="h-4 w-4" aria-hidden="true" /> {t("wishlist.moveToVisited")}
                      </button>
                      {tripFor === w.placeId ? (
                        <select
                          className="input !w-auto !py-1 text-sm"
                          aria-label={t("trips.selectTrip")}
                          autoFocus
                          defaultValue=""
                          onChange={(e) => e.target.value && addTo(w.placeId, e.target.value)}
                          onBlur={() => setTripFor(null)}
                        >
                          <option value="">{t("trips.selectTrip")}</option>
                          {store.state.trips.map((tr) => (
                            <option key={tr.id} value={tr.id}>
                              {tr.name}
                            </option>
                          ))}
                          <option value="__new">+ {t("place.newTrip")}</option>
                        </select>
                      ) : (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTripFor(w.placeId)}>
                          <ListPlus className="h-4 w-4" aria-hidden="true" /> {t("wishlist.moveToTrip")}
                        </button>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => store.removeWishlist(w.placeId)} aria-label={`${t("common.remove")} ${localName(w, locale)}`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
    </div>
  );
}
