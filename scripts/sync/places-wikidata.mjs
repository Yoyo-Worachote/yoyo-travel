// Sync attraction records for each province from Wikidata (CC0) with
// Wikimedia Commons images (license/author recorded per file).
// Only items with coordinates and at least one Wikipedia article or image are
// kept, so every record is a documented, real place. Province is assigned by
// point-in-polygon against the geoBoundaries polygons. Coverage is NOT exhaustive.
// Usage: node scripts/sync/places-wikidata.mjs [province-slug ...]
import path from "node:path";
import {
  ROOT,
  OUT_DIR,
  sparql,
  qid,
  commonsImageInfo,
  commonsFileFromUri,
  writeJson,
  readJson,
  sleep,
  slugify,
} from "./lib.mjs";

// Wikidata class → app category. Order = priority when an item has several classes.
const CLASSES = [
  ["Q95080679", "national_park"], // national park of Thailand
  ["Q46169", "national_park"],
  ["Q1377575", "nature"], // wildlife refuge
  ["Q179049", "nature"], // nature reserve
  ["Q34038", "waterfall"],
  ["Q40080", "beach"],
  ["Q23442", "island"],
  ["Q39594", "beach"], // bay
  ["Q8502", "mountain"],
  ["Q54050", "mountain"], // hill
  ["Q35509", "cave"],
  ["Q23397", "nature"], // lake
  ["Q17334112", "history"], // historical park of Thailand
  ["Q21177212", "history"], // Khmer temple ruins in Thailand
  ["Q13016741", "history"], // Khmer temple
  ["Q109607", "history"], // ruins
  ["Q839954", "history"], // archaeological site
  ["Q16560", "history"], // palace
  ["Q4989906", "history"], // monument
  ["Q17431399", "museum"], // national museum
  ["Q33506", "museum"],
  ["Q207694", "museum"], // art museum
  ["Q2087181", "museum"], // historic house museum
  ["Q427287", "temple"], // wat
  ["Q5393308", "temple"], // Buddhist temple
  ["Q44539", "temple"],
  ["Q697295", "temple"], // shrine
  ["Q32815", "temple"], // mosque
  ["Q16970", "temple"], // church building
  ["Q2977", "temple"], // cathedral
  ["Q1945774", "market"], // floating market
  ["Q37654", "market"],
  ["Q11315", "shopping"], // shopping center
  ["Q22698", "park"],
  ["Q1107656", "park"], // garden
  ["Q43501", "park"], // zoo
  ["Q194195", "activity"], // amusement park
];
const CLASS_TO_CAT = new Map(CLASSES.map(([q, c]) => [q, c]));
const CLASS_PRIORITY = new Map(CLASSES.map(([q], i) => [q, i]));

const GEO_FEATURE_CLASSES = new Set(["Q8502", "Q54050", "Q23442", "Q39594", "Q23397", "Q34038", "Q35509", "Q40080"]);
const CATEGORY_CAP = { temple: 14, mountain: 6, island: 8, default: 8 };
const PROVINCE_CAP = 60;

// Step 1 (cheap): per class, every item in Thailand (P17) with coordinates and
// at least one Wikipedia article or a Commons image. Querying country-wide per
// class is much faster on WDQS than walking P131 chains per province.
async function fetchCandidates(classQid) {
  return sparql(`
    SELECT ?item ?links ?coord (SAMPLE(?img0) AS ?img) WHERE {
      ?item wdt:P31 wd:${classQid} ; wdt:P17 wd:Q869 ; wdt:P625 ?coord ; wikibase:sitelinks ?links .
      OPTIONAL { ?item wdt:P18 ?img0 }
    } GROUP BY ?item ?links ?coord`);
}

// Step 2: labels/descriptions/coords/links for the selected items only.
async function fetchDetails(ids) {
  const rows = await sparql(`
    SELECT ?item ?en ?th ?den ?dth ?web ?enwiki ?thwiki WHERE {
      VALUES ?item { ${ids.map((id) => `wd:${id}`).join(" ")} }
      OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en) = "en") }
      OPTIONAL { ?item rdfs:label ?th FILTER(lang(?th) = "th") }
      OPTIONAL { ?item schema:description ?den FILTER(lang(?den) = "en") }
      OPTIONAL { ?item schema:description ?dth FILTER(lang(?dth) = "th") }
      OPTIONAL { ?item wdt:P856 ?web }
      OPTIONAL { ?enwiki schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?thwiki schema:about ?item ; schema:isPartOf <https://th.wikipedia.org/> }
    }`);
  const byId = new Map();
  for (const r of rows) {
    const id = qid(r.item);
    const prev = byId.get(id);
    if (!prev) byId.set(id, r);
    else for (const k of Object.keys(r)) prev[k] ??= r[k];
  }
  return byId;
}

function parsePoint(wkt) {
  const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(wkt ?? "");
  return m ? [Number(m[2]), Number(m[1])] : null;
}

function selectItems(rows, limit) {
  const items = new Map();
  for (const r of rows) {
    const id = qid(r.item);
    const prev = items.get(id);
    const prio = r.prio ?? CLASS_PRIORITY.get(qid(r.cls)) ?? 999;
    if (!prev) {
      items.set(id, { ...r, id: r.id ?? id, prio, links: Number(r.links) });
    } else {
      if (prio < prev.prio) Object.assign(prev, { cls: r.cls, prio });
      for (const k of Object.keys(r)) prev[k] ??= r[k];
    }
  }
  const sorted = [...items.values()].sort(
    (a, b) => b.links - a.links || Number(!!b.img) - Number(!!a.img) || a.id.localeCompare(b.id),
  );
  const perCat = {};
  const picked = [];
  for (const it of sorted) {
    const cat = CLASS_TO_CAT.get(qid(it.cls));
    const cap = CATEGORY_CAP[cat] ?? CATEGORY_CAP.default;
    if ((perCat[cat] ?? 0) >= cap) continue;
    perCat[cat] = (perCat[cat] ?? 0) + 1;
    picked.push({ ...it, category: cat });
    if (picked.length >= limit) break;
  }
  return picked;
}

