import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChatPanel } from "@/components/chat/ChatPanel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("title") };
}

export default async function ChatPage() {
  const t = await getTranslations("chat");
  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="mb-4 text-3xl font-bold">{t("title")}</h1>
      <div className="card overflow-hidden bg-cream">
        <ChatPanel fullPage />
      </div>
    </div>
  );
}
