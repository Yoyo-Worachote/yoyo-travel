import type { ImageInfo } from "./types";

type Named = { nameTh: string | null; nameEn: string | null };

/** Prefer the locale's name; fall back to the other original name (never invent a translation). */
export function localName(item: Named, locale: string): string {
  return (locale === "en" ? item.nameEn || item.nameTh : item.nameTh || item.nameEn) ?? "—";
}

/** Secondary name in the other language when it exists and differs. */
export function altName(item: Named, locale: string): string | null {
  const alt = locale === "en" ? item.nameTh : item.nameEn;
  return alt && alt !== localName(item, locale) ? alt : null;
}

export function localText(th: string | null | undefined, en: string | null | undefined, locale: string): string | null {
  return (locale === "en" ? en || th : th || en) ?? null;
}

export function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00+07:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(d);
}

export function formatNumber(n: number, locale: string, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "th-TH", opts).format(n);
}

export function formatBaht(n: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);
}

export function imageAlt(name: string, image: ImageInfo | null): string {
  return image ? name : "";
}
