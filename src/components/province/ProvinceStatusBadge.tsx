"use client";

import { useTranslations } from "next-intl";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import { provinceMapStatus } from "@/lib/passport";

export function ProvinceStatusBadge({ slug }: { slug: string }) {
  const { state } = useTravelStore();
  const t = useTranslations("explore");
  const status = provinceMapStatus(state, slug);
  if (status === "none") return null;
  const cls =
    status === "visited"
      ? "bg-forest-600 text-white"
      : status === "partial"
        ? "bg-sage-200 text-forest-900"
        : "bg-gold-soft text-[#6b4f12]";
  const label = status === "visited" ? t("statusVisited") : status === "partial" ? t("statusPartial") : t("statusWant");
  return <span className={`absolute right-3 top-3 badge ${cls}`}>{label}</span>;
}
