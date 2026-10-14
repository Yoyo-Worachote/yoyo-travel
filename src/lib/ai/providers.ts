import "server-only";
import { ProviderError, type ChatTurn, type ModelProvider, type SearchProvider } from "./types";

const TIMEOUT_MS = 30_000;

/** Google Gemini via REST (key sent in a header, server-side only). */
function gemini(apiKey: string, model: string): ModelProvider {
  return {
    name: `Gemini (${model})`,
    async generate(system, turns) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
            generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
      if (!res.ok) throw new ProviderError(`gemini ${res.status}`, res.status);
      const json = await res.json();
      const text: string =
        json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
      if (!text) throw new ProviderError("gemini empty response");
      return text;
    },
  };
}

/** OpenAI-compatible Chat Completions (OpenAI or a compatible gateway). */
function openai(apiKey: string, model: string, baseUrl: string): ModelProvider {
  return {
    name: `OpenAI (${model})`,
    async generate(system, turns: ChatTurn[]) {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 1200,
          messages: [{ role: "system", content: system }, ...turns],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new ProviderError(`openai ${res.status}`, res.status);
      const json = await res.json();
      const text: string = json.choices?.[0]?.message?.content ?? "";
      if (!text) throw new ProviderError("openai empty response");
      return text;
    },
  };
}

type Env = Record<string, string | undefined>;

export function getModelProvider(env: Env = process.env): ModelProvider | null {
  const preferred = (env.AI_PROVIDER ?? "").toLowerCase();
  if (env.GEMINI_API_KEY && preferred !== "openai") {
    return gemini(env.GEMINI_API_KEY, env.GEMINI_MODEL || "gemini-2.5-flash");
  }
  if (env.OPENAI_API_KEY && preferred !== "gemini") {
    return openai(env.OPENAI_API_KEY, env.OPENAI_MODEL || "gpt-4o-mini", env.OPENAI_BASE_URL || "https://api.openai.com/v1");
  }
  return null;
}

/** Brave Search API (web results). */
function brave(apiKey: string): SearchProvider {
  return {
    name: "Brave Search",
    async search(query, opts = {}) {
      const params = new URLSearchParams({
        q: query,
        count: String(opts.count ?? 5),
        country: "TH",
        search_lang: opts.lang === "en" ? "en" : "th",
        safesearch: "moderate",
      });
      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new ProviderError(`brave ${res.status}`, res.status);
      const json = await res.json();
      return ((json.web?.results ?? []) as Array<{ title?: string; url?: string; description?: string }>)
        .filter((r) => r.url && /^https?:\/\//.test(r.url))
        .slice(0, opts.count ?? 5)
        .map((r) => ({
          title: (r.title ?? r.url!).replace(/<[^>]+>/g, ""),
          url: r.url!,
          snippet: (r.description ?? "").replace(/<[^>]+>/g, "").slice(0, 400),
        }));
    },
  };
}

export function getSearchProvider(env: Env = process.env): SearchProvider | null {
  return env.BRAVE_SEARCH_API_KEY ? brave(env.BRAVE_SEARCH_API_KEY) : null;
}
