import type { PlaceKind } from "./types";

export const INTERESTS = [
  "nature",
  "beach",
  "mountain",
  "culture",
  "cafes",
  "food",
  "shopping",
  "activities",
] as const;
export type Interest = (typeof INTERESTS)[number];

export const COMPANIONS = ["solo", "couple", "family", "friends"] as const;
export type Companion = (typeof COMPANIONS)[number];

/** Which place categories satisfy each interest. */
export const INTEREST_CATEGORIES: Record<Interest, string[]> = {
  nature: ["national_park", "nature", "waterfall", "cave", "park", "island", "beach", "mountain", "viewpoint"],
  beach: ["beach", "island"],
  mountain: ["mountain", "viewpoint"],
  culture: ["temple", "history", "museum"],
  cafes: ["cafe"],
  food: ["restaurant", "market"],
  shopping: ["shopping", "market"],
  activities: ["activity", "park"],
};

/**
 * Heuristic fit between companion type and place categories. This is a
 * suggestion rule, not data about the place — the UI labels it as such.
 */
export const COMPANION_CATEGORIES: Record<Companion, string[]> = {
  family: ["park", "activity", "museum", "beach", "national_park", "waterfall"],
  couple: ["beach", "island", "viewpoint", "cafe", "mountain", "history"],
  solo: ["temple", "museum", "history", "cafe", "market", "mountain"],
  friends: ["activity", "beach", "island", "market", "restaurant", "waterfall"],
};

/** Filter groups on the province page / trip planner. */
export const CATEGORY_GROUPS = {
  nature: ["national_park", "nature", "waterfall", "cave", "mountain", "viewpoint", "park"],
  beach: ["beach", "island"],
  culture: ["temple", "history", "museum", "attraction"],
  shopping: ["market", "shopping"],
  food: ["restaurant", "cafe"],
  stay: ["hotel", "resort", "hostel", "guest_house", "motel", "apartment"],
  activities: ["activity"],
  transport: ["transport"],
} as const;
export type CategoryGroup = keyof typeof CATEGORY_GROUPS;
export const CATEGORY_GROUP_IDS = Object.keys(CATEGORY_GROUPS) as CategoryGroup[];

export function groupOfCategory(category: string): CategoryGroup | null {
  for (const g of CATEGORY_GROUP_IDS) {
    if ((CATEGORY_GROUPS[g] as readonly string[]).includes(category)) return g;
  }
  return null;
}

export function interestsOfCategory(category: string): Interest[] {
  return INTERESTS.filter((i) => INTEREST_CATEGORIES[i].includes(category));
}

export const KIND_ORDER: PlaceKind[] = ["attraction", "activity", "restaurant", "cafe", "accommodation", "transport"];

/** The 10 discovery categories on /places (each maps to concrete place categories). */
export const EXPLORE_CATEGORIES = {
  attractions: ["attraction", "temple", "history", "museum", "viewpoint", "park"],
  restaurants: ["restaurant"],
  cafes: ["cafe"],
  hotels: ["hotel", "motel", "apartment"],
  resorts: ["resort"],
  hostels: ["hostel", "guest_house"],
  activities: ["activity"],
  nature: ["national_park", "nature", "waterfall", "beach", "island", "mountain", "cave"],
  shopping: ["market", "shopping"],
  transport: ["transport"],
} as const;
export type ExploreCategory = keyof typeof EXPLORE_CATEGORIES;
export const EXPLORE_CATEGORY_IDS = Object.keys(EXPLORE_CATEGORIES) as ExploreCategory[];

/** Facilities that can be filtered (only when the source tags them). */
export const AMENITIES = [
  "wifi",
  "wheelchair",
  "air_conditioning",
  "parking",
  "pool",
  "outdoor_seating",
  "vegetarian",
  "vegan",
  "halal",
  "takeaway",
  "delivery",
  "reservation",
] as const;
export type Amenity = (typeof AMENITIES)[number];
