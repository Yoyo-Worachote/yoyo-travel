// Sync restaurants, cafes, accommodation and activity POIs per province from
// OpenStreetMap via the Overpass API. Data © OpenStreetMap contributors, ODbL 1.0.
// Overpass is a shared free service: queries run sequentially with pauses.
// Only named POIs are kept; we pick the most completely tagged ones per type.
// OSM does not carry prices or ratings, so none are produced here.
// Usage: node scripts/sync/osm.mjs [province-slug ...]
import path from "node:path";
import { OUT_DIR, fetchWithRetry, writeJson, readJson, sleep, slugify, dedupePlaces } from "./lib.mjs";

const OVERPASS = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
const PICK = { restaurant: 14, cafe: 8, accommodation: 14, activity: 8 };

const ENDPOINTS = [OVERPASS, "https://overpass.kumi.systems/api/interpreter"];

const PARTS = [
  `nwr["amenity"="restaurant"]["name"](area.a)->.r; .r out center tags 250;`,
  `nwr["amenity"="cafe"]["name"](area.a)->.c; .c out center tags 150;`,
  `nwr["tourism"~"^(hotel|hostel|guest_house|motel|apartment)$"]["name"](area.a)->.h; .h out center tags 250;`,
  `nwr["tourism"~"^(viewpoint|theme_park|zoo|aquarium)$"]["name"](area.a)->.v; .v out center tags 100;
nwr["leisure"~"^(water_park|nature_reserve)$"]["name"](area.a)->.w; .w out center tags 60;`,
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

/**
 * Whole-province query first; on failure try the fallback endpoint, then split
 * into one smaller query per category (each with its own retries).
 */
async function fetchProvince(prov) {
  for (const ep of ENDPOINTS) {
    try {
      return await runQuery(ep, query(prov.iso), `overpass ${prov.slug} @${new URL(ep).host}`);
    } catch (e) {
      console.warn(`  ${prov.slug}: combined query failed on ${new URL(ep).host}: ${e.message}`);
      await sleep(10_000);
    }
  }
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
        await sleep(10_000);
      }
    }
    if (!ok) throw lastErr;
    await sleep(3000);
  }
  return all;
}

function classify(tags) {
  if (tags.amenity === "restaurant") return { kind: "restaurant", category: "restaurant" };
  if (tags.amenity === "cafe") return { kind: "cafe", category: "cafe" };
  if (tags.tourism && ["hotel", "hostel", "guest_house", "motel", "apartment"].includes(tags.tourism))
    return { kind: "accommodation", category: tags.tourism };
  if (tags.tourism === "viewpoint") return { kind: "attraction", category: "viewpoint" };
  if (tags.tourism === "zoo" || tags.tourism === "aquarium" || tags.tourism === "theme_park" || tags.leisure === "water_park")
    return { kind: "activity", category: "activity" };
  if (tags.leisure === "nature_reserve") return { kind: "attraction", category: "nature" };
  return null;
}

// Higher score = more complete, more useful record.
function score(tags) {
  let s = 0;
  if (tags["name:en"]) s += 2;
  if (tags["name:th"]) s += 2;
  if (tags.opening_hours) s += 3;
  if (tags.website || tags["contact:website"]) s += 3;
  if (tags.cuisine) s += 2;
  if (tags.stars) s += 1;
  if (tags.wikidata) s += 3;
  if (tags["addr:street"] || tags["addr:full"]) s += 1;
  if (tags.fee) s += 1;
  return s;
}

const hasThai = (s) => /[฀-๿]/.test(s ?? "");

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
  const website = tags.website ?? tags["contact:website"] ?? null;
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
    website: website && /^https?:\/\//.test(website) ? website : null,
    openingHours: tags.opening_hours ?? null,
    cuisine: tags.cuisine ? tags.cuisine.split(";").map((c) => c.trim()).slice(0, 4) : null,
    stars: tags.stars ? Number(tags.stars) || null : null,
    fee: tags.fee === "no" ? "free" : tags.fee === "yes" ? "paid" : null,
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

async function main() {
  const { provinces } = await readJson(path.join(OUT_DIR, "provinces.json"));
  const only = process.argv.slice(2);
  const outFile = path.join(OUT_DIR, "places-osm.json");
  const existing = await readJson(outFile).catch(() => ({ places: [] }));
  const fetchedAt = new Date().toISOString();
  const done = new Set();
  const result = [];

  for (const prov of provinces) {
    if (only.length && !only.includes(prov.slug)) continue;
    try {
      const elements = await fetchProvince(prov);
      const records = elements.map((el) => toRecord(el, prov.slug, fetchedAt)).filter(Boolean);
      const picked = [];
      for (const kind of Object.keys(PICK)) {
        const ofKind = records
          .filter((r) => r.kind === kind)
          .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
        // de-duplicate by normalized name within a province
        const names = new Set();
        for (const r of ofKind) {
          const key = (r.nameEn ?? r.nameTh ?? "").toLowerCase().replace(/\s+/g, " ");
          if (names.has(key)) continue;
          names.add(key);
          picked.push(r);
          if (names.size >= PICK[kind]) break;
        }
      }
      result.push(...picked);
      done.add(prov.slug);
      console.log(`${prov.slug}: ${records.length} → ${picked.length}`);
    } catch (e) {
      console.error(`${prov.slug}: FAILED ${e.message}`);
    }
    await sleep(4000);
  }

  // keep previous data for provinces not refreshed in this run
  const kept = existing.places.filter((p) => !done.has(p.provinceSlug));
  // Drop OSM POIs that duplicate a Wikidata place (same name ≤ 300 m) or each other.
  const wd = (await readJson(path.join(OUT_DIR, "places-wikidata.json")).catch(() => ({ places: [] }))).places;
  const merged = dedupePlaces([...wd.map((p) => ({ ...p, wikiSitelinks: (p.wikiSitelinks ?? 0) + 1000 })), ...kept, ...result]);
  const keepIds = new Set(merged.places.map((p) => p.id));
  const osmDropped = merged.dropped.filter((d) => d.startsWith("osm-"));
  if (osmDropped.length) console.log(`dropped ${osmDropped.length} OSM duplicates`);
  const all = [...kept, ...result].filter((p) => keepIds.has(p.id)).sort((a, b) => a.provinceSlug.localeCompare(b.provinceSlug));
  await writeJson(outFile, {
    source: "OpenStreetMap via Overpass API — © OpenStreetMap contributors, ODbL 1.0",
    fetchedAt,
    places: all,
  });
  console.log(`total OSM places: ${all.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
