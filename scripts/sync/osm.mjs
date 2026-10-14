// Sync travel POIs per province from OpenStreetMap via the Overpass API.
// Data © OpenStreetMap contributors, ODbL 1.0.
//
// Categories: restaurants, cafes, hotels, resorts, hostels/guest houses,
// activities, attractions/museums, markets/malls, travel essentials
// (bus/ferry terminals). Only named POIs are kept; per category we keep the
// most completely tagged ones (score). Record ids are OSM ids, so they stay
// stable across re-syncs and existing wishlists/trips keep working.
//
// OSM does not carry ratings or reviews. Prices exist only as `fee` / `charge`
// tags on some places; they are kept verbatim with the OSM source.
//
// Overpass is a shared free service: one province at a time, split queries,
// pauses, retries, a fallback endpoint, and partial results are rejected.
//
// Usage: node scripts/sync/osm.mjs [province-slug ...]
import path from "node:path";
import { OUT_DIR, fetchWithRetry, writeJson, readJson, sleep, slugify, dedupePlaces } from "./lib.mjs";

const OVERPASS = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
const ENDPOINTS = [OVERPASS, "https://overpass.kumi.systems/api/interpreter"];

/** Max records kept per category per province. */
export const PICK = {
  restaurant: 30,
  cafe: 20,
  hotel: 15,
  resort: 10,
  hostel: 8,
  guest_house: 12,
  motel: 4,
  apartment: 4,
  activity: 12,
  attraction: 15,
  museum: 6,
  market: 8,
  shopping: 5,
  transport: 6,
};

const PARTS = [
  `nwr["amenity"="restaurant"]["name"](area.a); out center tags 500;`,
  `nwr["amenity"="cafe"]["name"](area.a); out center tags 300;`,
  `nwr["tourism"~"^(hotel|hostel|guest_house|motel|apartment)$"]["name"](area.a); out center tags 500;
nwr["leisure"="resort"]["name"](area.a); out center tags 100;`,
  `nwr["tourism"~"^(viewpoint|theme_park|zoo|aquarium|attraction|museum|gallery)$"]["name"](area.a); out center tags 400;
nwr["leisure"~"^(water_park|nature_reserve)$"]["name"](area.a); out center tags 60;`,
  `nwr["amenity"~"^(marketplace|bus_station|ferry_terminal)$"]["name"](area.a); out center tags 150;
nwr["shop"="mall"]["name"](area.a); out center tags 60;`,
];

function query(iso, parts = PARTS) {
  return `[out:json][timeout:170];
area["ISO3166-2"="${iso}"]["admin_level"="4"]->.a;
${parts.join("\n")}`;
}

/** One Overpass request; a 200 whose `remark` reports a timeout/error is a failure (partial data). */
async function runQuery(endpoint, data, label) {
  const res = await fetchWithRetry(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data }).toString(),
      timeoutMs: 200_000,
    },
    { label, retries: 3 },
  );
  const json = await res.json();
  if (json.remark && /runtime error|timed out|out of memory/i.test(json.remark)) {
    throw new Error(`partial result: ${json.remark.slice(0, 120)}`);
  }
  return json.elements ?? [];
}

/** One query per part (smaller, more reliable); each part retries on both endpoints. */
async function fetchProvince(prov) {
  const all = [];
  for (const [i, part] of PARTS.entries()) {
    let lastErr;
    let ok = false;
    for (const ep of ENDPOINTS) {
      try {
        all.push(...(await runQuery(ep, query(prov.iso, [part]), `overpass ${prov.slug} part ${i + 1}`)));
        ok = true;
        break;
      } catch (e) {
        lastErr = e;
        console.warn(`  ${prov.slug} part ${i + 1} failed on ${new URL(ep).host}: ${e.message}`);
        await sleep(10_000);
      }
    }
    if (!ok) throw lastErr;
    await sleep(2500);
  }
  return all;
}

export function classify(tags) {
  if (tags.amenity === "restaurant") return { kind: "restaurant", category: "restaurant" };
  if (tags.amenity === "cafe") return { kind: "cafe", category: "cafe" };
  if (tags.leisure === "resort" || (tags.tourism === "hotel" && /resort/i.test(`${tags.name ?? ""} ${tags["name:en"] ?? ""}`)))
    return { kind: "accommodation", category: "resort" };
  if (["hotel", "hostel", "guest_house", "motel", "apartment"].includes(tags.tourism))
    return { kind: "accommodation", category: tags.tourism };
  if (tags.tourism === "viewpoint") return { kind: "attraction", category: "viewpoint" };
  if (["zoo", "aquarium", "theme_park"].includes(tags.tourism) || tags.leisure === "water_park")
    return { kind: "activity", category: "activity" };
  if (tags.tourism === "museum" || tags.tourism === "gallery") return { kind: "attraction", category: "museum" };
  if (tags.tourism === "attraction") return { kind: "attraction", category: "attraction" };
  if (tags.leisure === "nature_reserve") return { kind: "attraction", category: "nature" };
  if (tags.amenity === "marketplace") return { kind: "attraction", category: "market" };
  if (tags.shop === "mall") return { kind: "attraction", category: "shopping" };
  if (tags.amenity === "bus_station" || tags.amenity === "ferry_terminal") return { kind: "transport", category: "transport" };
  return null;
}

