"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, MailCheck, XCircle } from "lucide-react";
import {
  checkUsernameAvailable,
  forgotPasswordAction,
  loginAction,
  registerAction,
  updatePasswordAction,
  type AuthResult,
} from "@/lib/auth/actions";
import { passwordSchema, USERNAME_RE } from "@/lib/auth/rules";

function useRedirectOnSuccess(state: AuthResult | null) {
  useEffect(() => {
    // Full navigation so the session cookie set by the server action is picked up everywhere.
    if (state?.ok && state.redirectTo) window.location.assign(state.redirectTo);
  }, [state]);
}

function FieldError({ id, code }: { id: string; code?: string }) {
  const t = useTranslations("auth.errors");
  if (!code) return null;
  return (
    <p id={id} className="mt-1 text-sm text-clay" role="alert">
      {t(code)}
    </p>
  );
}

function FormError({ state }: { state: AuthResult | null }) {
  const t = useTranslations("auth.errors");
  if (!state || state.ok || state.error === "invalid") return null;
  return (
    <p role="alert" className="rounded-xl bg-clay-soft px-4 py-3 text-sm">
      {t(state.error)}
    </p>
  );
}

function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  error,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  error?: string;
  onChange?: (v: string) => void;
}) {
  const t = useTranslations("auth");
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          maxLength={72}
          className="input pr-11"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => onChange?.(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-charcoal-soft hover:text-charcoal"
          aria-label={show ? t("hidePassword") : t("showPassword")}
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      <FieldError id={`${id}-err`} code={error} />
    </div>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button type="submit" className="btn btn-primary w-full py-3" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {label}
    </button>
  );
}

export function LoginForm({ next, usernameLogin }: { next: string; usernameLogin: boolean }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthResult | null, FormData>(loginAction, null);
  const fields = state && !state.ok ? state.fields ?? {} : {};
  useRedirectOnSuccess(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="identifier" className="label">
          {usernameLogin ? t("usernameOrEmail") : t("email")}
        </label>
        <input
          id="identifier"
          name="identifier"
          type={usernameLogin ? "text" : "email"}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          className="input"
          aria-invalid={Boolean(fields.identifier)}
        />
        <FieldError id="identifier-err" code={fields.identifier} />
      </div>
      <PasswordInput id="password" name="password" label={t("password")} autoComplete="current-password" error={fields.password} />
      <div className="flex justify-end text-sm">
        <Link href={`/forgot-password?next=${encodeURIComponent(next)}`} className="font-medium text-forest-700 hover:underline">
          {t("forgotPassword")}
        </Link>
      </div>
      <FormError state={state} />
      <SubmitButton pending={pending || Boolean(state?.ok)} label={t("signIn")} />
    </form>
  );
}

type UsernameState = "idle" | "checking" | "available" | "taken" | "invalid" | "unknown";

