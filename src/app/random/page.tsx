import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { RandomClient } from "@/components/random/RandomClient";
import { getProvinces } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("random");
  return { title: t("title"), description: t("subtitle") };
}

export default async function RandomPage() {
  const t = await getTranslations("random");
  const provinces = getProvinces().map((p) => ({ slug: p.slug, nameTh: p.nameTh, nameEn: p.nameEn }));
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
      <p className="mb-8 mt-1 muted">{t("subtitle")}</p>
      <Suspense fallback={<div className="h-96 rounded-[var(--radius-card)] skeleton" />}>
        <RandomClient provinces={provinces} />
      </Suspense>
    </div>
  );
}
