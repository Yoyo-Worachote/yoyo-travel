import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ThailandMap } from "@/components/map/ThailandMap";
import { getProvinceSummaries } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("explore");
  return { title: t("title"), description: t("subtitle") };
}

export default async function ExplorePage() {
  const t = await getTranslations("explore");
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
      <p className="mb-6 mt-1 muted">{t("subtitle")}</p>
      <ThailandMap provinces={getProvinceSummaries()} />
    </div>
  );
}
