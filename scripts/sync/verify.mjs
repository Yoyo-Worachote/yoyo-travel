// Verify generated catalog data: coverage per province, duplicates, broken
// province links, and points that fall outside their province polygon.
// Usage: node scripts/sync/verify.mjs   (exit code 1 on hard errors)
import path from "node:path";
import { OUT_DIR, ROOT, readJson } from "./lib.mjs";

const prov = (await readJson(path.join(OUT_DIR, "provinces.json"))).provinces;
const wd = (await readJson(path.join(OUT_DIR, "places-wikidata.json"))).places;
const osm = (await readJson(path.join(OUT_DIR, "places-osm.json")).catch(() => ({ places: [] }))).places;
const geo = await readJson(path.join(ROOT, "public", "geo", "thailand-provinces.geojson"));

const errors = [];
const warnings = [];
const slugs = new Set(prov.map((p) => p.slug));

// 1) Provinces
if (prov.length !== 77) errors.push(`expected 77 provinces, got ${prov.length}`);
if (new Set(prov.map((p) => p.iso)).size !== prov.length) errors.push("duplicate province ISO codes");
for (const p of prov) {
  if (!p.nameTh || !p.nameEn) errors.push(`province ${p.slug} missing a name`);
  if (!p.summaryTh || !p.summaryEn) warnings.push(`province ${p.slug} missing a Wikipedia summary`);
  if (!p.image) warnings.push(`province ${p.slug} has no licensed image`);
}
const geoSlugs = new Set(geo.features.map((f) => f.properties.slug));
for (const s of slugs) if (!geoSlugs.has(s)) errors.push(`province ${s} has no polygon`);

// 2) Places: ids, links, names
const all = [...wd, ...osm];
const ids = new Map();
for (const p of all) {
  if (ids.has(p.id)) errors.push(`duplicate place id ${p.id}`);
  ids.set(p.id, p);
  if (!slugs.has(p.provinceSlug)) errors.push(`place ${p.id} links to unknown province ${p.provinceSlug}`);
  if (!p.nameTh && !p.nameEn) errors.push(`place ${p.id} has no name`);
  if (!p.source?.url || !p.source?.license) errors.push(`place ${p.id} missing source/license`);
}
const slugKeys = new Map();
for (const p of all) {
  const k = `${p.provinceSlug}/${p.slug}`;
  if (slugKeys.has(k)) errors.push(`duplicate route ${k}`);
  slugKeys.set(k, p.id);
}

// 3) Point-in-polygon consistency
function inRing([lat, lng], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const polys = new Map(
  geo.features.map((f) => [f.properties.slug, f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates]),
);
const locate = (pt) => {
  for (const [slug, ps] of polys) if (ps.some((poly) => inRing(pt, poly[0]))) return slug;
  return null;
};
let outside = 0;
const mismatched = [];
for (const p of all) {
  const s = locate([p.lat, p.lng]);
  if (!s) outside++;
  else if (s !== p.provinceSlug) mismatched.push(`${p.id} (${p.nameEn ?? p.nameTh}) tagged ${p.provinceSlug}, polygon says ${s}`);
}
// Simplified polygons blur borders, so a few border mismatches are expected.
if (mismatched.length > all.length * 0.02) errors.push(`${mismatched.length} places outside their province polygon`);
else if (mismatched.length) warnings.push(`${mismatched.length} border mismatches (simplified polygons), e.g. ${mismatched.slice(0, 3).join("; ")}`);
if (outside) warnings.push(`${outside} places outside all polygons (offshore islands / coast)`);

// 4) Possible cross-provider duplicates (same name ≤ 300 m)
const norm = (s) => (s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const byName = new Map();
for (const p of all) for (const n of new Set([norm(p.nameTh), norm(p.nameEn)])) if (n.length >= 3) byName.set(n, [...(byName.get(n) ?? []), p]);
const km = (a, b) => {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const dupPairs = new Set();
for (const list of byName.values())
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++)
      if (list[i].id !== list[j].id && km(list[i], list[j]) <= 0.3) dupPairs.add([list[i].id, list[j].id].sort().join(" ~ "));
if (dupPairs.size) warnings.push(`${dupPairs.size} possible duplicates (same name ≤300 m), e.g. ${[...dupPairs].slice(0, 3).join("; ")}`);

// 5) Coverage per province
const cov = prov.map((p) => {
  const w = wd.filter((x) => x.provinceSlug === p.slug).length;
  const o = osm.filter((x) => x.provinceSlug === p.slug);
  return {
    slug: p.slug,
    wikidata: w,
    osm: o.length,
    restaurant: o.filter((x) => x.kind === "restaurant").length,
    cafe: o.filter((x) => x.kind === "cafe").length,
    stay: o.filter((x) => x.kind === "accommodation").length,
  };
});
const noWd = cov.filter((c) => c.wikidata === 0).map((c) => c.slug);
const noOsm = cov.filter((c) => c.osm === 0).map((c) => c.slug);
const thinOsm = cov.filter((c) => c.osm > 0 && c.osm < 15).map((c) => `${c.slug}(${c.osm})`);
if (noWd.length) errors.push(`provinces without Wikidata places: ${noWd.join(", ")}`);
if (noOsm.length) errors.push(`provinces without OSM places: ${noOsm.join(", ")}`);
if (thinOsm.length) warnings.push(`provinces with few OSM places: ${thinOsm.join(", ")}`);

console.log(`provinces: ${prov.length}  wikidata places: ${wd.length}  osm places: ${osm.length}  total: ${all.length}`);
console.log(`provinces with wikidata data: ${cov.filter((c) => c.wikidata > 0).length}/77, with osm data: ${cov.filter((c) => c.osm > 0).length}/77`);
console.log(`provinces with restaurants: ${cov.filter((c) => c.restaurant > 0).length}/77, cafes: ${cov.filter((c) => c.cafe > 0).length}/77, stays: ${cov.filter((c) => c.stay > 0).length}/77`);
console.log(`min/max wikidata per province: ${Math.min(...cov.map((c) => c.wikidata))}/${Math.max(...cov.map((c) => c.wikidata))}; min/max osm: ${Math.min(...cov.map((c) => c.osm))}/${Math.max(...cov.map((c) => c.osm))}`);
for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(errors.length ? `\n${errors.length} error(s)` : "\nverify: OK");
process.exit(errors.length ? 1 : 0);
