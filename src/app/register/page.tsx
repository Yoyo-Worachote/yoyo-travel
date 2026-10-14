import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthNotConfigured, AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/AuthForms";
import { safeNext } from "@/lib/auth/rules";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("register"), robots: { index: false } };
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/");
  const t = await getTranslations("auth");
  const configured = isSupabaseConfigured();
  if (configured && (await getCurrentUser())) redirect(next);
  return (
    <AuthShell
      title={t("registerTitle")}
      subtitle={t("registerBody")}
      next={next}
      google={configured}
      footer={
        configured && (
          <>
            {t("haveAccount")}{" "}
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-forest-700 hover:underline">
              {t("signIn")}
            </Link>
          </>
        )
      }
    >
      {configured ? <RegisterForm next={next} /> : <AuthNotConfigured next={next} />}
    </AuthShell>
  );
}
