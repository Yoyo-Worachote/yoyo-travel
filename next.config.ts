import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const tileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function originOf(url: string): string | null {
  try {
    return new URL(url.replace(/\{[a-z]\}/g, "a")).origin;
  } catch {
    return null;
  }
}

const imgSources = [
  "'self'",
  "data:",
  "blob:",
  "https://upload.wikimedia.org",
  "https://thumb.wikimedia.org",
  "https://lh3.googleusercontent.com",
  "https://*.tile.openstreetmap.org",
  "https://tile.openstreetmap.org",
  originOf(tileUrl),
  originOf(supabaseUrl),
].filter(Boolean);

const connectSources = ["'self'", originOf(supabaseUrl), supabaseUrl ? supabaseUrl.replace("https://", "wss://") : null].filter(
  Boolean,
);

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src ${imgSources.join(" ")}`,
  "font-src 'self' data:",
  `connect-src ${connectSources.join(" ")}${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com " + (originOf(supabaseUrl) ?? ""),
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Wikimedia already serves sized thumbnails; skip paid image optimisation.
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    "/**": ["./src/data/generated/**/*.json"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
