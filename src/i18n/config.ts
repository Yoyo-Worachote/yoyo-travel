export const locales = ["th", "en"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "th";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(v: unknown): v is AppLocale {
  return typeof v === "string" && (locales as readonly string[]).includes(v);
}
