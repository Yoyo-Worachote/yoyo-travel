import { sanitizeAnswer, detectLanguage } from "./citations";
import type { ChatSource, ChatTurn, ModelProvider, SearchProvider, WebResult } from "./types";

export const MAX_MESSAGE_CHARS = 1000;

export interface InternalDoc {
  title: string;
  url: string; // site-relative path, e.g. /thailand/chiang-mai/doi-inthanon-q...
  facts: string; // compact factual text built only from our records
}

export interface ChatRequest {
  turns: ChatTurn[];
  uiLocale: "th" | "en";
  contextLabel?: string | null;
}

export type ChatResult =
  | {
      status: "ok";
      answer: string;
      sources: ChatSource[];
      provider: string;
      webSearched: boolean;
      lang: "th" | "en";
    }
  | { status: "not_configured"; sources: ChatSource[]; webSearched: false; lang: "th" | "en" }
  | { status: "provider_error"; sources: ChatSource[]; webSearched: boolean; lang: "th" | "en" };

const FRESH_RE =
  /(ราคา|ค่า|เปิด|ปิด|เวลา|ล่าสุด|ข่าว|เทศกาล|งาน|อีเวนต์|เดินทาง|รถ|เครื่องบิน|ตั๋ว|จอง|price|cost|fee|open|hours|latest|news|festival|event|transport|bus|train|flight|ticket|book)/i;

export function buildSystemPrompt(lang: "th" | "en", contextLabel?: string | null): string {
  const language = lang === "th" ? "Thai (ภาษาไทย)" : "English";
  return [
    "You are Yoyo Travel's assistant for travel in Thailand.",
    `Always answer in ${language}. Keep official place names; add the other-language name in parentheses when it is given in the sources.`,
    contextLabel ? `The user is currently viewing: ${contextLabel}.` : "",
    "Rules:",
    "- Base factual claims ONLY on the numbered SOURCES provided in the latest user message. Cite them inline like [1] or [2].",
    "- Never invent places, URLs, prices, opening hours, ratings, reviews, rankings or citations. Do not write any URL that is not in the sources.",
    "- If the sources do not contain something (e.g. prices or opening hours), say clearly that you don't have verified data and suggest checking the official source.",
    "- Label suggestions and estimates as such (e.g. 'suggestion', 'estimate'). General travel advice without a source must be phrased as general advice, not fact.",
    "- Never claim you made a booking or performed a live search unless web sources are provided.",
    "- Be concise and well-structured (short paragraphs or bullet lists). Ask a short follow-up question when the request is ambiguous.",
  ]
    .filter(Boolean)
    .join("\n");
}

function sourcesBlock(sources: ChatSource[], internal: InternalDoc[], web: WebResult[]): string {
  const lines: string[] = [];
  sources.forEach((s) => {
    if (s.kind === "internal") {
      const doc = internal.find((d) => d.url === s.url);
      lines.push(`[${s.n}] (Yoyo Travel database) ${s.title} — ${doc?.facts ?? ""} — URL: ${s.url}`);
    } else {
      const w = web.find((r) => r.url === s.url);
      lines.push(`[${s.n}] (web) ${s.title} — ${w?.snippet ?? ""} — URL: ${s.url}`);
    }
  });
  return lines.length ? lines.join("\n") : "(no sources found)";
}

export async function answerChat(
  req: ChatRequest,
  deps: {
    model: ModelProvider | null;
    search: SearchProvider | null;
    retrieve: (query: string) => InternalDoc[];
  },
): Promise<ChatResult> {
  const lastUser = [...req.turns].reverse().find((t) => t.role === "user");
  const question = lastUser?.content ?? "";
  const lang = detectLanguage(question, req.uiLocale);

  // 1–2) internal data first
  const priorUser = req.turns.filter((t) => t.role === "user").slice(-2, -1)[0]?.content ?? "";
  let internal = deps.retrieve(question);
  if (internal.length === 0 && priorUser) internal = deps.retrieve(`${priorUser} ${question}`);
  internal = internal.slice(0, 8);

  // 3) web search only when configured and useful
  let web: WebResult[] = [];
  let webSearched = false;
  if (deps.search && (FRESH_RE.test(question) || internal.length < 3)) {
    try {
      web = await deps.search.search(`${question} ${lang === "th" ? "ประเทศไทย" : "Thailand"}`.slice(0, 380), { count: 5, lang });
      webSearched = true;
    } catch {
      web = [];
    }
  }

  const sources: ChatSource[] = [
    ...internal.map((d, i) => ({ n: i + 1, kind: "internal" as const, title: d.title, url: d.url })),
    ...web.map((w, i) => ({ n: internal.length + i + 1, kind: "web" as const, title: w.title, url: w.url, snippet: w.snippet })),
  ];

  if (!deps.model) return { status: "not_configured", sources, webSearched: false, lang };

  // 4) give the model only the relevant material
  const history = req.turns.slice(-8, -1);
  const prompt = `${question}\n\nSOURCES:\n${sourcesBlock(sources, internal, web)}`;
  try {
    const raw = await deps.model.generate(buildSystemPrompt(lang, req.contextLabel), [...history, { role: "user", content: prompt }]);
    // 5–8) only keep links/citations that map to real provided sources
    const { text } = sanitizeAnswer(
      raw,
      sources.map((s) => s.url),
      sources.length,
      lang === "th" ? "[ลิงก์ที่ไม่มีในแหล่งข้อมูลถูกนำออก]" : "[link not in sources removed]",
    );
    return { status: "ok", answer: text, sources, provider: deps.model.name, webSearched, lang };
  } catch {
    return { status: "provider_error", sources, webSearched, lang };
  }
}
