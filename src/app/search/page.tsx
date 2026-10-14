import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { SearchClient } from "@/components/search/SearchClient";
import { getProvinces } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("search");
  return { title: t("title") };
}

export default async function SearchPage() {
  const t = await getTranslations("search");
  const provinces = getProvinces().map((p) => ({ slug: p.slug, nameTh: p.nameTh, nameEn: p.nameEn }));
  return (
    <div className="container-page py-10">
      <h1 className="mb-6 text-3xl font-bold">{t("title")}</h1>
      <Suspense fallback={<div className="h-14 rounded-full skeleton" />}>
        <SearchClient provinces={provinces} />
      </Suspense>
    </div>
  );
}
