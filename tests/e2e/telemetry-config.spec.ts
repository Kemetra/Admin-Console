import type { Request } from "@playwright/test";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-673 against the BUILT SPA (mocked Backend-Core, C-5): the Console reads
 * `GET /api/v1/console/telemetry/config` once after the first render.
 *  - 204: no Sentry SDK, so an uncaught error sends nothing anywhere.
 *  - 200: the only telemetry egress is `POST /api/v1/console/telemetry/envelope`
 *    (same origin; Caddy CSP `connect-src 'self'`), carrying the placeholder DSN
 *    and the OBS-1 tags. No session, replay or transaction item is sent (D7).
 */
const CONFIG_PATH = "/api/v1/console/telemetry/config";
const ENVELOPE_PATH = "/api/v1/console/telemetry/envelope";
const PLACEHOLDER_DSN = "https://00000000000000000000000000000000@console-telemetry.invalid/1";
const SHA12 = /^[0-9a-f]{12}$/;

interface Egress {
  /** Requests that leave the page's origin. */
  crossOrigin: string[];
  /** Same-origin calls to the telemetry tunnel. */
  envelopes: Request[];
}

async function boot(page: Page, config: { status: 200 | 204 }): Promise<Egress> {
  const egress: Egress = { crossOrigin: [], envelopes: [] };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== "http://localhost:4173") egress.crossOrigin.push(url.origin);
    else if (url.pathname === ENVELOPE_PATH) egress.envelopes.push(request);
  });

  // Signed out everywhere else; registered first so the routes below win.
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 401, json: { error: { code: "unauthorized" } } }),
  );
  await page.route(`**${ENVELOPE_PATH}`, (route) => route.fulfill({ status: 204 }));
  await page.route(`**${CONFIG_PATH}`, (route) =>
    config.status === 204
      ? route.fulfill({ status: 204, headers: { "cache-control": "no-store" } })
      : route.fulfill({
          status: 200,
          headers: { "cache-control": "no-store" },
          json: { tunnel: ENVELOPE_PATH, environment: "staging" },
        }),
  );

  const configCall = page.waitForResponse((r) => new URL(r.url()).pathname === CONFIG_PATH);
  await page.goto("/");
  expect((await configCall).request().method()).toBe("GET");
  await expect(page).toHaveURL(/\/signin/);
  return egress;
}

/** An uncaught error from a task, so it reaches the global error handler. */
async function throwUncaught(page: Page, message: string): Promise<void> {
  await page.evaluate((m) => {
    setTimeout(() => {
      throw new Error(m);
    });
  }, message);
}

test("204 config: an uncaught error sends no telemetry", async ({ page }) => {
  const egress = await boot(page, { status: 204 });
  // The error must really reach the page's global handler...
  const uncaught = page.waitForEvent("pageerror");
  await throwUncaught(page, "rt673-probe-inert");
  expect((await uncaught).message).toBe("rt673-probe-inert");
  // ...and no telemetry request may follow it. With a config, the same probe
  // posts its envelope well inside this window (the 200 test below).
  const leaked = page.waitForRequest(
    (request) =>
      new URL(request.url()).origin !== "http://localhost:4173" ||
      new URL(request.url()).pathname === ENVELOPE_PATH,
    { timeout: 1_500 },
  );
  await expect(leaked).rejects.toThrow(/Timeout/);
  expect(egress.envelopes).toEqual([]);
  expect(egress.crossOrigin).toEqual([]);
});

test("200 config: the only egress is the same-origin envelope POST, OBS-1 tagged", async ({
  page,
}) => {
  const egress = await boot(page, { status: 200 });

  let attempt = 0;
  await expect(async () => {
    attempt += 1;
    await throwUncaught(page, `rt673-probe-enabled-${attempt}`);
    await expect.poll(() => egress.envelopes.length, { timeout: 1_000 }).toBeGreaterThan(0);
  }).toPass({ timeout: 10_000 });

  expect(egress.crossOrigin).toEqual([]);
  for (const request of egress.envelopes) expect(request.method()).toBe("POST");

  const lines = (egress.envelopes[0]?.postData() ?? "").split("\n").filter(Boolean);
  const header = JSON.parse(lines[0] ?? "{}");
  expect(header.dsn).toBe(PLACEHOLDER_DSN);

  const itemTypes = lines
    .slice(1)
    .filter((_: string, index: number) => index % 2 === 0)
    .map((line: string) => JSON.parse(line).type);
  expect(itemTypes).toEqual(["event"]);

  const event = JSON.parse(lines[2] ?? "{}");
  expect(event.exception.values[0].value).toMatch(/^rt673-probe-enabled-\d+$/);
  expect(event.environment).toBe("staging");
  expect(event.tags.service).toBe("admin-console");
  expect(event.tags.env).toBe("staging");
  expect(event.breadcrumbs ?? []).toEqual([]);
  // vite.config.ts builds GITHUB_SHA in, and CI sets it for the build and this
  // run alike, so there the SHA12 is required. A local build may have neither.
  const buildSha = process.env.GITHUB_SHA;
  if (buildSha) {
    expect(event.release).toBe(buildSha.slice(0, 12));
    expect(event.tags.version).toBe(event.release);
  } else if (event.release !== undefined || event.tags.version !== undefined) {
    expect(event.release).toMatch(SHA12);
    expect(event.tags.version).toBe(event.release);
  }
});
