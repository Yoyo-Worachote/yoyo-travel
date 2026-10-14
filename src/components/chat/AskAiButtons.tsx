"use client";

import { MessageCircle } from "lucide-react";
import { useChat } from "./ChatContext";

export function AskAiButtons({ title, questions }: { title: string; questions: string[] }) {
  const { ask } = useChat();
  return (
    <section className="rounded-[var(--radius-card)] bg-sage-100/70 p-5" aria-label={title}>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <MessageCircle className="h-5 w-5 text-clay" aria-hidden="true" /> {title}
      </h2>
      <div className="flex flex-wrap gap-2">
        {questions.map((q) => (
          <button key={q} type="button" className="chip" onClick={() => ask(q)}>
            {q}
          </button>
        ))}
      </div>
    </section>
  );
}
