import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthNotConfigured, AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";
import { safeNext } from "@/lib/auth/rules";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("forgotPassword"), robots: { index: false } };
}

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/");
  const t = await getTranslations("auth");
  const configured = isSupabaseConfigured();
  return (
    <AuthShell
      title={t("forgotTitle")}
      subtitle={t("forgotBody")}
      next={next}
      footer={
        <Link href="/login" className="font-semibold text-forest-700 hover:underline">
          {t("backToLogin")}
        </Link>
      }
    >
      {configured ? <ForgotPasswordForm /> : <AuthNotConfigured next={next} />}
    </AuthShell>
  );
}
