import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthNotConfigured, AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/AuthForms";
import { safeNext } from "@/lib/auth/rules";
import { isUsernameLoginEnabled } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signIn"), robots: { index: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/");
  const t = await getTranslations("auth");
  const configured = isSupabaseConfigured();
  if (configured && (await getCurrentUser())) redirect(next);
  return (
    <AuthShell
      title={t("loginTitle")}
      subtitle={t("loginBody")}
      next={next}
      google={configured}
      footer={
        configured && (
          <>
            {t("noAccount")}{" "}
            <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-semibold text-forest-700 hover:underline">
              {t("register")}
            </Link>
          </>
        )
      }
    >
      {sp.error && (
        <p role="alert" className="rounded-xl bg-clay-soft px-4 py-2 text-sm">
          {t("authError")}
        </p>
      )}
      {configured ? <LoginForm next={next} usernameLogin={isUsernameLoginEnabled()} /> : <AuthNotConfigured next={next} />}
    </AuthShell>
  );
}
