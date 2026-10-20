import { defineConfig } from "@playwright/test";
import type { LocaleFixtures } from "../tests/e2e/fixtures";

// RT-750: BrowserStack cloud smoke of the existing E2E spec (workflow: .github/workflows/cross-browser-cloud.yml).
// The required Chromium CI uses ../playwright.config.ts and is untouched by this file.
//
// Locale: browserstack-node-sdk replaces project names and drops PROJECT-level `use`, so the
// locale is set at TOP level from E2E_LOCALE. One SDK run per locale; per-locale build names
// (see browserstack.template.yml) keep `ar` and `en` in separate TRA builds. The browser's own
// locale is set against the app locale on purpose (UX-12), exactly as in ../playwright.config.ts.
const BROWSER_LOCALE = { ar: "en-US", en: "ar-EG" } as const;

const locale = process.env.E2E_LOCALE;
if (locale !== "ar" && locale !== "en") {
  throw new Error(`E2E_LOCALE must be "ar" or "en" (got ${JSON.stringify(locale)})`);
}

export default defineConfig<Pick<LocaleFixtures, "appLocale">>({
  testDir: "../tests/e2e",
  testMatch: ["locale-switch.spec.ts"],
  fullyParallel: false,
  forbidOnly: true,
  // Sessions are bounded HERE. One worker = one BrowserStack session per platform, and every failure
  // restarts the worker (a new session). With retries off, a platform therefore opens at most
  // `maxFailures` sessions (1 when everything passes): with 2 platforms and 2 locales that is 4 sessions
  // expected and 8 at the very most per run. Raising either number raises the cost bound.
  workers: 1,
  retries: 0,
  maxFailures: 2,
  // Remote browsers are slower than local Chromium (RT-746). Cloud runs only: the required CI keeps
  // Playwright's default.
  timeout: 120_000,
  // JSON feeds the run summary and the "no silent green" checks in run-cloud-locale.ps1.
  reporter: [["list"], ["json", { outputFile: `reports/${locale}/results.json` }]],
  outputDir: `reports/${locale}/test-output`,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4173",
    appLocale: locale,
    locale: BROWSER_LOCALE[locale],
  },
  projects: [{ name: "cloud" }],
});