export function RegisterForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthResult | null, FormData>(registerAction, null);
  const [username, setUsername] = useState("");
  const [uState, setUState] = useState<UsernameState>("idle");
  const [password, setPassword] = useState("");
  const reqId = useRef(0);
  const fields = state && !state.ok ? state.fields ?? {} : {};
  useRedirectOnSuccess(state);

  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (!u) return setUState("idle");
    if (!USERNAME_RE.test(u)) return setUState("invalid");
    setUState("checking");
    const id = ++reqId.current;
    const h = setTimeout(async () => {
      const r = await checkUsernameAvailable(u).catch(() => null);
      if (id !== reqId.current) return;
      setUState(!r || r.available === null ? "unknown" : r.available ? "available" : "taken");
    }, 400);
    return () => clearTimeout(h);
  }, [username]);

  const pwOk = passwordSchema.safeParse(password).success;

  if (state?.ok && state.message === "checkEmail") {
    return (
      <div className="space-y-3 text-center" role="status">
        <MailCheck className="mx-auto h-12 w-12 text-forest-600" aria-hidden="true" />
        <h2 className="text-xl font-bold">{t("checkEmailTitle")}</h2>
        <p className="muted">{t("checkEmailBody")}</p>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-primary">
          {t("signIn")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="username" className="label">
          {t("username")}
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={20}
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-invalid={uState === "taken" || uState === "invalid" || Boolean(fields.username)}
          aria-describedby="username-help"
        />
        <p id="username-help" className="mt-1 flex items-center gap-1 text-xs" aria-live="polite">
          {uState === "checking" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
          {uState === "available" && <CheckCircle2 className="h-3.5 w-3.5 text-forest-600" aria-hidden="true" />}
          {(uState === "taken" || uState === "invalid") && <XCircle className="h-3.5 w-3.5 text-clay" aria-hidden="true" />}
          <span className={uState === "taken" || uState === "invalid" ? "text-clay" : "muted"}>
            {uState === "available"
              ? t("usernameAvailable")
              : uState === "taken"
                ? t("errors.usernameTaken")
                : uState === "invalid"
                  ? t("errors.usernameFormat")
                  : t("usernameRules")}
          </span>
        </p>
        <FieldError id="username-err" code={fields.username} />
      </div>
      <div>
        <label htmlFor="displayName" className="label">
          {t("displayName")} <span className="font-normal muted">({t("optional")})</span>
        </label>
        <input id="displayName" name="displayName" autoComplete="nickname" maxLength={60} className="input" />
      </div>
      <div>
        <label htmlFor="email" className="label">
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          className="input"
          aria-invalid={Boolean(fields.email)}
          aria-describedby="email-help"
        />
        <p id="email-help" className="mt-1 text-xs muted">
          {t("emailWhy")}
        </p>
        <FieldError id="email-err" code={fields.email} />
      </div>
      <PasswordInput
        id="password"
        name="password"
        label={t("password")}
        autoComplete="new-password"
        error={fields.password}
        onChange={setPassword}
      />
      <p className={`-mt-2 text-xs ${password && !pwOk ? "text-clay" : "muted"}`}>{t("passwordRules")}</p>
      <PasswordInput
        id="confirmPassword"
        name="confirmPassword"
        label={t("confirmPassword")}
        autoComplete="new-password"
        error={fields.confirmPassword}
      />
      <FormError state={state} />
      <SubmitButton pending={pending} label={t("createAccount")} />
      <p className="text-xs muted">
        {t("termsNote")}{" "}
        <Link href="/privacy" className="underline">
          {t("privacyLink")}
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthResult | null, FormData>(forgotPasswordAction, null);
  const fields = state && !state.ok ? state.fields ?? {} : {};
  if (state?.ok) {
    return (
      <div className="space-y-3 text-center" role="status">
        <MailCheck className="mx-auto h-12 w-12 text-forest-600" aria-hidden="true" />
        <p>{t("resetSent")}</p>
        <Link href="/login" className="btn btn-primary">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="identifier" className="label">
          {t("usernameOrEmail")}
        </label>
        <input id="identifier" name="identifier" autoComplete="username" required maxLength={254} className="input" />
        <FieldError id="identifier-err" code={fields.identifier} />
      </div>
      <FormError state={state} />
      <SubmitButton pending={pending} label={t("sendResetLink")} />
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthResult | null, FormData>(updatePasswordAction, null);
  const fields = state && !state.ok ? state.fields ?? {} : {};
  useRedirectOnSuccess(state);
  return (
    <form action={action} className="space-y-4" noValidate>
      <PasswordInput id="password" name="password" label={t("newPassword")} autoComplete="new-password" error={fields.password} />
      <p className="-mt-2 text-xs muted">{t("passwordRules")}</p>
      <PasswordInput
        id="confirmPassword"
        name="confirmPassword"
        label={t("confirmPassword")}
        autoComplete="new-password"
        error={fields.confirmPassword}
      />
      <FormError state={state} />
      <SubmitButton pending={pending || Boolean(state?.ok)} label={t("savePassword")} />
    </form>
  );
}
