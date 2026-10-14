"use client";

import { useTranslations } from "next-intl";
import { Check, Heart } from "lucide-react";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";

export function PlaceStatusBadge({ placeId }: { placeId: string }) {
  const { state } = useTravelStore();
  const t = useTranslations("place");
  if (state.visits[placeId]) {
    return (
      <span className="absolute right-3 top-3 badge bg-forest-700 text-white">
        <Check className="h-3 w-3" aria-hidden="true" />
        {t("visited")}
      </span>
    );
  }
  if (state.wishlist[placeId]) {
    return (
      <span className="absolute right-3 top-3 badge bg-gold-soft text-[#6b4f12]">
        <Heart className="h-3 w-3" aria-hidden="true" />
        {t("inWishlist")}
      </span>
    );
  }
  return null;
}
