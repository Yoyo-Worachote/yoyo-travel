import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WishlistClient } from "@/components/passport/WishlistClient";
import { getProvinces } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("wishlist");
  return { title: t("title"), robots: { index: false } };
}

export default async function WishlistPage() {
  const t = await getTranslations("wishlist");
  const provinces = getProvinces().map((p) => ({ slug: p.slug, nameTh: p.nameTh, nameEn: p.nameEn }));
  return (
    <div className="container-page max-w-4xl py-10">
      <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
      <p className="mb-8 mt-1 muted">{t("subtitle")}</p>
      <WishlistClient provinces={provinces} />
    </div>
  );
}