function pointInRing([lat, lng], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function makeProvinceLocator(geojson) {
  const shapes = geojson.features.map((f) => ({
    slug: f.properties.slug,
    polys: f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates,
  }));
  return (pt) => {
    for (const s of shapes) {
      for (const poly of s.polys) {
        if (pointInRing(pt, poly[0]) && !poly.slice(1).some((h) => pointInRing(pt, h))) return s.slug;
      }
    }
    return null;
  };
}

async function main() {
  const { provinces } = await readJson(path.join(OUT_DIR, "provinces.json"));
  const only = process.argv.slice(2);
  const outFile = path.join(OUT_DIR, "places-wikidata.json");
  const existing = await readJson(outFile).catch(() => ({ places: [] }));
  const keep = only.length ? existing.places.filter((p) => !only.includes(p.provinceSlug)) : [];
  const fetchedAt = new Date().toISOString();

  const geojson = await readJson(path.join(ROOT, "public", "geo", "thailand-provinces.geojson"));
  const locate = makeProvinceLocator(geojson);

  // 1) candidates country-wide, per class
  const candidateRows = [];
  for (const [classQid] of CLASSES) {
    try {
      const rows = await fetchCandidates(classQid);
      // Geographic features often only have bot-generated Cebuano/Swedish articles
      // (GeoNames imports); require stronger evidence of notability for them.
      const minLinks = GEO_FEATURE_CLASSES.has(classQid) ? 2 : 1;
      const kept = rows.filter((r) => Number(r.links) >= minLinks || r.img);
      kept.forEach((r) => candidateRows.push({ ...r, cls: `http://www.wikidata.org/entity/${classQid}` }));
      console.log(`${classQid} (${CLASS_TO_CAT.get(classQid)}): ${rows.length} → ${kept.length}`);
    } catch (e) {
      console.error(`${classQid}: FAILED ${e.message}`);
    }
    await sleep(1000);
  }

  // 2) assign to provinces with the real boundary polygons
  const byProvince = new Map();
  let outside = 0;
  for (const r of candidateRows) {
    const pt = parsePoint(r.coord);
    const slug = pt && locate(pt);
    if (!slug) { outside++; continue; }
    if (only.length && !only.includes(slug)) continue;
    if (!byProvince.has(slug)) byProvince.set(slug, []);
    byProvince.get(slug).push(r);
  }
  console.log(`candidates outside all province polygons (offshore/border): ${outside}`);

  // 3) select per province, then fetch details for the selection
  const raw = [];
  for (const prov of provinces) {
    const rows = byProvince.get(prov.slug) ?? [];
    const candidates = selectItems(rows, 90);
    const details = new Map();
    for (let i = 0; i < candidates.length; i += 100) {
      const batch = await fetchDetails(candidates.slice(i, i + 100).map((c) => c.id));
      batch.forEach((v, k) => details.set(k, v));
      await sleep(800);
    }
    const usable = candidates
      .map((c) => ({ ...c, ...details.get(c.id), id: c.id, coord: c.coord }))
      .filter((c) => c.en || c.th);
    const items = selectItems(usable, PROVINCE_CAP);
    raw.push(...items.map((it) => ({ ...it, provinceSlug: prov.slug })));
    console.log(`${prov.slug}: ${rows.length} candidates → ${items.length} places`);
  }

  // A place can sit in two provinces' P131 chains only by data error; keep the first.
  const seen = new Set(keep.map((p) => p.source.externalId));
  const unique = raw.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));

  console.log(`Commons metadata for ${unique.filter((u) => u.img).length} images…`);
  const images = await commonsImageInfo(unique.map((u) => commonsFileFromUri(u.img)), 960);

  const places = unique.map((it) => {
    const coord = parsePoint(it.coord);
    const nameEn = it.en ?? null;
    const nameTh = it.th ?? null;
    const file = commonsFileFromUri(it.img);
    return {
      id: `wd-${it.id}`,
      slug: `${slugify(nameEn ?? "") || "place"}-${it.id.toLowerCase()}`,
      provinceSlug: it.provinceSlug,
      kind: it.category === "activity" ? "activity" : "attraction",
      category: it.category,
      nameTh,
      nameEn,
      descriptionTh: it.dth ?? null,
      descriptionEn: it.den ?? null,
      lat: coord[0],
      lng: coord[1],
      image: (file && images.get(file)) || null,
      website: it.web ?? null,
      wikipediaTh: it.thwiki ?? null,
      wikipediaEn: it.enwiki ?? null,
      wikiSitelinks: it.links,
      source: {
        provider: "wikidata",
        externalId: it.id,
        url: `https://www.wikidata.org/wiki/${it.id}`,
        license: "CC0 1.0",
        attribution: "Wikidata contributors",
        fetchedAt,
      },
    };
  });

  const all = [...keep, ...places].sort(
    (a, b) => a.provinceSlug.localeCompare(b.provinceSlug) || b.wikiSitelinks - a.wikiSitelinks,
  );
  await writeJson(outFile, {
    source: "Wikidata (CC0) + Wikimedia Commons images (per-file license)",
    fetchedAt,
    places: all,
  });
  console.log(`total places: ${all.length}, with images: ${all.filter((p) => p.image).length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
