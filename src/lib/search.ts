import { CATEGORY_GROUPS, type CategoryGroup } from "./categories";

/** Lower-case, strip diacritics/punctuation; keeps Thai characters. */
export function normalizeText(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}฀-๿]+/gu, " ")
    .trim();
}

export interface Searchable {
  id: string;
  nameTh: string | null;
  nameEn: string | null;
  category?: string;
  provinceSlug?: string;
  extra?: string[]; // e.g. cuisine, province names
}

/**
 * Rank: exact name > prefix > word-prefix > substring > extra-field match.
 * Every query token must match somewhere.
 */
export function scoreMatch(item: Searchable, query: string): number {
  const q = normalizeText(query);
  if (!q) return 0;
  const names = [normalizeText(item.nameTh), normalizeText(item.nameEn)].filter(Boolean);
  const extras = (item.extra ?? []).map(normalizeText);
  let best = 0;
  for (const n of names) {
    if (n === q) best = Math.max(best, 100);
    else if (n.startsWith(q)) best = Math.max(best, 80);
    else if (n.split(" ").some((w) => w.startsWith(q))) best = Math.max(best, 60);
    else if (n.includes(q)) best = Math.max(best, 40);
  }
  if (best) return best;
  const tokens = q.split(" ").filter(Boolean);
  const hay = [...names, ...extras].join(" | ");
  if (tokens.length && tokens.every((t) => hay.includes(t))) return 20;
  return 0;
}

export function searchItems<T extends Searchable>(
  items: T[],
  query: string,
  opts: { limit?: number; offset?: number; group?: CategoryGroup | null; provinceSlug?: string | null } = {},
): { results: T[]; total: number } {
  const groupCats = opts.group ? (CATEGORY_GROUPS[opts.group] as readonly string[]) : null;
  const filtered = items.filter(
    (i) =>
      (!groupCats || (i.category && groupCats.includes(i.category))) &&
      (!opts.provinceSlug || i.provinceSlug === opts.provinceSlug),
  );
  const q = query.trim();
  const ranked = q
    ? filtered
        .map((item) => ({ item, s: scoreMatch(item, q) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.item)
    : filtered;
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 20;
  return { results: ranked.slice(offset, offset + limit), total: ranked.length };
}
