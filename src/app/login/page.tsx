import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Logo } from "@/components/layout/Logo";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signIn"), robots: { index: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const t = await getTranslations("auth");
  const configured = isSupabaseConfigured();
  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-12">
      <div className="card w-full max-w-md space-y-5 p-8">
        <Logo />
        <h1 className="text-2xl font-bold">{t("loginTitle")}</h1>
        {error && (
          <p role="alert" className="rounded-xl bg-clay-soft px-4 py-2 text-sm">
            {t("authError")}
          </p>
        )}
        {configured ? (
          <>
            <p className="muted">{t("loginBody")}</p>
            <GoogleSignInButton next={next ?? null} />
            <p className="flex items-start gap-2 text-xs muted">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> {t("privacyNote")}
            </p>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-gold-soft p-4 text-sm text-[#5f4612]">
              <p className="font-semibold">{t("notConfiguredTitle")}</p>
              <p className="mt-1">{t("notConfiguredBody")}</p>
            </div>
            <Link href="/passport" className="btn btn-primary w-full">
              {t("continueDemo")}
            </Link>
            <Link href="/privacy#setup" className="block text-center text-sm underline">
              {t("demoBannerLink")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
