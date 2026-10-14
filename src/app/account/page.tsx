import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AccountClient } from "@/components/auth/AccountClient";
import { AuthNotConfigured, AuthShell } from "@/components/auth/AuthShell";
import { formatDate } from "@/lib/display";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("account"), robots: { index: false } };
}

export default async function AccountPage() {
  const t = await getTranslations("auth");
  const locale = await getLocale();
  if (!isSupabaseConfigured()) {
    return (
      <AuthShell title={t("account")} next="/">
        <AuthNotConfigured next="/" />
      </AuthShell>
    );
  }
  const ctx = await getCurrentUser();
  if (!ctx) redirect("/login?next=/account");
  // RLS returns only the caller's own profile row.
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("username, display_name, avatar_url, created_at")
    .eq("id", ctx.user.id)
    .maybeSingle();
  const providers = (ctx.user.identities ?? []).map((i) => i.provider);
  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="mb-6 text-3xl font-bold">{t("account")}</h1>
      <AccountClient
        profile={{
          username: profile?.username ?? null,
          displayName: profile?.display_name ?? null,
          avatarUrl: profile?.avatar_url ?? null,
          email: ctx.user.email ?? null,
          emailConfirmed: Boolean(ctx.user.email_confirmed_at),
          providers,
          memberSince: formatDate(profile?.created_at ?? ctx.user.created_at, locale),
        }}
      />
    </div>
  );
}
