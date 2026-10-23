import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";
import { type BuiltHarness, HARNESS_BASE, buildHarness } from "./harness/build";

/**
 * RT-819 (VIZ-1): the shared KPI claim on a harness page, because no screen
 * adopts it yet (VIZ-2 / VIZ-3 are the first; move these checks onto their
 * screens when they land). The unit tests pin every state; this proves them in
 * a real browser: the keyboard walk (definitions and retry, nothing else), a
 * retry by keyboard, no motion under reduced motion, and no WCAG 2.1 A/AA axe
 * violation in light, dark and forced colours. Runs once per locale (RT-399);
 * copy comes from the catalog (`t`).
 */

const PAGE = `${HARNESS_BASE}metric-claim.html`;

let harness: BuiltHarness;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  harness = await buildHarness("metric-claim.html");
});

test.afterAll(async () => {
  await harness?.dispose();
});

test.beforeEach(async ({ page }) => {
  await harness.serve(page);
  await page.goto(PAGE);
  await expect(page.locator("dl").first()).toBeVisible();
});

async function walk(page: Page, stops: number): Promise<string[]> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const visited: string[] = [];
  for (let i = 0; i < stops; i++) {
    await page.keyboard.press("Tab");
    visited.push(
      await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "<none>"),
    );
  }
  return visited;
}

test("RT-819: Tab visits each figure's definition and the retry, in reading order", async ({
  page,
  t,
}) => {
  const about = (key: Parameters<typeof t>[0]) => t("metrics.claim.about", { label: t(key) });
  expect(await walk(page, 9)).toEqual([
    about("metrics.receivedSales.label"),
    about("metrics.voids.label"),
    t("metrics.claim.retry"),
    about("metrics.returns.label"),
    about("metrics.legacyRefunds.label"),
    about("metrics.syncStatus.label"),
    about("metrics.erpPosting.label"),
    about("metrics.shiftCloses.label"),
    about("metrics.receivedSales.label"),
  ]);
});

test("RT-819: a definition opens by keyboard and says what the figure counts", async ({
  page,
  t,
}) => {
  const summary = page
    .locator("summary")
    .filter({ hasText: t("metrics.claim.about", { label: t("metrics.erpPosting.label") }) })
    .first();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(t("metrics.erpPosting.unknown")).first()).toBeVisible();
});

test("RT-819: retry by keyboard replaces the error with the figure", async ({ page, t }) => {
  await expect(page.getByRole("alert")).toContainText(t("metrics.claim.failed"));
  const retry = page.getByRole("button", { name: t("metrics.claim.retry") });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("RT-819: unknown and zero read differently; money stays per currency", async ({ page, t }) => {
  const store = page.locator("dl").first();
  await expect(store).toContainText(t("metrics.claim.unknown"));
  await expect(store).toContainText(t("metrics.claim.noAmount"));
  await expect(store).toContainText("1,250.50 EGP");
  await expect(store).toContainText("40.00 USD");
  await expect(store).not.toContainText("1,290.50");
});

test("RT-819: reduced motion: no animation runs and the figures are final", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator(".metric-claim__count").first()).toHaveText("14");
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

for (const mode of ["light", "dark", "forced"] as const) {
  test(`RT-819: no axe violations, definitions closed and open (${mode})`, async ({ page }) => {
    if (mode === "forced") await page.emulateMedia({ forcedColors: "active" });
    if (mode === "dark") {
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
      });
    }
    await expectNoAxeViolations(page, `KPI claims, closed (${mode})`);
    await page.evaluate(() => {
      for (const d of document.querySelectorAll("details")) d.open = true;
    });
    await expectNoAxeViolations(page, `KPI claims, open (${mode})`);
  });
}
