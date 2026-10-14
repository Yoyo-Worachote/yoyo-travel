import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import attribution from "@/data/generated/boundaries-attribution.json";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title") };
}

const TH = {
  intro: "Yoyo Travel เก็บข้อมูลส่วนบุคคลให้น้อยที่สุด และตั้งค่าให้เป็นส่วนตัวโดยค่าเริ่มต้น",
  items: [
    ["บัญชีผู้ใช้", "เมื่อเข้าสู่ระบบด้วย Google (ผ่าน Supabase Auth) เราได้รับชื่อ อีเมล และรูปโปรไฟล์ เพื่อแสดงโปรไฟล์ของคุณเท่านั้น"],
    ["บันทึกการเดินทาง", "จังหวัด/สถานที่ที่เคยไป บันทึกส่วนตัว คะแนน รายการอยากไป และแผนทริป จัดเก็บในฐานข้อมูลที่มี Row Level Security — เฉพาะเจ้าของบัญชีเท่านั้นที่อ่านหรือแก้ไขได้ ไม่มีการเผยแพร่โดยไม่ได้รับอนุญาต"],
    ["โหมดสาธิต", "หากยังไม่ได้ตั้งค่าระบบเข้าสู่ระบบ ข้อมูลจะถูกเก็บใน localStorage ของเบราว์เซอร์คุณเท่านั้น และไม่ถูกส่งไปที่เซิร์ฟเวอร์"],
    ["แชต AI", "ข้อความที่คุณถามจะถูกส่งไปยังผู้ให้บริการ AI ที่ผู้ดูแลตั้งค่าไว้ (เช่น Google Gemini หรือ OpenAI) และบริการค้นหาเว็บ (เช่น Brave Search) เพื่อสร้างคำตอบ เราไม่บันทึกประวัติแชตบนเซิร์ฟเวอร์ ประวัติแชตเก็บไว้ในแท็บเบราว์เซอร์ของคุณเท่านั้น โปรดอย่าใส่ข้อมูลส่วนตัวที่อ่อนไหวในแชต"],
    ["ตำแหน่ง", "ฟีเจอร์ “ใกล้ฉัน” จะขออนุญาตก่อนเสมอ และไม่บันทึกตำแหน่งของคุณ"],
    ["แผนที่", "ภาพแผนที่พื้นหลังโหลดจาก OpenStreetMap tile server ซึ่งจะเห็นที่อยู่ IP ของคุณตามปกติของการโหลดภาพ"],
  ],
};
const EN = {
  intro: "Yoyo Travel keeps personal data to a minimum and private by default.",
  items: [
    ["Account", "When you sign in with Google (via Supabase Auth) we receive your name, email and profile picture to show your profile only."],
    ["Travel records", "Visited provinces/places, private notes, ratings, wishlist and trips are stored in a database protected by Row Level Security — only the account owner can read or change them. Nothing is published without your permission."],
    ["Demo mode", "If sign-in is not configured, data stays in your browser's localStorage and is never sent to our server."],
    ["AI chat", "Your questions are sent to the AI provider configured by the site owner (e.g. Google Gemini or OpenAI) and a web search provider (e.g. Brave Search) to produce answers. We do not store chat history on the server; it stays in your browser tab. Please do not share sensitive personal data in chat."],
    ["Location", "“Near me” always asks for permission first and your location is not stored."],
    ["Maps", "Map tiles load from the OpenStreetMap tile server, which sees your IP address as part of normal image loading."],
  ],
};

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  const locale = await getLocale();
  const en = locale === "en";
  const c = en ? EN : TH;
  const configured = isSupabaseConfigured();
  return (
    <div className="container-page max-w-3xl space-y-10 py-10">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <section className="space-y-4">
        <p>{c.intro}</p>
        <dl className="space-y-4">
          {c.items.map(([k, v]) => (
            <div key={k} className="card p-5">
              <dt className="font-semibold">{k}</dt>
              <dd className="mt-1 text-sm">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="sources" className="space-y-3">
        <h2 id="sources" className="section-title">
          {en ? "Data sources & licenses" : "แหล่งข้อมูลและสัญญาอนุญาต"}
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>
            <a className="underline" href="https://www.wikidata.org/" target="_blank" rel="noopener noreferrer">
              Wikidata
            </a>{" "}
            — CC0 1.0 ({en ? "province and attraction records" : "ข้อมูลจังหวัดและสถานที่ท่องเที่ยว"})
          </li>
          <li>
            <a className="underline" href="https://commons.wikimedia.org/" target="_blank" rel="noopener noreferrer">
              Wikimedia Commons
            </a>{" "}
            — {en ? "photos; license and author shown with each photo" : "ภาพถ่าย แสดงสัญญาอนุญาตและผู้สร้างกำกับทุกภาพ"}
          </li>
          <li>
            <a className="underline" href="https://www.wikipedia.org/" target="_blank" rel="noopener noreferrer">
              Wikipedia
            </a>{" "}
            — CC BY-SA 4.0 ({en ? "province summaries, linked to the article" : "สรุปข้อมูลจังหวัด พร้อมลิงก์บทความ"})
          </li>
          <li>
            <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              © OpenStreetMap contributors
            </a>{" "}
            — ODbL 1.0 ({en ? "restaurants, cafes, accommodation, map tiles" : "ร้านอาหาร คาเฟ่ ที่พัก และภาพแผนที่"})
          </li>
          <li>
            <a className="underline" href="https://www.geoboundaries.org/" target="_blank" rel="noopener noreferrer">
              geoBoundaries
            </a>{" "}
            — {attribution.dataset}, {attribution.source}, {attribution.license}
          </li>
          <li>
            <a className="underline" href="https://www.tmd.go.th/" target="_blank" rel="noopener noreferrer">
              {en ? "Thai Meteorological Department" : "กรมอุตุนิยมวิทยา"}
            </a>{" "}
            — {en ? "general seasonal guidance" : "คำแนะนำทั่วไปตามฤดูกาล"}
          </li>
        </ul>
        <p className="text-sm muted">
          {en
            ? "Coverage is not exhaustive. We do not display ratings, reviews, menus or prices unless a source provides them, and we label estimates clearly."
            : "ข้อมูลยังไม่ครอบคลุมทุกสถานที่ เราไม่แสดงคะแนน รีวิว เมนู หรือราคา หากไม่มีแหล่งข้อมูลรองรับ และระบุชัดเจนเมื่อเป็นค่าประมาณ"}
        </p>
      </section>

      <section id="setup" aria-labelledby="setup-h" className="space-y-3">
        <h2 id="setup-h" className="section-title">
          {en ? "Setup status" : "สถานะการตั้งค่า"}
        </h2>
        <p className="text-sm">
          {configured
            ? en
              ? "Supabase is configured: sign-in and cloud records are enabled."
              : "ตั้งค่า Supabase แล้ว: เปิดใช้การเข้าสู่ระบบและการบันทึกข้อมูลบนคลาวด์"
            : en
              ? "Supabase is not configured, so the app runs in demo mode. The site owner should follow docs/SETUP.md (Supabase project, Google OAuth, environment variables)."
              : "ยังไม่ได้ตั้งค่า Supabase แอปจึงทำงานในโหมดสาธิต ผู้ดูแลระบบสามารถตั้งค่าตาม docs/SETUP.md (โปรเจกต์ Supabase, Google OAuth และตัวแปรสภาพแวดล้อม)"}
        </p>
      </section>
    </div>
  );
}
