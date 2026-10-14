import { z } from "zod";

/** Shared client + server validation rules (messages are i18n keys under auth.errors). */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_RE, "usernameFormat");

/** 8–72 chars (bcrypt limit), at least one letter and one digit. */
export const passwordSchema = z
  .string()
  .min(8, "passwordShort")
  .max(72, "passwordLong")
  .regex(/[A-Za-z]/, "passwordLetter")
  .regex(/\d/, "passwordDigit");

export const emailSchema = z.string().trim().toLowerCase().max(254).email("emailInvalid");

export const registerSchema = z
  .object({
    username: usernameSchema,
    displayName: z.string().trim().max(60, "displayNameLong").optional().default(""),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    next: z.string().optional().default("/"),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "passwordMismatch" })
  .refine((v) => v.password.toLowerCase() !== v.username, { path: ["password"], message: "passwordIsUsername" });

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "identifierRequired").max(254),
  password: z.string().min(1, "passwordRequired").max(72, "passwordLong"),
  next: z.string().optional().default("/"),
});

export const isEmail = (s: string) => s.includes("@");

/** Only same-site relative paths are allowed as post-auth redirects. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next.slice(0, 300);
}

export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
