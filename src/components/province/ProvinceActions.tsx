"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Dices, Heart, MessageCircle, X } from "lucide-react";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import { useChat } from "@/components/chat/ChatContext";

export function ProvinceActions({ slug, name }: { slug: string; name: string }) {
  const t = useTranslations("province");
  const { state, setProvinceStatus, mode } = useTravelStore();
  const { ask } = useChat();
  const status = state.provinces[slug]?.status ?? null;
  const disabled = mode === "loading";

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={status === "visited"}
        onClick={() => setProvinceStatus(slug, status === "visited" ? null : "visited")}
        className={`btn ${status === "visited" ? "btn-primary" : "btn-secondary"}`}
      >
        <Check className="h-4 w-4" aria-hidden="true" />
        {t("markVisited")}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={status === "want"}
        onClick={() => setProvinceStatus(slug, status === "want" ? null : "want")}
        className={`btn ${status === "want" ? "bg-want text-white" : "btn-secondary"}`}
      >
        <Heart className="h-4 w-4" aria-hidden="true" />
        {t("markWant")}
      </button>
      {status && (
        <button type="button" onClick={() => setProvinceStatus(slug, null)} className="btn btn-ghost btn-sm">
          <X className="h-4 w-4" aria-hidden="true" />
          {t("clearStatus")}
        </button>
      )}
      <Link href={`/random?tab=place&province=${slug}`} className="btn btn-secondary">
        <Dices className="h-4 w-4" aria-hidden="true" />
        {t("randomHere")}
      </Link>
      <button type="button" className="btn btn-accent" onClick={() => ask(t("askAi", { name }))}>
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        {t("askAi", { name })}
      </button>
    </div>
  );
}

export function ProvinceProgress({ slug, placeIds }: { slug: string; placeIds: string[] }) {
  const t = useTranslations("province");
  const { state, mode } = useTravelStore();
  if (mode === "loading" || mode === "guest") return null;
  const visited = placeIds.filter((id) => state.visits[id]).length;
  const status = state.provinces[slug]?.status;
  return (
    <div className="card p-5">
      <h2 className="text-lg font-bold">{t("yourProgress")}</h2>
      {status && <p className="mt-1 text-sm font-semibold text-forest-700">{status === "visited" ? t("statusVisited") : t("statusWant")}</p>}
      <p className="mt-1 text-sm muted">{t("visitedPlaces", { visited, total: placeIds.length })}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sage-100">
        <div className="h-full rounded-full bg-forest-500" style={{ width: `${placeIds.length ? (visited / placeIds.length) * 100 : 0}%` }} />
      </div>
    </div>
  );
}
