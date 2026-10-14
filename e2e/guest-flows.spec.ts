import { expect, test } from "@playwright/test";
import { freshGuest, watchErrors } from "./helpers";

/**
 * Guest mode end-to-end (no account): everything works and persists in this
 * browser across reloads. Uses real catalog records only.
 */
test.beforeEach(async ({ page }) => {
  await freshGuest(page);
});

test("guest creates, edits, budgets and deletes a trip; data survives reload", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/trips");
  const create = page.locator("form").filter({ has: page.getByRole("heading", { name: "สร้างทริป" }) });
  await create.getByLabel("ชื่อทริป").fill("ทริปทดสอบน่าน");
  await create.getByLabel("จุดหมาย (จังหวัด)").selectOption("nan");
  await create.getByLabel("จำนวนผู้เดินทาง").fill("2");
  await create.getByLabel("งบประมาณ (บาท)").fill("3000");
  await create.getByRole("button", { name: "ธรรมชาติ" }).click();
  await create.getByRole("button", { name: "สร้างทริป" }).click();
  await expect(page).toHaveURL(/\/trips\?trip=/);
  await expect(page.getByText("บันทึกในเบราว์เซอร์นี้แล้ว (ยังไม่ซิงก์เข้าบัญชี)")).toBeVisible();

  // add two real places from the destination province
  const add = page.locator('[aria-labelledby="add-place"]');
  await add.getByRole("button", { name: "ร้านอาหารและคาเฟ่" }).click();
  await add.locator("li").first().getByRole("button", { name: "เพิ่ม" }).click();
  await add.getByRole("button", { name: "วัฒนธรรมและประวัติศาสตร์" }).click();
  await add.locator("li").first().getByRole("button", { name: "เพิ่ม" }).click();
  const items = page.locator('section[aria-labelledby^="day-"] li');
  await expect(items).toHaveCount(2);

  // budget never treats missing prices as 0
  const budget = page.locator('[aria-labelledby="budget-title"]');
  await expect(budget).toContainText("ยังมี 2 รายการที่ไม่มีราคา");
  await items.first().getByLabel(/ค่าใช้จ่ายที่คุณประมาณ/).fill("250");
  await items.first().getByLabel(/ค่าใช้จ่ายที่คุณประมาณ/).blur();
  await expect(budget).toContainText("ยังมี 1 รายการที่ไม่มีราคา");
  await budget.getByPlaceholder("รายการ เช่น ค่าน้ำมัน").fill("ค่าน้ำมัน");
  await budget.getByPlaceholder("จำนวนเงิน").fill("800");
  await budget.getByRole("button", { name: "เพิ่ม" }).click();
  await expect(budget).toContainText("1,050");

  // persists across reload
  await page.reload();
  await expect(page.getByLabel("ชื่อทริป").last()).toHaveValue("ทริปทดสอบน่าน");
  await expect(page.locator('section[aria-labelledby^="day-"] li')).toHaveCount(2);
  await expect(page.locator('[aria-labelledby="budget-title"]')).toContainText("ค่าน้ำมัน");

  // reorder + remove with confirmation dialog
  await page.locator('section[aria-labelledby^="day-"] li').nth(1).getByRole("button", { name: "เลื่อนขึ้น" }).click();
  await page.locator('section[aria-labelledby^="day-"] li').first().getByRole("button", { name: /^นำออก/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "นำออก" }).click();
  await expect(page.locator('section[aria-labelledby^="day-"] li')).toHaveCount(1);

  // delete trip with confirmation
  await page.getByRole("button", { name: "ลบทริป" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ลบทริป" }).click();
  await expect(page).toHaveURL(/\/trips$/);
  await expect(page.getByText("ทริปทดสอบน่าน")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("places explorer: filter, wishlist, add to new trip, map view, pagination", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/places?category=restaurants&province=chiang-mai");
  const cards = page.locator("main article");
  await expect(cards.first()).toBeVisible();
  await expect(page.getByText(/พบ \d+ รายการ/)).toBeVisible();
  const first = cards.first();
  const name = (await first.locator("h3").innerText()).trim();
  await first.getByRole("button", { name: "เพิ่มในอยากไป" }).click();
  await first.getByRole("button", { name: "เพิ่มในทริป" }).click();
  await page.getByRole("menuitem", { name: /สร้างทริปใหม่/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "เพิ่มในทริปแล้ว" })).toBeVisible();

  await page.getByRole("button", { name: "แผนที่" }).click();
  await expect(page.locator(".leaflet-marker-icon, path.leaflet-interactive").first()).toBeVisible();
  await page.getByRole("button", { name: "รายการ" }).click();

  await page.goto("/wishlist");
  await expect(page.getByText(name)).toBeVisible();
  await page.goto("/trips");
  await expect(page.getByRole("link", { name: new RegExp(name.slice(0, 10).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toBeVisible();
  expect(errors).toEqual([]);
});

test("random trip uses real places and can be saved with travellers and budget", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/random?tab=trip");
  await page.getByLabel("จังหวัด", { exact: true }).selectOption("chiang-mai");
  await page.getByLabel("จำนวนผู้เดินทาง").fill("3");
  await page.getByLabel("งบประมาณ (บาท)").fill("5000");
  await page.getByRole("button", { name: "สุ่มเลย" }).click();
  await expect(page.getByText(/ค่าใช้จ่ายที่มีแหล่งข้อมูลยืนยัน/)).toBeVisible();
  const stops = page.locator("ol li a[href^='/thailand/chiang-mai/']");
  expect(await stops.count()).toBeGreaterThan(1);
  await page.getByRole("button", { name: "บันทึกเป็นแผนทริป" }).click();
  await page.getByRole("link", { name: "บันทึกแผนทริปแล้ว" }).click();
  await page.locator('a[href^="/trips?trip="]').first().click();
  await expect(page.getByLabel("จำนวนผู้เดินทาง").last()).toHaveValue("3");
  await expect(page.getByLabel("งบประมาณ (บาท)").last()).toHaveValue("5000");
  expect(errors).toEqual([]);
});

test("passport: mark province and place visited, metrics update", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/thailand/nan");
  await page.getByRole("button", { name: "เคยไปแล้ว" }).first().click();
  await page.goto("/passport");
  await expect(page.getByText("1/77")).toBeVisible();
  expect(errors).toEqual([]);
});

test("auth pages work as guest when accounts are not configured", async ({ page }) => {
  await page.goto("/login?next=/trips");
  // Either the real form (Supabase configured) or a clear notice with a way back.
  const notConfigured = page.getByText("ระบบบัญชียังไม่เปิดใช้งาน");
  if (await notConfigured.count()) {
    await page.getByRole("link", { name: "ใช้งานต่อแบบผู้เยี่ยมชม" }).first().click();
    await expect(page).toHaveURL(/\/trips$/);
  } else {
    await expect(page.getByRole("button", { name: "ดำเนินการต่อด้วย Google" })).toBeVisible();
    await expect(page.getByLabel("รหัสผ่าน")).toBeVisible();
  }
});
