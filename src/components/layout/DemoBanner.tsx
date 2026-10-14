"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AlertTriangle, CloudOff, Download, Info, Loader2, RefreshCw, X } from "lucide-react";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";

const DISMISS_KEY = "yoyo-travel:guest-banner-dismissed";

/**
 * Status strip under the header:
 * - guest mode (data only in this browser, not synced)
 * - browser storage unavailable
 * - cloud save failed → retry
 * - guest data found after sign-in → import into the account
 */
export function DemoBanner({ supabaseConfigured }: { supabaseConfigured: boolean }) {
  const t = useTranslations("auth");
  const pathname = usePathname();
  const store = useTravelStore();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const next = encodeURIComponent(pathname || "/");

  if (store.mode === "loading") return null;

  if (!store.storageOk) {
    return (
      <div role="alert" className="border-b border-clay/30 bg-clay-soft">
        <div className="container-page flex flex-wrap items-center gap-2 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-clay" aria-hidden="true" />
          <span>{t("storageUnavailable")}</span>
        </div>
      </div>
    );
  }

  if (store.mode === "cloud" && store.importOffer) {
    const c = store.importOffer.counts;
    return (
      <div role="region" aria-label={t("importTitle")} className="border-b border-forest-200 bg-forest-50">
        <div className="container-page flex flex-wrap items-center gap-3 py-3 text-sm">
          <Download className="h-5 w-5 shrink-0 text-forest-700" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-forest-900">{t("importTitle")}</p>
            <p className="muted">{t("importBody", { trips: c.trips, wishlist: c.wishlist, visits: c.visits, provinces: c.provinces })}</p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={store.importing} onClick={() => store.importGuestData()}>
            {store.importing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("importNow")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={store.importing} onClick={store.dismissImport}>
            {t("importLater")}
          </button>
        </div>
      </div>
    );
  }

  if (store.mode === "cloud" && store.syncStatus === "error") {
    return (
      <div role="alert" className="border-b border-clay/30 bg-clay-soft">
        <div className="container-page flex flex-wrap items-center gap-3 py-2 text-sm">
          <CloudOff className="h-4 w-4 shrink-0 text-clay" aria-hidden="true" />
          <span className="flex-1">{t("syncFailed", { count: store.pendingSaves })}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={store.retrySync}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  if (store.mode !== "local" || dismissed || pathname?.startsWith("/login") || pathname?.startsWith("/register")) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div role="status" className="border-b border-gold/30 bg-gold-soft text-[#5f4612]">
      <div className="container-page flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
        <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">{supabaseConfigured ? t("guestBanner") : t("demoBanner")}</span>
        {supabaseConfigured ? (
          <span className="flex gap-3">
            <Link href={`/login?next=${next}`} className="font-semibold underline underline-offset-2">
              {t("signIn")}
            </Link>
            <Link href={`/register?next=${next}`} className="font-semibold underline underline-offset-2">
              {t("register")}
            </Link>
          </span>
        ) : (
          <Link href="/privacy#setup" className="font-semibold underline underline-offset-2">
            {t("demoBannerLink")}
          </Link>
        )}
        <button type="button" onClick={dismiss} aria-label={t("dismiss")} className="rounded p-1 hover:bg-black/5">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
