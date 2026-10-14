// Shared helpers for data sync scripts (run with Node 20+).
// These scripts call public APIs politely: identifying User-Agent, sequential
// requests, small delays, and retries with backoff. Output is committed JSON so
// the app never calls these APIs on page views.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const UA = `YoyoTravelBeta/0.1 (travel discovery app data sync${
  process.env.SYNC_CONTACT ? `; ${process.env.SYNC_CONTACT}` : ""
})`;
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const OUT_DIR = path.join(ROOT, "src", "data", "generated");

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(url, init = {}, { retries = 4, label = url } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": UA, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(init.timeoutMs ?? 120_000),
      });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after"));
        throw Object.assign(new Error(`HTTP ${res.status}`), {
          waitMs: res.status === 429 ? Math.max(15_000, (retryAfter || 0) * 1000) : 0,
        });
      }
      if (!res.ok) {
        const body = await res.text();
        throw Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`), { fatal: true });
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (err.fatal) break;
      const wait = Math.max(err.waitMs ?? 0, 2000 * 2 ** attempt);
      console.warn(`  retry ${attempt + 1}/${retries} for ${label.slice(0, 80)}: ${err.message} (wait ${wait}ms)`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

export async function sparql(query) {
  const res = await fetchWithRetry(
    "https://query.wikidata.org/sparql",
    {
      method: "POST",
      headers: {
        Accept: "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ query }).toString(),
    },
    { label: "wikidata sparql" },
  );
  const json = await res.json();
  return json.results.bindings.map((b) =>
    Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])),
  );
}

export const qid = (uri) => uri?.split("/").pop();

function stripHtml(html) {
  return (html ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Look up Wikimedia Commons file metadata (thumbnail + author + license).
 * Files without a machine-readable license are dropped so we never display
 * an image we cannot attribute correctly.
 */
export async function commonsImageInfo(fileNames, width = 960) {
  const out = new Map();
  const unique = [...new Set(fileNames.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 40) {
    const batch = unique.slice(i, i + 40);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "imageinfo",
      iiprop: "url|extmetadata|size",
      iiurlwidth: String(width),
      iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl|UsageTerms|AttributionRequired|Credit",
      titles: batch.map((f) => `File:${f}`).join("|"),
    });
    const res = await fetchWithRetry(`https://commons.wikimedia.org/w/api.php?${params}`, {}, { label: "commons" });
    const json = await res.json();
    const normalized = new Map((json.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of json.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const meta = info.extmetadata ?? {};
      const license = stripHtml(meta.LicenseShortName?.value);
      if (!license) continue;
      const original = (normalized.get(page.title) ?? page.title).replace(/^File:/, "");
      out.set(original, {
        file: page.title.replace(/^File:/, ""),
        url: (info.thumburl ?? info.url).split("?")[0],
        width: info.thumbwidth ?? info.width,
        height: info.thumbheight ?? info.height,
        author: stripHtml(meta.Artist?.value).slice(0, 200) || "Unknown author (see source)",
        license,
        licenseUrl: meta.LicenseUrl?.value ?? null,
        sourceUrl: info.descriptionurl,
      });
    }
    await sleep(1500);
  }
  return out;
}

/** Map of "space-separated" Commons file names from P18 URLs. */
export function commonsFileFromUri(uri) {
  if (!uri) return null;
  return decodeURIComponent(uri.split("/Special:FilePath/").pop()).replace(/_/g, " ");
}

export async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 0) + "\n", "utf8");
  console.log(`wrote ${path.relative(ROOT, file)}`);
}

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export function slugify(s) {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const normName = (s) =>
  (s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function distKm(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * Drop duplicate records of the same real place (Wikidata sometimes has two
 * items for one place): same normalized TH or EN name within maxKm.
 * Keeps the better documented record (more sitelinks, then has image).
 */
export function dedupePlaces(places, maxKm = 0.3) {
  const rank = (p) => (p.wikiSitelinks ?? 0) * 10 + (p.image ? 5 : 0) + (p.descriptionTh || p.descriptionEn ? 1 : 0);
  const sorted = [...places].sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id));
  const kept = [];
  const byName = new Map();
  const dropped = [];
  for (const p of sorted) {
    const names = [...new Set([normName(p.nameTh), normName(p.nameEn)])].filter((n) => n.length >= 3);
    const dup = names.flatMap((n) => byName.get(n) ?? []).find((k) => distKm(k, p) <= maxKm);
    if (dup) {
      dropped.push(`${p.id} → kept ${dup.id}`);
      continue;
    }
    kept.push(p);
    for (const n of names) byName.set(n, [...(byName.get(n) ?? []), p]);
  }
  const keptIds = new Set(kept.map((p) => p.id));
  return { places: places.filter((p) => keptIds.has(p.id)), dropped };
}
