import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PassportClient } from "@/components/passport/PassportClient";
import { getProvinceSummaries } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("passport");
  return { title: t("title"), robots: { index: false } };
}

export default async function PassportPage() {
  const t = await getTranslations("passport");
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
      <p className="mb-8 mt-1 muted">{t("subtitle")}</p>
      <PassportClient provinces={getProvinceSummaries()} />
    </div>
  );
}
