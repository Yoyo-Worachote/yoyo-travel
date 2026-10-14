import { describe, expect, it, vi } from "vitest";
import { answerChat, type InternalDoc } from "@/lib/ai/chat";
import { detectLanguage, sanitizeAnswer } from "@/lib/ai/citations";
import { getModelProvider, getSearchProvider } from "@/lib/ai/providers";
import { retrieveInternal } from "@/lib/ai/retrieve";
import { ProviderError, type ModelProvider, type SearchProvider } from "@/lib/ai/types";
import { rateLimit } from "@/lib/ratelimit";

const docs: InternalDoc[] = [
  { title: "Doi Inthanon", url: "/thailand/chiang-mai/doi-inthanon-q1", facts: "category: mountain" },
  { title: "Wat Phra Sing", url: "/thailand/chiang-mai/wat-phra-sing-q2", facts: "category: temple" },
];

describe("sanitizeAnswer", () => {
  it("keeps allowed links and citations, strips invented ones", () => {
    const text =
      "See [Doi](/thailand/chiang-mai/doi-inthanon-q1) [1] and [fake](https://fake.example.com/x) [7]. More: https://invented.example.org/page and https://real.example.com/a";
    const out = sanitizeAnswer(text, ["/thailand/chiang-mai/doi-inthanon-q1", "https://real.example.com/a"], 2, "[removed]");
    expect(out.text).toContain("[Doi](/thailand/chiang-mai/doi-inthanon-q1)");
    expect(out.text).toContain("[1]");
    expect(out.text).not.toContain("[7]");
    expect(out.text).not.toContain("fake.example.com");
    expect(out.text).not.toContain("invented.example.org");
    expect(out.text).toContain("https://real.example.com/a");
    expect(out.removedLinks).toBe(2);
    expect(out.removedCitations).toBe(1);
  });

  it("strips invented relative links too", () => {
    const out = sanitizeAnswer("[x](/thailand/made-up)", [], 0);
    expect(out.text).toBe("x");
  });
});

describe("detectLanguage", () => {
  it("detects Thai vs English questions", () => {
    expect(detectLanguage("เที่ยวเชียงใหม่ที่ไหนดี", "en")).toBe("th");
    expect(detectLanguage("Where should I go in Chiang Mai?", "th")).toBe("en");
    expect(detectLanguage("ไป Chiang Mai ช่วงไหนดีคะ", "en")).toBe("th");
    expect(detectLanguage("123", "en")).toBe("en");
  });
});

describe("answerChat", () => {
  const turns = [{ role: "user" as const, content: "แนะนำที่เที่ยวเชียงใหม่" }];

  it("returns not_configured with only internal sources when no model is set", async () => {
    const r = await answerChat({ turns, uiLocale: "th" }, { model: null, search: null, retrieve: () => docs });
    expect(r.status).toBe("not_configured");
    expect(r.webSearched).toBe(false);
    expect(r.sources.every((s) => s.kind === "internal")).toBe(true);
    expect(r.sources.map((s) => s.url)).toEqual(docs.map((d) => d.url));
  });

  it("handles provider errors without throwing", async () => {
    const model: ModelProvider = { name: "x", generate: vi.fn().mockRejectedValue(new ProviderError("boom", 500)) };
    const r = await answerChat({ turns, uiLocale: "th" }, { model, search: null, retrieve: () => docs });
    expect(r.status).toBe("provider_error");
  });

  it("does not search the web unless a search provider is configured", async () => {
    const model: ModelProvider = { name: "m", generate: vi.fn().mockResolvedValue("ok [1]") };
    const r = await answerChat({ turns: [{ role: "user", content: "ราคาตั๋ว" }], uiLocale: "th" }, { model, search: null, retrieve: () => [] });
    expect(r.status).toBe("ok");
    expect(r.webSearched).toBe(false);
    if (r.status === "ok") expect(r.answer).toBe("ok"); // [1] removed: no sources exist
  });

  it("cites only real web results and strips invented URLs from the answer", async () => {
    const search: SearchProvider = {
      name: "s",
      search: vi.fn().mockResolvedValue([{ title: "Official", url: "https://www.tourismthailand.org/x", snippet: "info" }]),
    };
    const model: ModelProvider = {
      name: "m",
      generate: vi.fn().mockResolvedValue("ดู [3] และ https://www.tourismthailand.org/x แต่ไม่ใช่ https://made-up.example/ [9]"),
    };
    const r = await answerChat({ turns: [{ role: "user", content: "ค่าเข้าดอยอินทนนท์เท่าไร" }], uiLocale: "th" }, { model, search, retrieve: () => docs });
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.webSearched).toBe(true);
    expect(r.sources).toHaveLength(3);
    expect(r.sources[2]).toMatchObject({ n: 3, kind: "web", url: "https://www.tourismthailand.org/x" });
    expect(r.answer).toContain("[3]");
    expect(r.answer).toContain("https://www.tourismthailand.org/x");
    expect(r.answer).not.toContain("made-up.example");
    expect(r.answer).not.toContain("[9]");
    // the model only receives the retrieved material
    const prompt = (model.generate as ReturnType<typeof vi.fn>).mock.calls[0][1].at(-1).content as string;
    expect(prompt).toContain("SOURCES:");
    expect(prompt).toContain("[1] (Yoyo Travel database) Doi Inthanon");
  });

  it("answers in English when asked in English", async () => {
    const model: ModelProvider = { name: "m", generate: vi.fn().mockResolvedValue("Hello") };
    const r = await answerChat({ turns: [{ role: "user", content: "Best beaches in Krabi?" }], uiLocale: "th" }, { model, search: null, retrieve: () => docs });
    expect(r.lang).toBe("en");
    const system = (model.generate as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(system).toContain("Always answer in English");
  });
});

describe("provider configuration", () => {
  it("is disabled without keys and never throws", () => {
    expect(getModelProvider({})).toBeNull();
    expect(getSearchProvider({})).toBeNull();
    expect(getModelProvider({ GEMINI_API_KEY: "k" })?.name).toContain("Gemini");
    expect(getModelProvider({ OPENAI_API_KEY: "k" })?.name).toContain("OpenAI");
    expect(getModelProvider({ GEMINI_API_KEY: "k", OPENAI_API_KEY: "k", AI_PROVIDER: "openai" })?.name).toContain("OpenAI");
    expect(getSearchProvider({ BRAVE_SEARCH_API_KEY: "k" })?.name).toBe("Brave Search");
  });
});

describe("internal retrieval", () => {
  it("finds real places for a province mentioned in Thai", () => {
    const r = retrieveInternal("มีวัดอะไรน่าไปในเชียงใหม่");
    expect(r.length).toBeGreaterThan(1);
    expect(r[0].url).toBe("/thailand/chiang-mai");
    expect(r.slice(1).every((d) => d.url.startsWith("/thailand/chiang-mai/"))).toBe(true);
  });
  it("uses page context when no province is named", () => {
    const r = retrieveInternal("มีน้ำตกไหม", { provinceSlug: "kanchanaburi" });
    expect(r.some((d) => d.url.startsWith("/thailand/kanchanaburi/"))).toBe(true);
  });
});

describe("rateLimit", () => {
  it("blocks after the limit within the window", () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 1000, 1000 + i).ok).toBe(true);
    const blocked = rateLimit(key, 3, 1000, 1500);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimit(key, 3, 1000, 2500).ok).toBe(true);
  });
});
