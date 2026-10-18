import { web } from "@e2e-dev/web";
import type { E2EConfig } from "e2e";

// The e2e CLI sends anonymous PostHog telemetry by default; keep it off unless a caller opts in.
process.env.E2E_TELEMETRY_DISABLED ??= "1";

// RT-299: tester-army/e2e layer, separate from the Playwright suite
// (playwright.config.ts, tests/e2e/). Run with `pnpm test:e2e:agent`.
//
// Requires Node ^22.22.3 || >=24.8.0 (e2e@0.19 needs module.registerHooks);
// package.json engines.node declares it (pnpm warns on mismatch; not enforced without engine-strict).
//
// Target: APP_URL when set and non-empty (an app already running), otherwise the built SPA
// preview on :4174, which the runner starts and stops. Run `pnpm build` first,
// the same as for `pnpm test:e2e`. Port 4174 stays clear of Playwright's 4173.
// The command runs without a shell, so it calls Vite through node directly
// (`pnpm` is not spawnable that way on Windows).
//
// C-5: no live Data-Pulse-2 / Backend-Core. Tests mock the API with
// `browser.route`.
//
// No `agents` key: the tests use locator steps only, so no model or
// credentials are needed. Add a model here only together with a test that
// uses `agent.*`.
const PREVIEW_URL = "http://localhost:4174";
// An empty APP_URL counts as unset.
const appUrl = process.env.APP_URL || undefined;

export default {
  tests: "tests/e2e-agent/**/*.e2e.ts",
  targets: [
    {
      name: "web",
      engine: web({ browser: "chromium" }),
      app:
        appUrl === undefined
          ? {
              url: PREVIEW_URL,
              command: {
                executable: process.execPath,
                args: [
                  "node_modules/vite/bin/vite.js",
                  "preview",
                  "--port",
                  "4174",
                  "--strictPort",
                ],
                log: ".e2e/logs/preview.log",
              },
            }
          : { url: appUrl },
    },
  ],
} satisfies E2EConfig;
