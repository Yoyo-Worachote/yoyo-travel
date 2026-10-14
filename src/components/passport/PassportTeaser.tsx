"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BookMarked, Heart, Stamp } from "lucide-react";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import { computePassport } from "@/lib/passport";
import type { RegionId } from "@/lib/types";

export function PassportTeaser({ provinces }: { provinces: Array<{ slug: string; region: RegionId }> }) {
  const t = useTranslations();
  const { state, mode, authConfigured } = useTravelStore();
  if (mode === "loading") return <div className="h-32 rounded-[var(--radius-card)] skeleton" aria-hidden="true" />;
  const m = computePassport(state, provinces);
  return (
    <section aria-labelledby="passport-teaser" className="card grid gap-6 p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-forest-700 text-white">
        <Stamp className="h-8 w-8" aria-hidden="true" />
      </span>
      <div>
        <h2 id="passport-teaser" className="text-xl font-bold">
          {t("home.passportTitle")}
        </h2>
        <p className="text-sm muted">
          {t("passport.visitedProvinces")}: <strong className="text-forest-800">{m.visitedProvinces}/77</strong> ·{" "}
          {t("passport.visitedPlaces")}: <strong className="text-forest-800">{m.visitedPlaces}</strong>
        </p>
        <div
          className="mt-3 h-2.5 w-full max-w-md overflow-hidden rounded-full bg-sage-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={m.progressPct}
          aria-label={t("passport.progress")}
        >
          <div className="h-full rounded-full bg-forest-600" style={{ width: `${m.progressPct}%` }} />
        </div>
        {mode === "local" && authConfigured && <p className="mt-2 text-xs muted">{t("auth.guestNotSynced")}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/passport" className="btn btn-primary">
          <BookMarked className="h-4 w-4" aria-hidden="true" /> {t("home.passportCta")}
        </Link>
        <Link href="/wishlist" className="btn btn-secondary">
          <Heart className="h-4 w-4" aria-hidden="true" /> {t("home.wishlistCta")}
          {m.wishlistCount > 0 && <span className="badge">{m.wishlistCount}</span>}
        </Link>
      </div>
    </section>
  );
}
