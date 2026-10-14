import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/AuthForms";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("resetTitle"), robots: { index: false } };
}

/** Reached from the password-reset email (the callback exchanged the code for a recovery session). */
export default async function ResetPasswordPage() {
  const t = await getTranslations("auth");
  if (!(await getCurrentUser())) redirect("/forgot-password");
  return (
    <AuthShell title={t("resetTitle")} next="/account">
      <ResetPasswordForm />
    </AuthShell>
  );
}
