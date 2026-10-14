import type { CostCategory, Trip } from "./travel-state";

/**
 * Trip budget. Rules:
 * - A cost without a source is never treated as 0 — such items are listed as
 *   "unpriced" and totals are flagged incomplete.
 * - Actual (paid) and estimated amounts are kept separate.
 * - Provider prices (e.g. an OSM `charge` tag) are shown with their source and
 *   multiplied by travellers only when they are per-person admission prices.
 * Currency: the trip currency (THB by default); no conversion is done.
 */

export interface ProviderPrice {
  min: number;
  max: number;
  currency: string;
  perPerson: boolean;
  provenance: "provider_data" | "official_published" | "confirmed_provider";
  source: string;
  sourceUrl: string | null;
  observedAt: string | null;
}

export type CostSource = "actual" | "user_estimate" | "provider" | "none";

export interface ItemCost {
  itemId: string;
  placeId: string;
  category: CostCategory;
  source: CostSource;
  min: number;
  max: number;
  provider?: ProviderPrice;
}

export interface CategoryTotals {
  estimatedMin: number;
  estimatedMax: number;
  actual: number;
  unpriced: number;
}

export interface BudgetSummary {
  currency: string;
  travelers: number;
  budget: number | null;
  items: ItemCost[];
  byCategory: Record<CostCategory, CategoryTotals>;
  /** planned cost range (estimates + provider prices + actuals for items already paid) */
  plannedMin: number;
  plannedMax: number;
  actualTotal: number;
  perPersonMin: number;
  perPersonMax: number;
  /** budget − plannedMax (conservative) */
  remaining: number | null;
  unpricedCount: number;
  complete: boolean;
}

const CATS: CostCategory[] = ["accommodation", "food", "activity", "transport", "other"];

export function defaultCostCategory(placeCategory: string): CostCategory {
  if (["restaurant", "cafe", "market"].includes(placeCategory)) return "food";
  if (["hotel", "resort", "hostel", "guest_house", "motel", "apartment"].includes(placeCategory)) return "accommodation";
  if (placeCategory === "transport") return "transport";
  return "activity";
}

export function computeBudget(trip: Trip, priceOf: (placeId: string) => ProviderPrice | null = () => null): BudgetSummary {
  const travelers = Math.max(1, trip.travelerCount || 1);
  const byCategory = Object.fromEntries(
    CATS.map((c) => [c, { estimatedMin: 0, estimatedMax: 0, actual: 0, unpriced: 0 }]),
  ) as Record<CostCategory, CategoryTotals>;

  const items: ItemCost[] = trip.items.map((i) => {
    const category = i.costCategory ?? defaultCostCategory(i.category);
    if (i.actualCost != null) return { itemId: i.id, placeId: i.placeId, category, source: "actual", min: i.actualCost, max: i.actualCost };
    if (i.estimatedCost != null)
      return { itemId: i.id, placeId: i.placeId, category, source: "user_estimate", min: i.estimatedCost, max: i.estimatedCost };
    const p = priceOf(i.placeId);
    if (p && p.currency === trip.currency) {
      const mult = p.perPerson ? travelers : 1;
      return { itemId: i.id, placeId: i.placeId, category, source: "provider", min: p.min * mult, max: p.max * mult, provider: p };
    }
    return { itemId: i.id, placeId: i.placeId, category, source: "none", min: 0, max: 0 };
  });

  let plannedMin = 0;
  let plannedMax = 0;
  let actualTotal = 0;
  for (const it of items) {
    const c = byCategory[it.category];
    if (it.source === "none") {
      c.unpriced++;
      continue;
    }
    if (it.source === "actual") {
      c.actual += it.min;
      actualTotal += it.min;
    } else {
      c.estimatedMin += it.min;
      c.estimatedMax += it.max;
    }
    plannedMin += it.min;
    plannedMax += it.max;
  }
  for (const e of trip.expenses) {
    const c = byCategory[e.category];
    if (e.costType === "actual") {
      c.actual += e.amount;
      actualTotal += e.amount;
    } else {
      c.estimatedMin += e.amount;
      c.estimatedMax += e.amount;
    }
    plannedMin += e.amount;
    plannedMax += e.amount;
  }
  const unpricedCount = items.filter((i) => i.source === "none").length;
  return {
    currency: trip.currency,
    travelers,
    budget: trip.budget,
    items,
    byCategory,
    plannedMin,
    plannedMax,
    actualTotal,
    perPersonMin: plannedMin / travelers,
    perPersonMax: plannedMax / travelers,
    remaining: trip.budget != null ? trip.budget - plannedMax : null,
    unpricedCount,
    complete: unpricedCount === 0,
  };
}
