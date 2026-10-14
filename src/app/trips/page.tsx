import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { TripsClient } from "@/components/trips/TripsClient";
import { getProvinces } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("trips");
  return { title: t("title"), robots: { index: false } };
}

export default async function TripsPage() {
  const t = await getTranslations("trips");
  const provinces = getProvinces().map((p) => ({ slug: p.slug, nameTh: p.nameTh, nameEn: p.nameEn }));
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
      <p className="mb-8 mt-1 muted">{t("subtitle")}</p>
      <Suspense fallback={<div className="h-64 rounded-[var(--radius-card)] skeleton" />}>
        <TripsClient provinces={provinces} />
      </Suspense>
    </div>
  );
}
