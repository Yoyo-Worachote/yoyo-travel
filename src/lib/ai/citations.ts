/**
 * Guards against invented links/citations in model output:
 * - any URL not in the allowed source list is removed
 * - citation markers [n] that don't map to a provided source are removed
 */
const URL_RE = /https?:\/\/[^\s<>()[\]"'`]+/g;
const MD_LINK_RE = /\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]*)\)/g;

function normalizeUrl(u: string): string {
  return u.replace(/[.,;:!?]+$/, "").replace(/\/$/, "");
}

export function sanitizeAnswer(
  text: string,
  allowedUrls: string[],
  sourceCount: number,
  removedLabel = "[link removed]",
): { text: string; removedLinks: number; removedCitations: number } {
  const allowed = new Set(allowedUrls.map(normalizeUrl));
  let removedLinks = 0;
  let removedCitations = 0;
  const kept: string[] = [];
  // 1) Markdown links: keep allowed ones (stash them so step 2 skips them)
  let out = text.replace(MD_LINK_RE, (_m, label: string, url: string) => {
    if (allowed.has(normalizeUrl(url))) {
      kept.push(`[${label}](${url})`);
      return `\u0000${kept.length - 1}\u0000`;
    }
    removedLinks++;
    return label;
  });
  // 2) Bare URLs
  out = out.replace(URL_RE, (url) => {
    if (allowed.has(normalizeUrl(url))) return url;
    removedLinks++;
    return removedLabel;
  });
  // 3) Citation markers
  out = out.replace(/\[(\d{1,3})\]/g, (m, n: string) => {
    const i = Number(n);
    if (i >= 1 && i <= sourceCount) return m;
    removedCitations++;
    return "";
  });
  out = out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => kept[Number(i)]);
  return { text: out.trim(), removedLinks, removedCitations };
}

export function detectLanguage(text: string, fallback: "th" | "en"): "th" | "en" {
  const thai = (text.match(/[฀-๿]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (thai === 0 && latin === 0) return fallback;
  return thai >= latin * 0.3 ? "th" : "en";
}
