import { expect, type Page } from "@playwright/test";

/** Collect uncaught page errors, console errors and failed same-origin requests. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // expected: deliberate 404 checks and third-party tile hiccups
    if (/404 \(Not Found\)|tile\.openstreetmap|upload\.wikimedia|thumb\.wikimedia/.test(text)) return;
    errors.push(`console: ${text}`);
  });
  page.on("response", (r) => {
    const url = new URL(r.url());
    if (url.origin === new URL(page.url() || "http://localhost").origin && r.status() >= 500) errors.push(`HTTP ${r.status()} ${url.pathname}`);
  });
  return errors;
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(1);
}

/** Fresh guest: clear this origin's storage before the page scripts run. */
export async function freshGuest(page: Page) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("e2e-cleared")) {
      localStorage.clear();
      sessionStorage.setItem("e2e-cleared", "1");
    }
  });
}
