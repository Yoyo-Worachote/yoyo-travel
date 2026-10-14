// Sync Thailand province records + boundary polygons.
//   Sources:
//   - Province names/IDs/images: Wikidata (CC0), matched by ISO 3166-2 (P300)
//   - Summaries: Wikipedia REST page summary (CC BY-SA 4.0, attributed with link)
//   - Images: Wikimedia Commons (license + author recorded per file)
//   - Boundaries: geoBoundaries gbOpen THA ADM1 (OpenStreetMap contributors, ODbL 1.0)
// Usage: node scripts/sync/provinces.mjs
import path from "node:path";
import fs from "node:fs/promises";
import {
  ROOT,
  OUT_DIR,
  sparql,
  qid,
  commonsImageInfo,
  commonsFileFromUri,
  fetchWithRetry,
  writeJson,
  readJson,
  sleep,
} from "./lib.mjs";

const GEOBOUNDARIES_API = "https://www.geoboundaries.org/api/current/gbOpen/THA/ADM1/";

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return a / 2;
}

function ringCentroid(ring) {
  let x = 0, y = 0, a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    x += (ring[j][0] + ring[i][0]) * f;
    y += (ring[j][1] + ring[i][1]) * f;
    a += f;
  }
  a /= 2;
  return [x / (6 * a), y / (6 * a)];
}

function geometryStats(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  let best = null;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const poly of polys) {
    const area = Math.abs(ringArea(poly[0]));
    if (!best || area > best.area) best = { area, ring: poly[0] };
    for (const [lng, lat] of poly[0]) {
      minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    }
  }
  const [cLng, cLat] = ringCentroid(best.ring);
  const r = (n) => Math.round(n * 10000) / 10000;
  return { centroid: [r(cLat), r(cLng)], bbox: [r(minLat), r(minLng), r(maxLat), r(maxLng)] };
}

function roundGeometry(geom) {
  const round = (c) => [Math.round(c[0] * 10000) / 10000, Math.round(c[1] * 10000) / 10000];
  const dedupe = (ring) => {
    const out = [];
    for (const c of ring.map(round)) {
      const prev = out[out.length - 1];
      if (!prev || prev[0] !== c[0] || prev[1] !== c[1]) out.push(c);
    }
    return out;
  };
  if (geom.type === "Polygon") return { type: "Polygon", coordinates: geom.coordinates.map(dedupe) };
  return { type: "MultiPolygon", coordinates: geom.coordinates.map((p) => p.map(dedupe)) };
}

async function wikipediaSummary(lang, articleUrl) {
  if (!articleUrl) return null;
  const title = decodeURIComponent(articleUrl.split("/wiki/").pop());
  try {
    const res = await fetchWithRetry(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      {},
      { retries: 2, label: `wp ${lang} ${title}` },
    );
    const json = await res.json();
    if (!json.extract) return null;
    return { text: json.extract, url: json.content_urls?.desktop?.page ?? articleUrl };
  } catch (e) {
    console.warn(`  no ${lang} summary for ${title}: ${e.message}`);
    return null;
  }
}

