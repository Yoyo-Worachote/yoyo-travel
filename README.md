# Yoyo Travel — Explore More. Collect Memories.

เว็บแอปค้นหาที่เที่ยวในประเทศไทยและ “พาสปอร์ตการเดินทาง” ส่วนตัว (Beta: ประเทศไทย 77 จังหวัด)
Next.js 15 + TypeScript + Tailwind CSS 4 · Leaflet + OpenStreetMap · Supabase (Auth/Postgres/RLS) · next-intl (ไทย/อังกฤษ)

## เริ่มใช้งานในเครื่อง

```bash
npm install
npm run dev          # http://localhost:3000  (โหมดสาธิต ไม่ต้องมี API key)
```

Production: `npm run build && npm start` · ตรวจทั้งหมด: `npm run check` · Smoke test (ต้องเปิดเซิร์ฟเวอร์ไว้): `npm run test:smoke` · ทดสอบผ่านเบราว์เซอร์ (Playwright, desktop + mobile): `npm run test:e2e`

ต้องการ Node.js ≥ 20.11 — ดูการตั้งค่า Supabase / Google OAuth / AI / Web search / Vercel ใน [docs/SETUP.md](docs/SETUP.md)

## ฟีเจอร์และสถานะ

| ส่วน | สถานะ |
|---|---|
| หน้าแรก, แผนที่ 77 จังหวัด (polygon จริง), หน้าจังหวัด/สถานที่, Top 10, สุ่มจังหวัด/สถานที่ | ✅ ใช้งานได้ |
| ค้นหาสถานที่ `/places`: 10 หมวด, กรองจังหวัด/ราคา/สิ่งอำนวยความสะดวก, เรียงลำดับ, รายการ/แผนที่, แบ่งหน้า, อยากไป, เพิ่มในทริป, นำทาง | ✅ |
| ราคา: แยก “ราคาตามแหล่งข้อมูล / ช่วงราคา / ไม่มีข้อมูลราคา” พร้อมแหล่งที่มาและวันที่ (ไม่มีราคาเดา) | ✅ |
| วางแผนทริป: ผู้เดินทาง งบ สไตล์ การเดินทาง สถานะ, จัดตามวัน เวลา โน้ต, เรียงลำดับ, แผนที่และลิงก์นำทางรายวัน, บันทึกอัตโนมัติพร้อมสถานะ | ✅ |
| คำนวณงบ: แยกหมวด ค่าประมาณ vs จ่ายจริง ต่อคน คงเหลือ รายการที่ไม่มีราคา (ไม่นับเป็น 0) และที่มาของราคา | ✅ |
| สุ่มทริป 1–3 วันจากข้อมูลจริง พร้อมจำนวนคน งบ ตัวกรองเวลาเปิด-ปิด และที่พัก | ✅ |
| ใช้งานแบบผู้เยี่ยมชม (ไม่ต้องสมัคร) เก็บในเบราว์เซอร์ + แจ้งสถานะว่ายังไม่ซิงก์ | ✅ |
| สมัคร/เข้าสู่ระบบด้วยชื่อผู้ใช้ + รหัสผ่าน, ลืมรหัสผ่าน, Google, หน้าโปรไฟล์, ลบบัญชี, นำเข้าข้อมูลผู้เยี่ยมชม | ⚙️ โค้ด + migration + ทดสอบ (mock/PGlite) เสร็จ — ต้องตั้งค่า Supabase จริงจึงจะใช้งานได้ |
| คะแนนรีวิว/ช่วงราคาจาก Google Places | ⚙️ adapter พร้อม — ต้องมี `GOOGLE_PLACES_API_KEY` (มีค่าใช้จ่าย) |
| แชต AI | ⚙️ ต้องมี `GEMINI_API_KEY` หรือ `OPENAI_API_KEY` (+ `BRAVE_SEARCH_API_KEY`) |

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
