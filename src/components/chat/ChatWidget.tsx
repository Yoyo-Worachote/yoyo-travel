"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import { ChatPanel } from "./ChatPanel";
import { useChat } from "./ChatContext";

export function ChatWidget() {
  const t = useTranslations("chat");
  const { open, setOpen } = useChat();
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (pathname === "/chat") return null;

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={t("title")}
          className="fixed inset-x-2 bottom-20 z-50 flex h-[min(75vh,640px)] flex-col overflow-hidden rounded-3xl border border-forest-900/10 bg-cream shadow-[var(--shadow-lift)] sm:inset-x-auto sm:right-5 sm:w-[400px]"
        >
          <div className="flex items-center justify-between bg-forest-800 px-4 py-3 text-white">
            <p className="font-semibold">{t("title")}</p>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="rounded-full p-1 hover:bg-white/15">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <ChatPanel />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? t("close") : t("open")}
        className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-clay text-white shadow-[var(--shadow-lift)] transition hover:scale-105"
      >
        {open ? <X className="h-6 w-6" aria-hidden="true" /> : <MessageCircle className="h-6 w-6" aria-hidden="true" />}
      </button>
    </>
  );
}
