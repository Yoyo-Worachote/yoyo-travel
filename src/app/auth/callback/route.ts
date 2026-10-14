import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/** OAuth PKCE callback: exchange the code for a session cookie, then redirect. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/passport";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/passport";
  const supabase = await getServerSupabase();
  if (!supabase || !code) return NextResponse.redirect(new URL("/login?error=1", url.origin));
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=1", url.origin));
  return NextResponse.redirect(new URL(next, url.origin));
}
