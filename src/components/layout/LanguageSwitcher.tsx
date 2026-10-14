"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/i18n/actions";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("nav");
  const router = useRouter();
  const [pending, start] = useTransition();

  const change = (next: "th" | "en") => {
    if (next === locale) return;
    start(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={`inline-flex rounded-full border border-sage-200 bg-white p-0.5 text-sm font-semibold ${pending ? "opacity-60" : ""} ${className}`}
    >
      {(["th", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => change(l)}
          aria-pressed={locale === l}
          lang={l}
          className={`rounded-full px-3 py-1 transition ${locale === l ? "bg-forest-700 text-white" : "text-charcoal-soft hover:text-forest-800"}`}
        >
          {l === "th" ? "TH" : "EN"}
        </button>
      ))}
    </div>
  );
}
