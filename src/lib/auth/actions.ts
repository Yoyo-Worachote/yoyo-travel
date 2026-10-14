"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { emailForUsername, isUsernameLoginEnabled } from "@/lib/supabase/admin";
import { getCurrentUser, getServerSupabase } from "@/lib/supabase/server";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import {
  emailSchema,
  fieldErrors,
  isEmail,
  loginSchema,
  passwordSchema,
  registerSchema,
  safeNext,
  usernameSchema,
  type FieldErrors,
} from "./rules";

/**
 * Auth server actions. Passwords are handled only by Supabase Auth (hashed by
 * GoTrue); this code never stores or logs them. Error codes are i18n keys
 * under `auth.errors` and are deliberately generic where a specific message
 * would let someone discover which usernames/emails exist.
 */

export type AuthResult =
  | { ok: true; redirectTo?: string; message?: string }
  | { ok: false; error: string; fields?: FieldErrors };

async function siteOrigin(): Promise<string> {
  // Prefer the configured URL (the Host header is client-controlled; Supabase
  // also checks redirect URLs against its allow-list).
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured && /^https?:\/\//.test(configured)) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host)) return `${proto}://${host}`;
  return "http://localhost:3000";
}

async function limited(bucket: string, limit: number): Promise<boolean> {
  const h = await headers();
  return !rateLimit(`${bucket}:${clientKey(h)}`, limit, 60_000).ok;
}

const NOT_CONFIGURED: AuthResult = { ok: false, error: "notConfigured" };

export async function checkUsernameAvailable(raw: string): Promise<{ valid: boolean; available: boolean | null }> {
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) return { valid: false, available: null };
  if (await limited("username-check", 40)) return { valid: true, available: null };
  const sb = await getServerSupabase();
  if (!sb) return { valid: true, available: null };
  const { data, error } = await sb.rpc("username_available", { candidate: parsed.data });
  return { valid: true, available: error ? null : Boolean(data) };
}

export async function registerAction(_prev: AuthResult | null, form: FormData): Promise<AuthResult> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };
  const sb = await getServerSupabase();
  if (!sb) return NOT_CONFIGURED;
  if (await limited("register", 5)) return { ok: false, error: "rateLimited" };
  const v = parsed.data;

  const { data: available } = await sb.rpc("username_available", { candidate: v.username });
  if (available === false) return { ok: false, error: "invalid", fields: { username: "usernameTaken" } };

  const next = safeNext(v.next, "/account");
  const { data, error } = await sb.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { username: v.username, display_name: v.displayName || v.username },
    },
  });
  if (error) {
    const msg = error.message.toLowerCase();
    // The profile trigger rejects a username taken between our check and sign-up.
    if (msg.includes("database error")) return { ok: false, error: "invalid", fields: { username: "usernameTaken" } };
    if (msg.includes("already registered")) return { ok: false, error: "invalid", fields: { email: "emailTaken" } };
    if (msg.includes("password")) return { ok: false, error: "invalid", fields: { password: "passwordWeak" } };
    return { ok: false, error: "signUpFailed" };
  }
  // With email confirmation on, Supabase returns a user with no identities for an existing email.
  if (data.user && data.user.identities?.length === 0) {
    return { ok: false, error: "invalid", fields: { email: "emailTaken" } };
  }
  if (!data.session) return { ok: true, message: "checkEmail" };
  return { ok: true, redirectTo: next };
}

export async function loginAction(_prev: AuthResult | null, form: FormData): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };
  const sb = await getServerSupabase();
  if (!sb) return NOT_CONFIGURED;
  if (await limited("login", 10)) return { ok: false, error: "rateLimited" };
  const { identifier, password } = parsed.data;

  let email: string | null = null;
  if (isEmail(identifier)) {
    const e = emailSchema.safeParse(identifier);
    if (!e.success) return { ok: false, error: "invalidCredentials" };
    email = e.data;
  } else {
    const u = usernameSchema.safeParse(identifier);
    if (!u.success) return { ok: false, error: "invalidCredentials" };
    if (!isUsernameLoginEnabled()) return { ok: false, error: "usernameLoginDisabled" };
    email = await emailForUsername(u.data);
    // Unknown username → same generic error as a wrong password.
    if (!email) return { ok: false, error: "invalidCredentials" };
  }

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) return { ok: false, error: "emailNotConfirmed" };
    return { ok: false, error: "invalidCredentials" };
  }
  return { ok: true, redirectTo: safeNext(parsed.data.next, "/") };
}

export async function forgotPasswordAction(_prev: AuthResult | null, form: FormData): Promise<AuthResult> {
  const identifier = String(form.get("identifier") ?? "").trim();
  if (!identifier) return { ok: false, error: "invalid", fields: { identifier: "identifierRequired" } };
  const sb = await getServerSupabase();
  if (!sb) return NOT_CONFIGURED;
  if (await limited("forgot", 3)) return { ok: false, error: "rateLimited" };
  let email: string | null = null;
  if (isEmail(identifier)) email = emailSchema.safeParse(identifier).data ?? null;
  else if (usernameSchema.safeParse(identifier).success) email = await emailForUsername(identifier);
  if (email) {
    await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent("/account/reset-password")}`,
    });
  }
  // Same answer whether or not the account exists.
  return { ok: true, message: "resetSent" };
}

export async function updatePasswordAction(_prev: AuthResult | null, form: FormData): Promise<AuthResult> {
  const schema = z
    .object({ password: passwordSchema, confirmPassword: z.string() })
    .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "passwordMismatch" });
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };
  const ctx = await getCurrentUser();
  if (!ctx) return { ok: false, error: "sessionExpired" };
  const { error } = await ctx.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: "invalid", fields: { password: "passwordWeak" } };
  return { ok: true, redirectTo: "/account", message: "passwordUpdated" };
}

const ProfileSchema = z.object({
  displayName: z.string().trim().max(60, "displayNameLong"),
  username: z.union([z.literal(""), usernameSchema]),
});

export async function updateProfileAction(_prev: AuthResult | null, form: FormData): Promise<AuthResult> {
  const parsed = ProfileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };
  const ctx = await getCurrentUser();
  if (!ctx) return { ok: false, error: "sessionExpired" };
  const patch: Record<string, string | null> = { display_name: parsed.data.displayName || null };
  if (parsed.data.username) patch.username = parsed.data.username;
  // RLS limits the update to the caller's own row; the id comes from the verified session.
  const { error } = await ctx.supabase.from("profiles").update(patch).eq("id", ctx.user.id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "invalid", fields: { username: "usernameTaken" } };
    return { ok: false, error: "saveFailed" };
  }
  return { ok: true, message: "profileSaved" };
}

export async function deleteAccountAction(_prev: AuthResult | null, form: FormData): Promise<AuthResult> {
  if (form.get("confirm") !== "DELETE") return { ok: false, error: "invalid", fields: { confirm: "confirmDelete" } };
  const ctx = await getCurrentUser();
  if (!ctx) return { ok: false, error: "sessionExpired" };
  const { error } = await ctx.supabase.rpc("delete_my_account");
  if (error) return { ok: false, error: "deleteFailed" };
  await ctx.supabase.auth.signOut();
  return { ok: true, redirectTo: "/?deleted=1" };
}

export async function signOutAction(): Promise<AuthResult> {
  const sb = await getServerSupabase();
  if (sb) await sb.auth.signOut();
  return { ok: true, redirectTo: "/" };
}
