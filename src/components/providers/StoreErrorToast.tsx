"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";
import { useTravelStore } from "./TravelStoreProvider";

export function StoreErrorToast() {
  const { error, clearError } = useTravelStore();
  const t = useTranslations();
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(clearError, 7000);
    return () => clearTimeout(id);
  }, [error, clearError]);
  if (!error) return null;
  const signIn = error === "signin_required";
  return (
    <div role="alert" className="fixed bottom-24 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 card flex items-start gap-3 p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-clay" aria-hidden="true" />
      <div className="flex-1 text-sm">
        {signIn ? (
          <>
            <p className="font-semibold">{t("auth.signInRequired")}</p>
            <p className="muted">{t("auth.signInToSave")}</p>
            <Link href="/login" className="btn btn-primary btn-sm mt-2" onClick={clearError}>
              {t("auth.signIn")}
            </Link>
          </>
        ) : (
          <p>{t("errors.saveFailed")}</p>
        )}
      </div>
      <button type="button" onClick={clearError} aria-label={t("common.close")} className="text-charcoal-soft hover:text-charcoal">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
