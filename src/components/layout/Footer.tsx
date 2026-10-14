import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "./Logo";

export async function Footer() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");
  const p = await getTranslations("privacy");
  return (
    <footer className="mt-20 border-t border-forest-900/10 bg-forest-900 text-forest-100">
      <div className="container-page grid gap-8 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <div className="inline-block rounded-2xl bg-cream px-3 py-2">
            <Logo />
          </div>
          <p className="max-w-md text-sm text-forest-200">{t("about")}</p>
          <p className="text-xs text-forest-300">{t("beta")}</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-2 text-sm">
          {(
            [
              ["/explore", "explore"],
              ["/top", "top"],
              ["/random", "random"],
              ["/passport", "passport"],
              ["/wishlist", "wishlist"],
              ["/trips", "trips"],
              ["/chat", "chat"],
              ["/search", "search"],
              ["/admin", "admin"],
            ] as const
          ).map(([href, key]) => (
            <Link key={href} href={href} className="text-forest-100 hover:text-white hover:underline">
              {nav(key)}
            </Link>
          ))}
        </nav>
        <div className="space-y-3 text-xs text-forest-200">
          <p>{t("data")}</p>
          <Link href="/privacy" className="inline-block text-sm text-white underline underline-offset-4">
            {p("footerLink")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
