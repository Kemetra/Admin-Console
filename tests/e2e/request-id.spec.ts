import { expect, test } from "./fixtures";

/**
 * RT-633 (OBS-4), Observability contract RT-629 section 2, against the BUILT
 * SPA: every Backend-Core call carries its own lowercase UUID v4 `X-Request-Id`
 * (mocked Backend-Core, C-5). The Console stays inert: no Sentry request leaves
 * the page without a runtime config.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("each Backend-Core call sends a fresh X-Request-Id; no telemetry egress", async ({ page }) => {
  const ids: string[] = [];
  const telemetry: string[] = [];
  page.on("request", (request) => {
    if (/sentry|datadog/i.test(request.url())) telemetry.push(request.url());
  });
  await page.route("**/api/v1/**", (route) => {
    ids.push(route.request().headers()["x-request-id"] ?? "");
    return route.fulfill({ status: 401, json: { error: { code: "unauthorized" } } });
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/signin/);

  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(id).toMatch(UUID_V4);
  expect(new Set(ids).size).toBe(ids.length);
  expect(telemetry).toEqual([]);
});
