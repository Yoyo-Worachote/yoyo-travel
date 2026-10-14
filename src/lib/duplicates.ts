import { haversineKm } from "./geo";
import { normalizeText } from "./search";

export interface DupCandidate {
  id: string;
  nameTh: string | null;
  nameEn: string | null;
  lat: number;
  lng: number;
  provinceSlug: string;
}

/**
 * Possible duplicates: same normalized Thai or English name and ≤ maxMeters
 * apart (also catches the same place from two providers).
 */
export function findDuplicates<T extends DupCandidate>(items: T[], maxMeters = 300): Array<[T, T]> {
  const byName = new Map<string, T[]>();
  for (const it of items) {
    for (const n of new Set([normalizeText(it.nameTh), normalizeText(it.nameEn)])) {
      if (n.length < 3) continue;
      const list = byName.get(n) ?? [];
      list.push(it);
      byName.set(n, list);
    }
  }
  const pairs: Array<[T, T]> = [];
  const seen = new Set<string>();
  for (const list of byName.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.id === b.id) continue;
        const key = [a.id, b.id].sort().join("|");
        if (seen.has(key)) continue;
        if (haversineKm([a.lat, a.lng], [b.lat, b.lng]) * 1000 <= maxMeters) {
          seen.add(key);
          pairs.push([a, b]);
        }
      }
    }
  }
  return pairs;
}