const pickKey = (category) => (category in PICK ? category : "activity");

/** Higher score = more complete, more useful record. */
export function score(tags) {
  let s = 0;
  if (tags["name:en"]) s += 2;
  if (tags["name:th"]) s += 2;
  if (tags.opening_hours) s += 3;
  if (tags.website || tags["contact:website"]) s += 3;
  if (tags.phone || tags["contact:phone"]) s += 1;
  if (tags.cuisine) s += 2;
  if (tags.stars) s += 1;
  if (tags.wikidata) s += 3;
  if (tags["addr:street"] || tags["addr:full"]) s += 1;
  if (tags.fee || tags.charge) s += 1;
  return s;
}

const hasThai = (s) => /[฀-๿]/.test(s ?? "");

/** Facilities we can show/filter, only when OSM tags them. */
export function amenitiesOf(tags) {
  const a = [];
  const yes = (v) => v && v !== "no";
  if (yes(tags.internet_access) || tags.wifi === "yes") a.push("wifi");
  if (tags.wheelchair === "yes") a.push("wheelchair");
  if (tags.air_conditioning === "yes") a.push("air_conditioning");
  if (tags.outdoor_seating === "yes") a.push("outdoor_seating");
  if (tags.takeaway === "yes" || tags.takeaway === "only") a.push("takeaway");
  if (tags.delivery === "yes") a.push("delivery");
  if (tags["diet:vegetarian"] === "yes" || tags["diet:vegetarian"] === "only") a.push("vegetarian");
  if (tags["diet:vegan"] === "yes" || tags["diet:vegan"] === "only") a.push("vegan");
  if (tags["diet:halal"] === "yes" || tags["diet:halal"] === "only") a.push("halal");
  if (yes(tags.parking) || tags["parking:fee"]) a.push("parking");
  if (tags.swimming_pool === "yes" || tags.pool === "yes") a.push("pool");
  if (tags.reservation === "yes" || tags.reservation === "recommended" || tags.reservation === "required") a.push("reservation");
  return a;
}

