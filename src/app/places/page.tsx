import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PlacesExplorer } from "@/components/search/PlacesExplorer";
import { getProvinces } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("places");
  return { title: t("title"), description: t("subtitle") };
}

export default async function PlacesPage() {
  const t = await getTranslations("places");
  const provinces = getProvinces().map((p) => ({ slug: p.slug, nameTh: p.nameTh, nameEn: p.nameEn }));
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
      <p className="mb-6 mt-1 muted">{t("subtitle")}</p>
      <Suspense fallback={<div className="h-14 rounded-full skeleton" />}>
        <PlacesExplorer provinces={provinces} />
      </Suspense>
    </div>
  );
}
