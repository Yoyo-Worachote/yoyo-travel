import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE } from "./config";
import th from "../../messages/th.json";
import en from "../../messages/en.json";

type Messages = Record<string, unknown>;

/** Deep-merge so any key missing from a locale falls back to Thai. */
export function withFallback(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const b = base[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && b && typeof b === "object"
        ? withFallback(b as Messages, v as Messages)
        : v;
  }
  return out;
}

const MESSAGES = { th, en: withFallback(th, en) };

export default getRequestConfig(async () => {
  // Locale is chosen explicitly by the user (cookie). First-time visitors get Thai.
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  return {
    locale,
    messages: MESSAGES[locale],
    timeZone: "Asia/Bangkok",
  };
});
