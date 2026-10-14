import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, watchErrors } from "./helpers";

/** Every main route renders its real content (not just HTTP 200), without errors or overflow. */
const ROUTES: Array<{ path: string; heading: RegExp; check?: (page: import("@playwright/test").Page) => Promise<void> }> = [
  { path: "/", heading: /เที่ยวให้มากขึ้น/, check: async (p) => expect(p.locator("path.leaflet-interactive")).toHaveCount(77) },
  { path: "/explore", heading: /สำรวจประเทศไทย/, check: async (p) => expect(p.locator("path.leaflet-interactive")).toHaveCount(77) },
  { path: "/places", heading: /ค้นหาสถานที่/, check: async (p) => expect(p.locator("main article").first()).toBeVisible() },
  { path: "/thailand/chiang-mai", heading: /^เชียงใหม่$/, check: async (p) => expect(p.getByRole("heading", { name: /สถานที่ในเชียงใหม่/ })).toBeVisible() },
  { path: "/top", heading: /Top 10/ },
  { path: "/random", heading: /สุ่มที่เที่ยว/ },
  { path: "/trips", heading: /วางแผนทริป/ },
  { path: "/wishlist", heading: /รายการอยากไป/ },
  { path: "/passport", heading: /พาสปอร์ตการเดินทางของฉัน/ },
  { path: "/chat", heading: /ผู้ช่วยวางแผนเที่ยว AI/ },
  { path: "/login", heading: /เข้าสู่ระบบ/ },
  { path: "/register", heading: /สร้างบัญชี/ },
  { path: "/forgot-password", heading: /ลืมรหัสผ่าน/ },
  { path: "/account", heading: /บัญชีของฉัน/ },
  { path: "/privacy", heading: /ความเป็นส่วนตัว/ },
];

for (const r of ROUTES) {
  test(`route ${r.path}`, async ({ page }) => {
    const errors = watchErrors(page);
    const res = await page.goto(r.path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1").first()).toHaveText(r.heading);
    if (r.check) await r.check(page);
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });
}

test("place detail shows source, price status and rating status honestly", async ({ page }) => {
  const errors = watchErrors(page);
  const api = await (await page.request.get("/api/search?q=Doi%20Inthanon&limit=1")).json();
  const p = api.places[0];
  await page.goto(`/thailand/${p.provinceSlug}/${p.slug}`);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.getByText("ไม่มีข้อมูลคะแนนรีวิวจากผู้ให้บริการที่ได้รับอนุญาต", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Wikidata contributors" })).toHaveAttribute("href", /wikidata\.org\/wiki\/Q/);
  await expect(page.getByText(/ยังไม่พบข้อมูลราคาที่เชื่อถือได้|ราคาตามแหล่งข้อมูล|ฟรี/).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("unknown routes return a real 404 page", async ({ page }) => {
  for (const path of ["/thailand/atlantis", "/thailand/chiang-mai/not-a-place", "/no-such-page"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "ไม่พบหน้าที่คุณต้องการ" })).toBeVisible();
  }
});

test("/search redirects to the places explorer keeping the query", async ({ page }) => {
  await page.goto("/search?q=cafe");
  await expect(page).toHaveURL(/\/places\?q=cafe/);
});

test("language switch to English keeps working across pages", async ({ page }) => {
  await page.goto("/places");
  await page.getByRole("button", { name: "EN" }).first().click();
  await expect(page.locator("h1")).toHaveText("Find places");
  await page.goto("/trips");
  await expect(page.locator("h1")).toHaveText("Trip Planner");
  await page.getByRole("button", { name: "TH" }).first().click();
  await expect(page.locator("h1")).toHaveText("วางแผนทริป");
});
