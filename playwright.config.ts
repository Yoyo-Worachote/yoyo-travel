import { defineConfig, devices } from "@playwright/test";

/**
 * Browser smoke/E2E tests against a production build.
 *   npm run build && npm run test:e2e
 * Set E2E_BASE_URL to test a deployment instead of a local server.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
// Behind a corporate proxy, route external requests (map tiles, Wikimedia images) through it.
const proxyServer = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    locale: "th-TH",
    trace: "retain-on-failure",
    proxy: proxyServer ? { server: proxyServer, bypass: "localhost,127.0.0.1" } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 860 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm start",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
