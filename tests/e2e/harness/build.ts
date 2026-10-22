import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import react from "@vitejs/plugin-react";
import { build } from "vite";

/**
 * Bundles a harness page (a component mounted on its own) with the app's own
 * Vite pipeline and serves it from the preview origin, so an e2e check can
 * cover a shared component before any screen adopts it. Nothing here touches
 * `dist/`, the app build or the router: the output lives in a temp directory
 * and is answered by Playwright's route handler under `/__harness/`.
 */

export const HARNESS_BASE = "/__harness/";

const SRC = fileURLToPath(new URL("../../../src", import.meta.url));
const HARNESS_ROOT = fileURLToPath(new URL(".", import.meta.url));

const CONTENT_TYPE: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

export interface BuiltHarness {
  /** Answer `/__harness/*` requests of `page` from the built output. */
  serve: (page: Page) => Promise<void>;
  dispose: () => Promise<void>;
}

/** Build `entryHtml` (a file in this folder) once; reuse the result across tests. */
export async function buildHarness(entryHtml: string): Promise<BuiltHarness> {
  const outDir = await mkdtemp(join(tmpdir(), "rt-harness-"));
  const served = join(outDir, "out");
  await build({
    configFile: false,
    root: HARNESS_ROOT,
    base: HARNESS_BASE,
    cacheDir: join(outDir, ".vite"),
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": SRC } },
    build: {
      target: "es2022",
      outDir: served,
      emptyOutDir: true,
      rollupOptions: { input: join(HARNESS_ROOT, entryHtml) },
    },
  });
  return {
    serve: async (page) => {
      await page.route(`**${HARNESS_BASE}**`, async (route) => {
        const { pathname } = new URL(route.request().url());
        const file = normalize(
          join(served, decodeURIComponent(pathname.slice(HARNESS_BASE.length))),
        );
        if (!file.startsWith(served + sep)) return route.fulfill({ status: 403 });
        try {
          const body = await readFile(file);
          await route.fulfill({
            status: 200,
            body,
            contentType: CONTENT_TYPE[extname(file)] ?? "application/octet-stream",
          });
        } catch {
          await route.fulfill({ status: 404 });
        }
      });
    },
    dispose: () => rm(outDir, { recursive: true, force: true }),
  };
}
