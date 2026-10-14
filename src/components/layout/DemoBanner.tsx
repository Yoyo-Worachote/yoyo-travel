"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";

export function DemoBanner({ supabaseConfigured }: { supabaseConfigured: boolean }) {
  const t = useTranslations("auth");
  const { mode } = useTravelStore();
  if (supabaseConfigured || mode !== "demo") return null;
  return (
    <div role="status" className="border-b border-gold/30 bg-gold-soft text-[#5f4612]">
      <div className="container-page flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
        <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t("demoBanner")}</span>
        <Link href="/privacy#setup" className="font-semibold underline underline-offset-2">
          {t("demoBannerLink")}
        </Link>
      </div>
    </div>
  );
}
