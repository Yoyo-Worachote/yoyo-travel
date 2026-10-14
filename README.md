# Yoyo Travel — Explore More. Collect Memories.

เว็บแอปค้นหาที่เที่ยวในประเทศไทยและ “พาสปอร์ตการเดินทาง” ส่วนตัว (Beta: ประเทศไทย 77 จังหวัด)
Next.js 15 + TypeScript + Tailwind CSS 4 · Leaflet + OpenStreetMap · Supabase (Auth/Postgres/RLS) · next-intl (ไทย/อังกฤษ)

## เริ่มใช้งานในเครื่อง

```bash
npm install
npm run dev          # http://localhost:3000  (โหมดสาธิต ไม่ต้องมี API key)
```

Production: `npm run build && npm start` · ตรวจทั้งหมด: `npm run check` · Smoke test (ต้องเปิดเซิร์ฟเวอร์ไว้): `npm run test:smoke`

ต้องการ Node.js ≥ 20.11 — ดูการตั้งค่า Supabase / Google OAuth / AI / Web search / Vercel ใน [docs/SETUP.md](docs/SETUP.md)

## ฟีเจอร์และสถานะ

| ส่วน | สถานะ |
|---|---|
| หน้าแรก: hero + ค้นหา + สุ่ม + แผนที่ + จังหวัด/สถานที่เด่น + ฤดูกาล + ร้านอาหาร/ที่พัก | ✅ ใช้งานได้ |
| แผนที่ 77 จังหวัดจาก polygon จริง (geoBoundaries/OSM, ODbL): hover, คลิกไปหน้าจังหวัด, ค้นหา, กรองภาค, legend, ซูม/รีเซ็ต, สีตามสถานะ, รายการสำรองบนมือถือ, fallback เมื่อโหลดไม่ได้ | ✅ |
| หน้าจังหวัด `/thailand/<slug>` และหน้าสถานที่ `/thailand/<slug>/<place>` พร้อมแหล่งข้อมูล/สัญญาอนุญาต/วันที่ดึงข้อมูล | ✅ |
| สุ่มจังหวัด / สถานที่ / ทริป 1–3 วัน จากข้อมูลจริง พร้อมเหตุผล | ✅ |
| พาสปอร์ต, จังหวัด (เคยไป/อยากไป), บันทึกการไปสถานที่ (วันที่ โน้ตส่วนตัว คะแนน), รายการอยากไป, วางแผนทริป | ✅ โหมดสาธิต (localStorage) · ☁️ Supabase เมื่อมีคีย์ |
| Top 10 พร้อมเกณฑ์/แหล่งที่มา/วันที่ (ไม่สร้างอันดับหรือรีวิวปลอม) | ✅ |
| ค้นหาไทย/อังกฤษ, กรองประเภท/จังหวัด/สถานะ, ใกล้ฉัน (ขออนุญาตตำแหน่ง), โหลดเพิ่ม | ✅ |
| ไทย/อังกฤษทั้งแอป (ไทยเป็นค่าเริ่มต้น จำค่าด้วย cookie) | ✅ |
| แชต AI ทุกหน้า (ข้อมูลภายในก่อน → ค้นเว็บ → ตอบพร้อมแหล่งอ้างอิง, ตัดลิงก์ที่ไม่มีในแหล่งข้อมูล) | ⚙️ ต้องมี `GEMINI_API_KEY` หรือ `OPENAI_API_KEY` (+ `BRAVE_SEARCH_API_KEY` สำหรับค้นเว็บ) — ถ้าไม่มี จะแสดงสถานที่ที่ตรงคำถามจากฐานข้อมูลและแจ้งวิธีตั้งค่า |
| Google Login, ข้อมูลส่วนตัวบน Supabase + RLS, หน้า admin | ⚙️ ต้องตั้งค่า Supabase + Google OAuth |

## ข้อมูล

ข้อมูลทั้งหมดมาจากแหล่งที่อนุญาตและเก็บเป็น JSON ใน `src/data/generated/` (ไม่เรียก API ภายนอกทุกครั้งที่เปิดหน้า):
Wikidata (CC0), Wikimedia Commons (ระบุผู้สร้าง/สัญญาอนุญาตทุกภาพ), Wikipedia (CC BY-SA), OpenStreetMap (ODbL), geoBoundaries (ODbL)
ข้อมูลยังไม่ครบทุกสถานที่ และ **ไม่มีราคา เมนู หรือรีวิว** จนกว่าจะเชื่อมแหล่งข้อมูลที่ตรวจสอบได้ — ดู [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md)

อัปเดตข้อมูล: `npm run sync:provinces`, `npm run sync:places`, `npm run sync:osm`, แล้ว `npm run db:seed-sql`

## โครงสร้าง

```
src/app/                 หน้าเว็บ (App Router) + API: /api/search, /api/random, /api/places, /api/chat, /auth/callback
src/components/          UI (map, place, province, chat, passport, random, trips, admin)
src/lib/                 logic: catalog, random, passport, travel-state, search, seasons, rankings, ai/*, supabase/*
src/data/generated/      ข้อมูลที่ sync แล้ว · public/geo/ ขอบเขตจังหวัด
messages/th.json, en.json ไฟล์แปลภาษา
supabase/migrations/     schema + RLS · supabase/seed.sql (generated)
scripts/sync/            สคริปต์ดึงข้อมูล · scripts/smoke-test.mjs
tests/                   vitest (logic, data, i18n, chat, RLS ด้วย PGlite)
docs/                    SETUP, DATABASE (ER), DATA_SOURCES
```

## ความปลอดภัยและความเป็นส่วนตัว

- คีย์ AI/ค้นหาอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น; ไม่ใช้ Supabase service-role key
- RLS ทุกตารางข้อมูลผู้ใช้ (ทดสอบใน `tests/rls.test.ts`), admin ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ซ้ำ
- ตรวจ input ด้วย zod, rate limit แชต, CSP + security headers, ไม่ใช้ `dangerouslySetInnerHTML`
- ข้อมูลส่วนตัวเป็น private โดยค่าเริ่มต้น; ประวัติแชตไม่ถูกเก็บบนเซิร์ฟเวอร์ — ดูหน้า `/privacy`
