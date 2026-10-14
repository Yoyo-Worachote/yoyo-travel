export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSource {
  n: number;
  kind: "internal" | "web";
  title: string;
  url: string;
  snippet?: string;
}

export interface ModelProvider {
  name: string;
  generate(system: string, turns: ChatTurn[]): Promise<string>;
}

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchProvider {
  name: string;
  search(query: string, opts?: { count?: number; lang?: "th" | "en" }): Promise<WebResult[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}
