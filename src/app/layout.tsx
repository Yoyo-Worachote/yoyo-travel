import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Inter, Noto_Sans_Thai } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { ChatContextProvider } from "@/components/chat/ChatContext";
import { TravelStoreProvider } from "@/components/providers/TravelStoreProvider";
import { StoreErrorToast } from "@/components/providers/StoreErrorToast";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import "./globals.css";

const thai = Noto_Sans_Thai({ subsets: ["thai", "latin"], variable: "--font-thai", display: "swap" });
const latin = Inter({ subsets: ["latin"], variable: "--font-latin", display: "swap" });
const displayThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-thai",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  const locale = await getLocale();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: t("title"), template: "%s · Yoyo Travel" },
    description: t("description"),
    applicationName: "Yoyo Travel",
    openGraph: {
      title: t("title"),
      description: t("description"),
      siteName: "Yoyo Travel",
      locale: locale === "en" ? "en_US" : "th_TH",
      type: "website",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#234f39",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations("nav");
  return (
    <html lang={locale} className={`${thai.variable} ${latin.variable} ${displayThai.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <TravelStoreProvider>
            <ChatContextProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] btn btn-primary"
            >
              {t("skipToContent")}
            </a>
            <Header />
            <DemoBanner supabaseConfigured={isSupabaseConfigured()} />
            <main id="main" className="flex-1">
              {children}
            </main>
            <Footer />
            <ChatWidget />
            <StoreErrorToast />
            </ChatContextProvider>
          </TravelStoreProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
