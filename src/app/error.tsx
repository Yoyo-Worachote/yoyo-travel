"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  useEffect(() => {
    console.error(error.digest ?? "client error");
  }, [error]);
  return (
    <div className="container-page grid min-h-[50vh] place-items-center py-16 text-center">
      <div>
        <h1 className="text-2xl font-bold">{t("errors.generic")}</h1>
        <button type="button" onClick={reset} className="btn btn-primary mt-6">
          {t("common.retry")}
        </button>
      </div>
    </div>
  );
}
