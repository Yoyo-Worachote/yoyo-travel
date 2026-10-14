import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * Service-role client — SERVER ONLY. Used for exactly one thing: resolving a
 * username to its sign-in email (RPC granted only to service_role), so the
 * browser can never enumerate emails. Optional: without the key, users sign
 * in with their email instead of their username.
 */
let admin: SupabaseClient | null = null;

export function isUsernameLoginEnabled(): boolean {
  return Boolean(SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getAdmin(): SupabaseClient | null {
  if (!isUsernameLoginEnabled()) return null;
  admin ??= createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

export async function emailForUsername(username: string): Promise<string | null> {
  const sb = getAdmin();
  if (!sb) return null;
  const { data, error } = await sb.rpc("auth_email_for_username", { candidate: username.toLowerCase() });
  if (error) return null;
  return typeof data === "string" && data ? data : null;
}
