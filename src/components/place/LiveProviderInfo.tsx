"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { formatBaht, formatDate, formatNumber } from "@/lib/display";
import type { LivePlaceInfo } from "@/lib/providers/types";

type State = { status: "loading" } | { status: "off" } | { status: "none" } | { status: "error" } | { status: "ok"; info: LivePlaceInfo };

/** Rating / review count / price range from a licensed live provider — only when configured. */
export function LiveProviderInfo({ placeId }: { placeId: string }) {
  const t = useTranslations("place");
  const locale = useLocale();
  const [s, setS] = useState<State>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/places/${placeId}/live`)
      .then(async (r) => {
        const json = await r.json().catch(() => null);
        if (cancelled) return;
        if (!json || (!r.ok && json?.error)) return setS({ status: "error" });
        if (!json.configured) return setS({ status: "off" });
        setS(json.info ? { status: "ok", info: json.info } : { status: "none" });
      })
      .catch(() => !cancelled && setS({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  if (s.status === "loading") return <div className="h-5 w-40 rounded skeleton" aria-hidden="true" />;
  if (s.status !== "ok") {
    return <p className="muted">{s.status === "error" ? t("ratingError") : s.status === "none" ? t("ratingNoMatch") : t("ratingUnavailable")}</p>;
  }
  const i = s.info;
  return (
    <div className="space-y-1">
      {i.rating != null ? (
        <p className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-gold text-gold" aria-hidden="true" />
          <strong>{i.rating.toFixed(1)}</strong>
          {i.reviewCount != null && <span className="muted">({t("reviewCount", { count: formatNumber(i.reviewCount, locale) })})</span>}
        </p>
      ) : (
        <p className="muted">{t("ratingUnavailable")}</p>
      )}
      {i.priceRange && (i.priceRange.min != null || i.priceRange.max != null) && (
        <p>
          {t("providerPriceRange")}:{" "}
          {[i.priceRange.min, i.priceRange.max]
            .filter((v): v is number => v != null)
            .map((v) => formatBaht(v, locale))
            .join(" – ")}
        </p>
      )}
      <p className="text-xs muted">
        {t("liveSource", { provider: i.attribution, date: formatDate(i.fetchedAt, locale) })}
        {i.mapsUrl && (
          <>
            {" · "}
            <a href={i.mapsUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {t("viewOnProvider", { provider: i.provider })}
            </a>
          </>
        )}
      </p>
    </div>
  );
}
