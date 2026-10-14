import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { GoogleSignInButton } from "./GoogleSignInButton";

/** Shared frame for login/register/forgot pages. Guests can always go back to what they were doing. */
export async function AuthShell({
  title,
  subtitle,
  next,
  google = false,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  next: string;
  google?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const t = await getTranslations("auth");
  return (
    <div className="container-page grid min-h-[75vh] place-items-center py-10">
      <div className="w-full max-w-md">
        <Link href={next} className="mb-4 inline-flex items-center gap-1 text-sm text-forest-700 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("continueAsGuest")}
        </Link>
        <div className="card space-y-6 p-6 sm:p-8">
          <Logo />
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="mt-1 text-sm muted">{subtitle}</p>}
          </div>
          {google && (
            <>
              <GoogleSignInButton next={next} />
              <div className="flex items-center gap-3 text-xs uppercase tracking-wider muted" aria-hidden="true">
                <span className="h-px flex-1 bg-sage-200" />
                {t("or")}
                <span className="h-px flex-1 bg-sage-200" />
              </div>
            </>
          )}
          {children}
          {footer && <div className="border-t border-sage-100 pt-4 text-center text-sm">{footer}</div>}
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs muted">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> {t("privacyNote")}
        </p>
      </div>
    </div>
  );
}

export async function AuthNotConfigured({ next }: { next: string }) {
  const t = await getTranslations("auth");
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gold-soft p-4 text-sm text-[#5f4612]">
        <p className="font-semibold">{t("notConfiguredTitle")}</p>
        <p className="mt-1">{t("notConfiguredBody")}</p>
      </div>
      <Link href={next} className="btn btn-primary w-full">
        {t("continueAsGuest")}
      </Link>
      <Link href="/privacy#setup" className="block text-center text-sm underline">
        {t("demoBannerLink")}
      </Link>
    </div>
  );
}