async function main() {
  const index = (await readJson(path.join(ROOT, "src", "data", "province-index.json"))).provinces;
  // Re-use previously fetched summaries when Wikipedia rate-limits a re-run.
  const previous = new Map(
    (await readJson(path.join(OUT_DIR, "provinces.json")).catch(() => ({ provinces: [] }))).provinces.map((p) => [p.iso, p]),
  );
  if (index.length !== 77) throw new Error(`province-index.json must list 77 provinces, has ${index.length}`);

  console.log("1/4 Wikidata province records…");
  const rows = await sparql(`
    SELECT ?p ?iso ?en ?th ?img ?enwiki ?thwiki WHERE {
      ?p wdt:P300 ?iso . FILTER(STRSTARTS(?iso, "TH-") && ?iso != "TH-S")
      ?p rdfs:label ?en FILTER(lang(?en) = "en")
      ?p rdfs:label ?th FILTER(lang(?th) = "th")
      OPTIONAL { ?p wdt:P18 ?img }
      OPTIONAL { ?enwiki schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { ?thwiki schema:about ?p ; schema:isPartOf <https://th.wikipedia.org/> }
    }`);
  const byIso = new Map();
  for (const r of rows) if (!byIso.has(r.iso)) byIso.set(r.iso, r);

  console.log("2/4 Commons image metadata…");
  const files = [...byIso.values()].map((r) => commonsFileFromUri(r.img));
  const images = await commonsImageInfo(files, 1280);

  console.log("3/4 geoBoundaries polygons…");
  const meta = await (await fetchWithRetry(GEOBOUNDARIES_API)).json();
  const geo = await (await fetchWithRetry(meta.simplifiedGeometryGeoJSON)).json();
  const geoByIso = new Map(geo.features.map((f) => [f.properties.shapeISO, f]));

  console.log("4/4 Wikipedia summaries…");
  const fetchedAt = new Date().toISOString();
  const provinces = [];
  const features = [];
  for (const entry of index) {
    const wd = byIso.get(entry.iso);
    const feature = geoByIso.get(entry.iso);
    if (!wd) throw new Error(`No Wikidata record for ${entry.iso}`);
    if (!feature) throw new Error(`No boundary polygon for ${entry.iso}`);
    const nameTh = wd.th.replace(/^จังหวัด/, "").trim();
    const stats = geometryStats(feature.geometry);
    const prev = previous.get(entry.iso);
    const sumTh = prev?.summaryTh
      ? { text: prev.summaryTh, url: prev.summaryThUrl }
      : await wikipediaSummary("th", wd.thwiki);
    const sumEn = prev?.summaryEn
      ? { text: prev.summaryEn, url: prev.summaryEnUrl }
      : await wikipediaSummary("en", wd.enwiki);
    if (!prev?.summaryTh || !prev?.summaryEn) await sleep(1500);
    const file = commonsFileFromUri(wd.img);
    provinces.push({
      slug: entry.slug,
      iso: entry.iso,
      region: entry.region,
      wikidataId: qid(wd.p),
      nameTh,
      nameEn: wd.en.replace(/ Province$/, ""),
      centroid: stats.centroid,
      bbox: stats.bbox,
      image: (file && images.get(file)) || null,
      summaryTh: sumTh?.text ?? null,
      summaryThUrl: sumTh?.url ?? null,
      summaryEn: sumEn?.text ?? null,
      summaryEnUrl: sumEn?.url ?? null,
      fetchedAt,
    });
    features.push({
      type: "Feature",
      properties: { iso: entry.iso, slug: entry.slug },
      geometry: roundGeometry(feature.geometry),
    });
    process.stdout.write(".");
  }
  console.log();

  await writeJson(path.join(OUT_DIR, "provinces.json"), {
    source: {
      names: "Wikidata (CC0) — https://www.wikidata.org/",
      summaries: "Wikipedia (CC BY-SA 4.0) — linked per province",
      images: "Wikimedia Commons — license per file",
    },
    fetchedAt,
    provinces,
  });

  const geoOut = path.join(ROOT, "public", "geo", "thailand-provinces.geojson");
  await fs.mkdir(path.dirname(geoOut), { recursive: true });
  await fs.writeFile(geoOut, JSON.stringify({ type: "FeatureCollection", features }));
  console.log(`wrote public/geo/thailand-provinces.geojson (${features.length} features)`);
  await writeJson(path.join(OUT_DIR, "boundaries-attribution.json"), {
    dataset: "geoBoundaries gbOpen THA ADM1 (simplified)",
    boundaryID: meta.boundaryID,
    source: meta.boundarySource,
    license: meta.boundaryLicense,
    licenseSource: meta.licenseSource,
    sourceUrl: meta.boundarySourceURL,
    downloadUrl: meta.simplifiedGeometryGeoJSON,
    year: meta.boundaryYearRepresented,
    fetchedAt,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
