"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, CloudOff, HardDrive, Loader2, RefreshCw } from "lucide-react";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";

/** Saving / Saved / Failed status for the current storage (browser or account). */
export function SaveIndicator({ dirty = false }: { dirty?: boolean }) {
  const t = useTranslations("trips");
  const { mode, syncStatus, retrySync, storageOk } = useTravelStore();
  if (mode === "loading") return null;
  if (mode === "local") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs ${storageOk ? "muted" : "text-clay"}`} role="status">
        {dirty ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />}
        {!storageOk ? t("saveLocalFailed") : dirty ? t("saving") : t("savedLocal")}
      </span>
    );
  }
  if (dirty || syncStatus === "saving")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs muted" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> {t("saving")}
      </span>
    );
  if (syncStatus === "error")
    return (
      <span className="inline-flex items-center gap-2 text-xs text-clay" role="alert">
        <CloudOff className="h-3.5 w-3.5" aria-hidden="true" /> {t("saveFailed")}
        <button type="button" onClick={retrySync} className="inline-flex items-center gap-1 font-semibold underline">
          <RefreshCw className="h-3 w-3" aria-hidden="true" /> {t("retry")}
        </button>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-forest-700" role="status">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("savedCloud")}
    </span>
  );
}
