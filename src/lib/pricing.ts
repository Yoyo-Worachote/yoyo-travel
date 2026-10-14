import type { ProviderPrice } from "./budget";
import type { Place } from "./types";

/**
 * Price model shown to users. Only sourced data becomes a price:
 * - exact: a single sourced amount (or a sourced "free")
 * - range: a sourced min–max
 * - estimated: never produced from place data — only user-entered estimates
 *   in a trip budget are "estimated" (see budget.ts)
 * - unavailable: no reliable data ("ไม่มีข้อมูลราคา")
 */
export type PriceType = "exact" | "range" | "estimated" | "unavailable";
export type PriceUnit = "admission" | "per_person" | "per_night" | "per_activity" | "unknown";

export interface PriceInfo {
  type: PriceType;
  min: number | null;
  max: number | null;
  currency: string;
  unit: PriceUnit;
  free: boolean;
  /** human-readable source label and link */
  source: string | null;
  sourceUrl: string | null;
  observedAt: string | null;
  /** verbatim source text when it could not be parsed (e.g. "free for Thai") */
  raw: string | null;
  /** paid but the amount is unknown */
  paidUnknownAmount: boolean;
}

function unitFor(place: Place): PriceUnit {
  if (place.kind === "attraction") return "admission";
  if (place.kind === "activity") return "per_activity";
  if (place.kind === "accommodation") return "per_night";
  if (place.kind === "restaurant" || place.kind === "cafe") return "per_person";
  return "unknown";
}

export function priceInfo(place: Place): PriceInfo {
  const base: PriceInfo = {
    type: "unavailable",
    min: null,
    max: null,
    currency: "THB",
    unit: unitFor(place),
    free: false,
    source: null,
    sourceUrl: null,
    observedAt: null,
    raw: null,
    paidUnknownAmount: false,
  };
  const osm = place.source.provider === "osm";
  const src = osm ? { source: "OpenStreetMap", sourceUrl: place.source.url, observedAt: place.source.fetchedAt } : {};
  if (place.charge?.min != null && place.charge.max != null) {
    return {
      ...base,
      ...src,
      type: place.charge.min === place.charge.max ? "exact" : "range",
      min: place.charge.min,
      max: place.charge.max,
      currency: place.charge.currency ?? "THB",
      raw: place.charge.raw,
    };
  }
  if (place.fee === "free") return { ...base, ...src, type: "exact", min: 0, max: 0, free: true };
  if (place.charge?.raw) return { ...base, ...src, raw: place.charge.raw, paidUnknownAmount: place.fee === "paid" };
  if (place.fee === "paid") return { ...base, ...src, paidUnknownAmount: true };
  return base;
}

/** Provider price usable by the trip budget (only real sourced amounts). */
export function providerPriceFor(place: Place): ProviderPrice | null {
  const p = priceInfo(place);
  if (p.type !== "exact" && p.type !== "range") return null;
  if (p.min == null || p.max == null) return null;
  return {
    min: p.min,
    max: p.max,
    currency: p.currency,
    perPerson: p.unit === "admission" || p.unit === "per_person",
    provenance: "provider_data",
    source: p.source ?? "provider",
    sourceUrl: p.sourceUrl,
    observedAt: p.observedAt,
  };
}
