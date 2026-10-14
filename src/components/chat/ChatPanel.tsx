"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useEffect, useRef, useState } from "react";
import { Bot, Database, Globe, Loader2, Send, Trash2 } from "lucide-react";
import type { ChatSource } from "@/lib/ai/types";
import { useChat } from "./ChatContext";

const MAX_CHARS = 1000;
const STORAGE_KEY = "yoyo-travel:chat:v1";

interface Msg {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  status?: "ok" | "not_configured" | "provider_error" | "rate_limited" | "error";
  provider?: string;
  webSearched?: boolean;
}

/** Render model text safely: paragraphs, bullets, **bold**, [n] citations, links only to known sources. */
function RichText({ text, sources }: { text: string; sources: ChatSource[] }) {
  const byUrl = new Map(sources.map((s) => [s.url, s]));
  const renderInline = (line: string, keyBase: string) => {
    const parts: React.ReactNode[] = [];
    const re = /(\*\*[^*]+\*\*)|\[([^\]]+)\]\(([^)\s]+)\)|\[(\d{1,3})\]/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(line))) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      if (m[1]) parts.push(<strong key={`${keyBase}-b${i}`}>{m[1].slice(2, -2)}</strong>);
      else if (m[2]) {
        const src = byUrl.get(m[3]);
        parts.push(
          src ? (
            src.kind === "internal" ? (
              <Link key={`${keyBase}-l${i}`} href={src.url} className="font-medium text-forest-700 underline">
                {m[2]}
              </Link>
            ) : (
              <a key={`${keyBase}-l${i}`} href={src.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-forest-700 underline">
                {m[2]}
              </a>
            )
          ) : (
            m[2]
          ),
        );
      } else if (m[4]) {
        const n = Number(m[4]);
        parts.push(
          <a key={`${keyBase}-c${i}`} href={`#src-${n}`} className="mx-0.5 align-super text-[0.7rem] font-bold text-forest-700">
            [{n}]
          </a>,
        );
      }
      last = re.lastIndex;
      i++;
    }
    if (last < line.length) parts.push(line.slice(last));
    return parts;
  };
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((b, bi) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          return (
            <ul key={bi} className="list-disc space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(l.replace(/^#+\s*/, ""), `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function Sources({ sources, t }: { sources: ChatSource[]; t: ReturnType<typeof useTranslations> }) {
  if (!sources.length) return null;
  const internal = sources.filter((s) => s.kind === "internal");
  const web = sources.filter((s) => s.kind === "web");
  return (
    <div className="mt-3 space-y-2">
      {[
        [internal, t("internalSources"), Database] as const,
        [web, t("webSources"), Globe] as const,
      ].map(([list, title, Icon]) =>
        list.length ? (
          <div key={title}>
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-charcoal-soft">
              <Icon className="h-3 w-3" aria-hidden="true" /> {title}
            </p>
            <ul className="grid gap-1.5">
              {list.map((s) => (
                <li key={s.n} id={`src-${s.n}`} className="rounded-lg border border-sage-200 bg-white px-2.5 py-1.5 text-xs">
                  <span className="mr-1 font-bold text-forest-700">[{s.n}]</span>
                  {s.kind === "internal" ? (
                    <Link href={s.url} className="font-medium hover:underline">
                      {s.title}
                    </Link>
                  ) : (
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium hover:underline">
                      {s.title}
                    </a>
                  )}
                  {s.kind === "web" && <span className="block truncate text-[0.68rem] muted">{new URL(s.url).hostname}</span>}
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </div>
  );
}

export function ChatPanel({ fullPage = false }: { fullPage?: boolean }) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const { ctx, prefill, consumePrefill } = useChat();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      /* ignore */
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    if (q.length > MAX_CHARS) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next
            .filter((m) => m.status === undefined || m.status === "ok" || m.role === "user")
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
          locale,
          context: ctx ? { provinceSlug: ctx.provinceSlug ?? null, placeId: ctx.placeId ?? null } : null,
        }),
      });
      if (res.status === 429) {
        setMessages((m) => [...m, { role: "assistant", content: t("rateLimited"), status: "rate_limited" }]);
        return;
      }
      const data = await res.json().catch(() => null);
      if (!data || !data.status) throw new Error("bad response");
      if (data.status === "ok") {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.answer, sources: data.sources, status: "ok", provider: data.provider, webSearched: data.webSearched },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.status === "not_configured" ? t("notConfigured") : t("error"),
            sources: data.sources ?? [],
            status: data.status,
            webSearched: data.webSearched,
          },
        ]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: t("error"), status: "error" }]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (prefill) {
      send(prefill);
      consumePrefill();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const suggestions = ctx?.suggestions?.length ? ctx.suggestions : [t("s1"), t("s2"), t("s3"), t("s4")];

  return (
    <div className={`flex flex-col ${fullPage ? "h-[min(78vh,760px)]" : "h-full"}`}>
      {ctx?.label && (
        <p className="border-b border-sage-100 bg-forest-50 px-4 py-2 text-xs font-medium text-forest-800">
          {t("contextProvince", { name: ctx.label })}
        </p>
      )}
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-charcoal-soft">{t("suggested")}</p>
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-xl border border-sage-200 bg-white px-3 py-2 text-left text-sm hover:border-forest-300 hover:bg-forest-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-8 rounded-2xl rounded-br-sm bg-forest-700 px-4 py-2.5 text-sm text-white">
              <span className="sr-only">{t("you")}: </span>
              {m.content}
            </div>
          ) : (
            <div key={i} className="mr-4 rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm shadow-[var(--shadow-card)]">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-forest-700">
                <Bot className="h-3.5 w-3.5" aria-hidden="true" /> {t("assistant")}
              </p>
              {m.status === "ok" ? (
                <RichText text={m.content} sources={m.sources ?? []} />
              ) : (
                <p className={m.status === "not_configured" ? "" : "text-clay"}>{m.content}</p>
              )}
              {m.status === "not_configured" && !(m.sources ?? []).length && <p className="mt-2 text-xs muted">{t("noInternal")}</p>}
              <Sources sources={m.sources ?? []} t={t} />
              {(m.status === "ok" || m.status === "not_configured") && (
                <p className="mt-2 flex flex-wrap gap-x-3 text-[0.68rem] muted">
                  <span>{m.webSearched ? t("webSearchOn") : t("webSearchOff")}</span>
                  {m.provider && <span>{t("provider", { provider: m.provider })}</span>}
                </p>
              )}
            </div>
          ),
        )}
        {busy && (
          <p className="flex items-center gap-2 text-sm muted" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("thinking")}
          </p>
        )}
      </div>
      <form
        className="border-t border-sage-100 bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor={fullPage ? "chat-input-page" : "chat-input"} className="sr-only">
            {t("placeholder")}
          </label>
          <textarea
            id={fullPage ? "chat-input-page" : "chat-input"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            maxLength={MAX_CHARS}
            placeholder={t("placeholder")}
            className="input resize-none text-sm"
          />
          <button type="submit" className="btn btn-primary !p-3" disabled={busy || !input.trim()} aria-label={t("send")}>
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[0.68rem] muted">
          <span>{t("disclaimer")}</span>
          <span className="flex items-center gap-2">
            <span aria-live="polite">{input.length}/{MAX_CHARS}</span>
            {messages.length > 0 && (
              <button type="button" onClick={() => setMessages([])} className="inline-flex items-center gap-1 hover:text-clay">
                <Trash2 className="h-3 w-3" aria-hidden="true" /> {t("clear")}
              </button>
            )}
          </span>
        </div>
      </form>
    </div>
  );
}