export function addressOf(tags) {
  if (tags["addr:full"]) return tags["addr:full"].slice(0, 200);
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:subdistrict"],
    tags["addr:district"],
    tags["addr:city"],
    tags["addr:postcode"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ").slice(0, 200) : null;
}

/**
 * OSM `charge` like "40 THB", "THB 100", "50-100 THB". Returns a structured
 * price only for unambiguous THB amounts; anything else is kept as raw text.
 */
export function parseCharge(charge) {
  if (!charge) return null;
  const c = String(charge).trim();
  const m = /^(?:THB|฿)?\s*(\d{1,6})(?:\s*[-–]\s*(\d{1,6}))?\s*(?:THB|บาท|฿)?$/i.exec(c);
  if (!m || !/(THB|บาท|฿)/i.test(c)) return { raw: c.slice(0, 80) };
  const min = Number(m[1]);
  const max = m[2] ? Number(m[2]) : min;
  if (max < min) return { raw: c.slice(0, 80) };
  return { min, max, currency: "THB", raw: c.slice(0, 80) };
}

function cleanUrl(u) {
  if (!u) return null;
  const v = String(u).trim();
  return /^https?:\/\//i.test(v) ? v.slice(0, 300) : null;
}

function toRecord(el, provinceSlug, fetchedAt) {
  const tags = el.tags ?? {};
  const cls = classify(tags);
  if (!cls) return null;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  const nameTh = tags["name:th"] ?? (hasThai(tags.name) ? tags.name : null);
  const nameEn = tags["name:en"] ?? (!hasThai(tags.name) ? tags.name : null);
  const externalId = `${el.type}/${el.id}`;
  const website = cleanUrl(tags.website ?? tags["contact:website"] ?? tags.url) ?? cleanUrl(tags["contact:facebook"]);
  const phone = (tags.phone ?? tags["contact:phone"] ?? "").split(";")[0].trim().slice(0, 40) || null;
  const charge = parseCharge(tags.charge);
  return {
    id: `osm-${el.type}-${el.id}`,
    slug: `${slugify(nameEn ?? "") || cls.kind}-osm${el.type[0]}${el.id}`,
    provinceSlug,
    kind: cls.kind,
    category: cls.category,
    nameTh,
    nameEn,
    descriptionTh: null,
    descriptionEn: null,
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    image: null,
    website,
    phone,
    address: addressOf(tags),
    openingHours: tags.opening_hours ? tags.opening_hours.slice(0, 200) : null,
    cuisine: tags.cuisine ? tags.cuisine.split(";").map((c) => c.trim()).filter(Boolean).slice(0, 4) : null,
    stars: tags.stars ? Number.parseFloat(tags.stars) || null : null,
    rooms: tags.rooms ? Number.parseInt(tags.rooms, 10) || null : null,
    fee: tags.fee === "no" ? "free" : tags.fee === "yes" || charge ? "paid" : null,
    charge,
    amenities: amenitiesOf(tags),
    brand: tags.brand ? tags.brand.slice(0, 80) : null,
    wikidataRef: tags.wikidata ?? null,
    score: score(tags),
    source: {
      provider: "osm",
      externalId,
      url: `https://www.openstreetmap.org/${externalId}`,
      license: "ODbL 1.0",
      attribution: "© OpenStreetMap contributors",
      fetchedAt,
    },
  };
}

export function pickPerCategory(records) {
  const picked = [];
  const groups = new Map();
  for (const r of records) {
    const k = pickKey(r.category);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const [key, list] of groups) {
    list.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const names = new Set();
    for (const r of list) {
      const n = (r.nameEn ?? r.nameTh ?? "").toLowerCase().replace(/\s+/g, " ");
      if (names.has(n)) continue; // same name twice in a province → keep the better record
      names.add(n);
      picked.push(r);
      if (names.size >= PICK[key]) break;
    }
  }
  return picked;
}

async function main() {
  const { provinces } = await readJson(path.join(OUT_DIR, "provinces.json"));
  const only = process.argv.slice(2);
  const outFile = path.join(OUT_DIR, "places-osm.json");
  const existing = await readJson(outFile).catch(() => ({ places: [] }));
  const fetchedAt = new Date().toISOString();
  const report = { added: 0, updated: 0, removed: 0, failed: [] };
  const done = new Set();
  const result = [];

  // Merge refreshed provinces with previous data, drop duplicates, write. Called
  // after every province (checkpoint) so an interrupted run keeps its progress.
  const wd = (await readJson(path.join(OUT_DIR, "places-wikidata.json")).catch(() => ({ places: [] }))).places;
  const writeOut = async () => {
    const kept = existing.places.filter((p) => !done.has(p.provinceSlug));
    const merged = dedupePlaces([...wd.map((p) => ({ ...p, wikiSitelinks: (p.wikiSitelinks ?? 0) + 1000 })), ...kept, ...result]);
    const keepIds = new Set(merged.places.map((p) => p.id));
    const all = [...kept, ...result]
      .filter((p) => keepIds.has(p.id))
      .sort((a, b) => a.provinceSlug.localeCompare(b.provinceSlug) || a.id.localeCompare(b.id));
    report.skippedDuplicates = [...kept, ...result].length - all.length;
    await writeJson(outFile, {
      source: "OpenStreetMap via Overpass API — © OpenStreetMap contributors, ODbL 1.0",
      fetchedAt,
      places: all,
    });
    return all;
  };

  for (const prov of provinces) {
    if (only.length && !only.includes(prov.slug)) continue;
    try {
      const elements = await fetchProvince(prov);
      const seen = new Set();
      const records = elements
        .map((el) => toRecord(el, prov.slug, fetchedAt))
        .filter((r) => r && !seen.has(r.id) && seen.add(r.id));
      const picked = pickPerCategory(records);
      result.push(...picked);
      done.add(prov.slug);
      const prevIds = new Set(existing.places.filter((p) => p.provinceSlug === prov.slug).map((p) => p.id));
      const added = picked.filter((p) => !prevIds.has(p.id)).length;
      report.added += added;
      report.updated += picked.length - added;
      report.removed += [...prevIds].filter((id) => !picked.some((p) => p.id === id)).length;
      console.log(`${prov.slug}: ${records.length} → ${picked.length} (+${added})`);
      await writeOut();
    } catch (e) {
      report.failed.push(prov.slug);
      console.error(`${prov.slug}: FAILED ${e.message}`);
    }
    await sleep(3000);
  }

  const all = await writeOut();
  console.log(`total OSM places: ${all.length}`);
  console.log(`report: ${JSON.stringify(report)}`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
