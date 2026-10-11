import { defineConfig, devices } from "@playwright/test";
import type { LocaleFixtures } from "./tests/e2e/fixtures";

// D-4: Playwright E2E. Runs against the built SPA preview server.
// C-5: no live Data-Pulse-2 — E2E drives the SPA with a mocked client.
// RT-399: every journey runs once per locale. The browser's own locale is set
// against the app locale (en-US for Arabic, ar-EG for English) to prove the
// device never picks the language (UX-12 "product locale beats device accident").
export default defineConfig<Pick<LocaleFixtures, "appLocale">>({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium-ar",
      use: { ...devices["Desktop Chrome"], appLocale: "ar", locale: "en-US" },
    },
    {
      name: "chromium-en",
      use: { ...devices["Desktop Chrome"], appLocale: "en", locale: "ar-EG" },
    },
  ],
  // Boot the production preview so E2E proves the built SPA serves (A-12 smoke).
  webServer: {
    command: "pnpm preview --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
