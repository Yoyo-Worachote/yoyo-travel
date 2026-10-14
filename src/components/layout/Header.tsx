"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Menu, X, Search, LogIn, LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";

const NAV = [
  { href: "/explore", key: "explore" },
  { href: "/top", key: "top" },
  { href: "/random", key: "random" },
  { href: "/passport", key: "passport" },
  { href: "/wishlist", key: "wishlist" },
  { href: "/trips", key: "trips" },
  { href: "/chat", key: "chat" },
] as const;

function AuthControl({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("auth");
  const { mode, user, signOut } = useTravelStore();
  if (mode === "loading") return <span className="inline-block h-9 w-24 rounded-full skeleton" aria-hidden="true" />;
  if (mode === "demo") {
    return (
      <Link href="/login" className="badge bg-gold-soft text-[#7a5a17]" title={t("demoBanner")}>
        {t("demoMode")}
      </Link>
    );
  }
  if (mode === "cloud" && user) {
    const name = (user.user_metadata?.full_name as string) || user.email || "";
    const avatar = user.user_metadata?.avatar_url as string | undefined;
    return (
      <div className="flex items-center gap-2">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" width={32} height={32} className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-forest-100 text-sm font-bold text-forest-800">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        {!compact && <span className="sr-only">{t("signedInAs", { name })}</span>}
        <button type="button" onClick={signOut} className="btn btn-ghost btn-sm" aria-label={t("signOut")}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className={compact ? "" : "hidden xl:inline"}>{t("signOut")}</span>
        </button>
      </div>
    );
  }
  return (
    <Link href="/login" className="btn btn-primary btn-sm">
      <LogIn className="h-4 w-4" aria-hidden="true" />
      {t("signIn")}
    </Link>
  );
}

export function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-forest-900/5 bg-cream/90 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" aria-label="Yoyo Travel — home" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="ml-2 hidden min-[1360px]:flex items-center gap-0.5">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-[0.92rem] font-medium transition ${
                isActive(n.href) ? "bg-forest-100 text-forest-900" : "text-charcoal-soft hover:text-forest-800 hover:bg-forest-50"
              }`}
            >
              {t(n.key)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link href="/search" className="btn btn-ghost btn-sm" aria-label={t("search")}>
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>
          <LanguageSwitcher />
          <div className="hidden min-[1360px]:block">
            <AuthControl />
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm min-[1360px]:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t("closeMenu") : t("menu")}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </div>
      {open && (
        <div id="mobile-menu" className="min-[1360px]:hidden border-t border-forest-900/5 bg-cream">
          <nav aria-label="Mobile" className="container-page flex flex-col py-3">
            <Link href="/" className="rounded-xl px-3 py-3 font-medium hover:bg-forest-50" aria-current={pathname === "/" ? "page" : undefined}>
              {t("home")}
            </Link>
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={`rounded-xl px-3 py-3 font-medium ${isActive(n.href) ? "bg-forest-100 text-forest-900" : "hover:bg-forest-50"}`}
              >
                {t(n.key)}
              </Link>
            ))}
            <div className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-forest-900/5 px-3 pt-4">
              <AuthControl compact />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
