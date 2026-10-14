/**
 * Auth rules + server actions with Supabase mocked (no live Supabase here).
 * Verifies validation, generic errors (no account enumeration), username
 * lookup only through the server-side helper, and redirect safety.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginSchema, registerSchema, safeNext, usernameSchema } from "@/lib/auth/rules";

const signUp = vi.fn();
const signInWithPassword = vi.fn();
const resetPasswordForEmail = vi.fn();
const rpc = vi.fn();
const emailForUsername = vi.fn();
let usernameLogin = true;

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:3000", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` }),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
vi.mock("@/lib/supabase/server", () => ({
  getServerSupabase: async () => ({ auth: { signUp, signInWithPassword, resetPasswordForEmail }, rpc }),
  getCurrentUser: async () => null,
}));
vi.mock("@/lib/supabase/admin", () => ({
  isUsernameLoginEnabled: () => usernameLogin,
  emailForUsername: (u: string) => emailForUsername(u),
}));

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("rules", () => {
  it("usernames: 3–20 lowercase letters, digits, underscore", () => {
    expect(usernameSchema.parse("Yoyo_01")).toBe("yoyo_01");
    for (const bad of ["ab", "a".repeat(21), "has space", "ไทย", "dash-name"]) expect(usernameSchema.safeParse(bad).success).toBe(false);
  });

  it("register: password rules, confirmation and not equal to username", () => {
    const ok = { username: "yoyo", email: "a@b.co", password: "travel123", confirmPassword: "travel123" };
    expect(registerSchema.safeParse(ok).success).toBe(true);
    expect(registerSchema.safeParse({ ...ok, password: "short1", confirmPassword: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, password: "nodigitsss", confirmPassword: "nodigitsss" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, confirmPassword: "different1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, username: "travel123" }).success).toBe(false);
    expect(loginSchema.safeParse({ identifier: "", password: "x" }).success).toBe(false);
  });

  it("only allows same-site relative redirects", () => {
    expect(safeNext("/trips?trip=1")).toBe("/trips?trip=1");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil", "", null, undefined]) expect(safeNext(bad as string, "/")).toBe("/");
  });
});

describe("server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usernameLogin = true;
  });

  it("register rejects a taken username before calling sign-up", async () => {
    const { registerAction } = await import("@/lib/auth/actions");
    rpc.mockResolvedValue({ data: false, error: null });
    const r = await registerAction(null, form({ username: "taken_name", email: "a@b.co", password: "travel123", confirmPassword: "travel123" }));
    expect(r).toMatchObject({ ok: false, fields: { username: "usernameTaken" } });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("register passes username via metadata and asks to confirm email when no session", async () => {
    const { registerAction } = await import("@/lib/auth/actions");
    rpc.mockResolvedValue({ data: true, error: null });
    signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null });
    const r = await registerAction(null, form({ username: "New_User", email: "A@B.co", password: "travel123", confirmPassword: "travel123", next: "/trips" }));
    expect(r).toEqual({ ok: true, message: "checkEmail" });
    const arg = signUp.mock.calls[0][0];
    expect(arg.email).toBe("a@b.co");
    expect(arg.options.data.username).toBe("new_user");
    expect(arg.options.emailRedirectTo).toContain("/auth/callback?next=%2Ftrips");
  });

  it("register maps the DB unique violation (race) to usernameTaken", async () => {
    const { registerAction } = await import("@/lib/auth/actions");
    rpc.mockResolvedValue({ data: true, error: null });
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { message: "Database error saving new user" } });
    const r = await registerAction(null, form({ username: "race_user", email: "c@d.co", password: "travel123", confirmPassword: "travel123" }));
    expect(r).toMatchObject({ ok: false, fields: { username: "usernameTaken" } });
  });

  it("register detects an already registered email", async () => {
    const { registerAction } = await import("@/lib/auth/actions");
    rpc.mockResolvedValue({ data: true, error: null });
    signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });
    const r = await registerAction(null, form({ username: "dup_mail", email: "c@d.co", password: "travel123", confirmPassword: "travel123" }));
    expect(r).toMatchObject({ ok: false, fields: { email: "emailTaken" } });
  });

  it("login by username resolves the email server-side and signs in", async () => {
    const { loginAction } = await import("@/lib/auth/actions");
    emailForUsername.mockResolvedValue("user@example.com");
    signInWithPassword.mockResolvedValue({ error: null });
    const r = await loginAction(null, form({ identifier: "Yoyo", password: "travel123", next: "/trips" }));
    expect(emailForUsername).toHaveBeenCalledWith("yoyo");
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "user@example.com", password: "travel123" });
    expect(r).toEqual({ ok: true, redirectTo: "/trips" });
  });

  it("unknown username and wrong password give the same generic error", async () => {
    const { loginAction } = await import("@/lib/auth/actions");
    emailForUsername.mockResolvedValue(null);
    const unknown = await loginAction(null, form({ identifier: "nobody", password: "travel123" }));
    emailForUsername.mockResolvedValue("user@example.com");
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const wrong = await loginAction(null, form({ identifier: "somebody", password: "wrongpass1" }));
    expect(unknown).toEqual({ ok: false, error: "invalidCredentials" });
    expect(wrong).toEqual({ ok: false, error: "invalidCredentials" });
  });

  it("username login is disabled without the server-side key (email still works)", async () => {
    const { loginAction } = await import("@/lib/auth/actions");
    usernameLogin = false;
    expect(await loginAction(null, form({ identifier: "yoyo", password: "travel123" }))).toEqual({ ok: false, error: "usernameLoginDisabled" });
    signInWithPassword.mockResolvedValue({ error: null });
    expect((await loginAction(null, form({ identifier: "a@b.co", password: "travel123" }))).ok).toBe(true);
  });

  it("open redirects are neutralised on login", async () => {
    const { loginAction } = await import("@/lib/auth/actions");
    signInWithPassword.mockResolvedValue({ error: null });
    const r = await loginAction(null, form({ identifier: "a@b.co", password: "travel123", next: "https://evil.example" }));
    expect(r).toEqual({ ok: true, redirectTo: "/" });
  });

  it("forgot password answers identically whether or not the account exists", async () => {
    const { forgotPasswordAction } = await import("@/lib/auth/actions");
    emailForUsername.mockResolvedValue(null);
    const a = await forgotPasswordAction(null, form({ identifier: "ghost" }));
    emailForUsername.mockResolvedValue("real@example.com");
    const b = await forgotPasswordAction(null, form({ identifier: "real" }));
    expect(a).toEqual(b);
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    expect(resetPasswordForEmail.mock.calls[0][1].redirectTo).toContain("reset-password");
  });
});
