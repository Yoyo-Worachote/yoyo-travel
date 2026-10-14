import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BedDouble, Bus, Coffee, Hotel, Landmark, Mountain, ShoppingBag, Tent, Ticket, UtensilsCrossed } from "lucide-react";
import { ThailandMap } from "@/components/map/ThailandMap";
import { getPlaces, getProvinceSummaries } from "@/lib/catalog";
import { EXPLORE_CATEGORIES, EXPLORE_CATEGORY_IDS, type ExploreCategory } from "@/lib/categories";

const ICONS: Record<ExploreCategory, typeof Landmark> = {
  attractions: Landmark,
  restaurants: UtensilsCrossed,
  cafes: Coffee,
  hotels: Hotel,
  resorts: BedDouble,
  hostels: Tent,
  activities: Ticket,
  nature: Mountain,
  shopping: ShoppingBag,
  transport: Bus,
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("explore");
  return { title: t("title"), description: t("subtitle") };
}

export default async function ExplorePage() {
  const t = await getTranslations();
  const places = getPlaces();
  const counts = Object.fromEntries(
    EXPLORE_CATEGORY_IDS.map((c) => [c, places.filter((p) => (EXPLORE_CATEGORIES[c] as readonly string[]).includes(p.category)).length]),
  );
  return (
    <div className="container-page space-y-10 py-10">
      <div>
        <h1 className="text-3xl font-bold md:text-4xl">{t("explore.title")}</h1>
        <p className="mt-1 muted">{t("explore.subtitle")}</p>
      </div>
      <section aria-labelledby="cats">
        <h2 id="cats" className="section-title mb-4">
          {t("places.browseByCategory")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {EXPLORE_CATEGORY_IDS.map((c) => {
            const Icon = ICONS[c];
            return (
              <li key={c}>
                <Link href={`/places?category=${c}`} className="card flex h-full items-center gap-3 p-4 hover:bg-forest-50">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{t(`places.cat.${c}`)}</span>
                    <span className="text-xs muted">{t("common.places", { count: counts[c] })}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      <section aria-labelledby="map-h">
        <h2 id="map-h" className="section-title mb-4">
          {t("home.mapTitle")}
        </h2>
        <ThailandMap provinces={getProvinceSummaries()} />
      </section>
    </div>
  );
}
