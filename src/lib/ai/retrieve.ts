import "server-only";
import { getPlaceById, getPlaces, getPlacesByProvince, getProvince, getProvinces } from "../catalog";
import { normalizeText } from "../search";
import type { Place, Province } from "../types";
import type { InternalDoc } from "./chat";

const KEYWORDS: Array<[RegExp, string[]]> = [
  [/วัด|ศาสนสถาน|temple|wat\b|shrine|mosque|church/i, ["temple"]],
  [/ทะเล|หาด|ชายหาด|beach|sea\b|coast/i, ["beach", "island"]],
  [/เกาะ|island/i, ["island"]],
  [/ภูเขา|ดอย|ภู|mountain|hill|viewpoint|จุดชมวิว/i, ["mountain", "viewpoint"]],
  [/น้ำตก|waterfall/i, ["waterfall"]],
  [/อุทยาน|national park/i, ["national_park"]],
  [/ธรรมชาติ|nature|ป่า|forest/i, ["national_park", "nature", "waterfall", "mountain", "cave"]],
  [/ถ้ำ|cave/i, ["cave"]],
  [/พิพิธภัณฑ์|museum/i, ["museum"]],
  [/ประวัติศาสตร์|โบราณ|history|historic|ruins|อุทยานประวัติศาสตร์/i, ["history"]],
  [/ตลาด|market/i, ["market"]],
  [/ช้อป|ห้าง|shopping|mall/i, ["shopping", "market"]],
  [/คาเฟ่|กาแฟ|cafe|coffee/i, ["cafe"]],
  [/ร้านอาหาร|อาหาร|กิน|restaurant|food|eat/i, ["restaurant", "market"]],
  [/ที่พัก|โรงแรม|รีสอร์ท|โฮสเทล|hotel|hostel|resort|stay|accommodation/i, ["hotel", "hostel", "guest_house"]],
  [/สวน|park|zoo|สวนสัตว์|family|ครอบครัว|เด็ก/i, ["park", "activity"]],
];

function placeDoc(p: Place, province: Province | undefined): InternalDoc {
  const name = [p.nameTh, p.nameEn].filter(Boolean).join(" / ");
  const facts = [
    `category: ${p.category}`,
    province ? `province: ${province.nameTh} / ${province.nameEn}` : "",
    p.descriptionEn || p.descriptionTh ? `description: ${[p.descriptionTh, p.descriptionEn].filter(Boolean).join(" / ")}` : "",
    `coordinates: ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`,
    p.openingHours ? `opening_hours (OpenStreetMap, unverified): ${p.openingHours}` : "opening hours: unknown",
    p.cuisine?.length ? `cuisine: ${p.cuisine.join(", ")}` : "",
    p.fee ? `fee (OpenStreetMap): ${p.fee}` : "price: no verified data",
    p.website ? `official website: ${p.website}` : "",
    `data source: ${p.source.provider} (${p.source.license})`,
  ]
    .filter(Boolean)
    .join("; ");
  return { title: `${name}${province ? ` (${province.nameTh})` : ""}`, url: `/thailand/${p.provinceSlug}/${p.slug}`, facts };
}

function provinceDoc(p: Province): InternalDoc {
  const summary = (p.summaryEn || p.summaryTh || "").slice(0, 500);
  return {
    title: `${p.nameTh} / ${p.nameEn}`,
    url: `/thailand/${p.slug}`,
    facts: `Thai province, region: ${p.region}${summary ? `; summary (Wikipedia): ${summary}` : ""}`,
  };
}

/**
 * Internal retrieval: provinces/places named in the question, then the best
 * documented places of the requested categories in those provinces (or the
 * page-context province), else nationally.
 */
export function retrieveInternal(question: string, ctx: { provinceSlug?: string | null; placeId?: string | null } = {}): InternalDoc[] {
  const q = normalizeText(question);
  const docs: InternalDoc[] = [];
  const seen = new Set<string>();
  const push = (d: InternalDoc) => {
    if (!seen.has(d.url)) {
      seen.add(d.url);
      docs.push(d);
    }
  };

  const ctxPlace = ctx.placeId ? getPlaceById(ctx.placeId) : undefined;
  if (ctxPlace) push(placeDoc(ctxPlace, getProvince(ctxPlace.provinceSlug)));

  const mentionedProvinces = getProvinces().filter((p) => {
    const th = normalizeText(p.nameTh);
    const en = normalizeText(p.nameEn);
    return (th.length >= 2 && q.includes(th)) || (en.length >= 3 && q.includes(en));
  });
  const provinceSlugs = mentionedProvinces.map((p) => p.slug);
  if (!provinceSlugs.length && ctx.provinceSlug) provinceSlugs.push(ctx.provinceSlug);
  if (!provinceSlugs.length && ctxPlace) provinceSlugs.push(ctxPlace.provinceSlug);
  for (const slug of provinceSlugs.slice(0, 3)) {
    const p = getProvince(slug);
    if (p) push(provinceDoc(p));
  }

  // explicit place-name mentions (names of ≥ 4 chars)
  for (const p of getPlaces()) {
    if (docs.length >= 10) break;
    const names = [normalizeText(p.nameTh), normalizeText(p.nameEn)].filter((n) => n.length >= 4);
    if (names.some((n) => q.includes(n))) push(placeDoc(p, getProvince(p.provinceSlug)));
  }

  const cats = new Set(KEYWORDS.filter(([re]) => re.test(question)).flatMap(([, c]) => c));
  const pool = provinceSlugs.length ? provinceSlugs.flatMap((s) => getPlacesByProvince(s)) : cats.size ? getPlaces() : [];
  const ranked = pool
    .filter((p) => !cats.size || cats.has(p.category))
    .sort((a, b) => (b.wikiSitelinks ?? 0) - (a.wikiSitelinks ?? 0) || Number(!!b.openingHours) - Number(!!a.openingHours));
  for (const p of ranked) {
    if (docs.length >= 8) break;
    push(placeDoc(p, getProvince(p.provinceSlug)));
  }
  return docs;
}
