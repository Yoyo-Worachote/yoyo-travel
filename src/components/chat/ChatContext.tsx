"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface PageChatContext {
  provinceSlug?: string | null;
  placeId?: string | null;
  label?: string | null;
  suggestions?: string[];
}

type Store = { ctx: PageChatContext | null; set: (c: PageChatContext | null) => void; open: boolean; setOpen: (v: boolean) => void; prefill: string | null; ask: (q: string) => void; consumePrefill: () => void };

const ChatCtx = createContext<Store | null>(null);

export function ChatContextProvider({ children }: { children: React.ReactNode }) {
  const [ctx, set] = useState<PageChatContext | null>(null);
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<string | null>(null);
  return (
    <ChatCtx.Provider
      value={{
        ctx,
        set,
        open,
        setOpen,
        prefill,
        ask: (q) => {
          setPrefill(q);
          setOpen(true);
        },
        consumePrefill: () => setPrefill(null),
      }}
    >
      {children}
    </ChatCtx.Provider>
  );
}

export function useChat() {
  const c = useContext(ChatCtx);
  if (!c) throw new Error("useChat must be used within ChatContextProvider");
  return c;
}

/** Drop into a page to give the floating chat page context (province/place). */
export function SetChatContext(props: PageChatContext) {
  const { set } = useChat();
  const key = `${props.provinceSlug ?? ""}|${props.placeId ?? ""}|${props.label ?? ""}|${(props.suggestions ?? []).join("|")}`;
  useEffect(() => {
    set(props);
    return () => set(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
