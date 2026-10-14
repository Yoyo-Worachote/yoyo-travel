import type { RegionId } from "./types";

/**
 * General climate guidance for Thailand (Thai Meteorological Department's
 * description of the three seasons and the two southern coasts). This is
 * coarse, region-level guidance — never a forecast or a per-place claim.
 */
export type Season = "cool" | "hot" | "rainy";

export const TMD_CLIMATE_URL = "https://www.tmd.go.th/";

export const ANDAMAN_PROVINCES = ["ranong", "phang-nga", "phuket", "krabi", "trang", "satun"];
export const LOWER_GULF_PROVINCES = [
  "chumphon",
  "surat-thani",
  "nakhon-si-thammarat",
  "phatthalung",
  "songkhla",
  "pattani",
  "yala",
  "narathiwat",
];

/** month: 1–12 */
export function seasonOfMonth(month: number): Season {
  if (month >= 11 || month <= 2) return "cool";
  if (month <= 4) return "hot";
  return "rainy";
}

export function bangkokMonth(date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: "Asia/Bangkok" }).format(date));
}

/** Which guidance key applies to a province (messages: seasons.*). */
export function provinceSeasonKey(slug: string, region: RegionId): "andaman" | "gulf" | "northNe" | "general" {
  if (ANDAMAN_PROVINCES.includes(slug)) return "andaman";
  if (LOWER_GULF_PROVINCES.includes(slug)) return "gulf";
  if (region === "north" || region === "northeast") return "northNe";
  return "general";
}

/** Coarse "good now" check for seasonal picks. */
export function isGoodMonthFor(slug: string, region: RegionId, category: string, month: number): boolean {
  const season = seasonOfMonth(month);
  const coastal = ["beach", "island"].includes(category);
  if (coastal) {
    if (ANDAMAN_PROVINCES.includes(slug)) return month >= 11 || month <= 4;
    if (LOWER_GULF_PROVINCES.includes(slug)) return month >= 1 && month <= 9;
    return season !== "rainy" || month <= 6;
  }
  if (["mountain", "viewpoint"].includes(category)) return season === "cool" && (region === "north" || region === "northeast");
  if (["waterfall"].includes(category)) return season === "rainy" || month === 11;
  if (["national_park"].includes(category)) return season === "cool";
  return false;
}

export function seasonTipKey(season: Season): "tipCool" | "tipHot" | "tipRainy" {
  return season === "cool" ? "tipCool" : season === "hot" ? "tipHot" : "tipRainy";
}
