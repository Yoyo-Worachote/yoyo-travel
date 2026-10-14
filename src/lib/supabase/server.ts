import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/** Request-scoped client acting as the signed-in user (RLS applies). */
export async function getServerSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there; middleware refreshes them.
        }
      },
    },
  });
}

/** Verified user from Supabase Auth (getUser validates the JWT with the auth server). */
export async function getCurrentUser(): Promise<{ supabase: SupabaseClient; user: User } | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

/** Admin check is done server-side against profiles.role (RLS lets users read only their own row). */
export async function getAdminContext(): Promise<
  | { status: "not_configured" }
  | { status: "signed_out" }
  | { status: "forbidden"; user: User }
  | { status: "ok"; user: User; supabase: SupabaseClient }
> {
  if (!isSupabaseConfigured()) return { status: "not_configured" };
  const ctx = await getCurrentUser();
  if (!ctx) return { status: "signed_out" };
  const { data } = await ctx.supabase.from("profiles").select("role").eq("id", ctx.user.id).maybeSingle();
  if (data?.role !== "admin") return { status: "forbidden", user: ctx.user };
  return { status: "ok", user: ctx.user, supabase: ctx.supabase };
}
