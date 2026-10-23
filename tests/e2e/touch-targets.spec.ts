import { expectNoAxeViolations } from "./axe";
import { TIER1, mockRealisticApi } from "./compact-shell-data";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-829 Part A (RT-785 D3, RT-825 gap): at ≤768px every primary action on a
 * Tier 1 route is at least 44×44px; above 768px the 36px density is unchanged.
 * "Primary action" is the shared `.btn-primary` role (DESIGN.md §7).
 *
 * The measurement guards a vacuous pass: the viewport must still be the
 * configured width (a mobile viewport zooms out to fit wide content), and the
 * routes together must expose primary buttons to measure.
 */

interface Box {
  route: string;
  name: string;
  width: number;
  height: number;
}

async function primaryBoxes(page: Page, route: string): Promise<Box[]> {
  await page.goto(route);
  await page.locator(".content h1").first().waitFor();
  await page.waitForLoadState("networkidle");
  return page.locator(".btn-primary:visible").evaluateAll(
    (els, r) =>
      els.map((el) => {
        const b = el.getBoundingClientRect();
        return { route: r, name: el.textContent ?? "", width: b.width, height: b.height };
      }),
    route,
  );
}

for (const width of [360, 390, 412, 768]) {
  test.describe(`Tier 1 primary actions at ${String(width)}px`, () => {
    test.use({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });

    test("every primary action is at least 44×44px", async ({ page }) => {
      await mockRealisticApi(page);
      const all: Box[] = [];
      for (const route of TIER1) all.push(...(await primaryBoxes(page, route)));
      expect(await page.evaluate(() => window.innerWidth), "viewport not zoomed out").toBe(width);
      // Filter bars on /sales, /devices, /shift-closes and /audit, and the new-store link.
      expect(all.length).toBeGreaterThanOrEqual(5);
      expect(
        new Set(all.map((b) => b.route)).size,
        "routes with a primary action",
      ).toBeGreaterThanOrEqual(4);
      for (const b of all) {
        expect(b.height, `${b.route} "${b.name}" height`).toBeGreaterThanOrEqual(44);
        expect(b.width, `${b.route} "${b.name}" width`).toBeGreaterThanOrEqual(44);
      }
    });
  });
}

test.describe("Tier 1 primary actions at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("a drawer's primary action is 44px too", async ({ page }) => {
    await mockRealisticApi(page);
    await page.goto("/devices/pairing-codes");
    await page.locator(".content h1").first().waitFor();
    await page.locator(".content .btn-primary").first().tap();
    const submit = page.locator(".drawer .btn-primary");
    await expect(submit.first()).toBeVisible();
    for (const box of await submit.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()),
    )) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  });

  test("axe passes on every Tier 1 route", async ({ page }) => {
    await mockRealisticApi(page);
    for (const route of TIER1) {
      await primaryBoxes(page, route);
      await expectNoAxeViolations(page, route);
    }
  });
});

test.describe("desktop density above 768px is unchanged", () => {
  test.use({ viewport: { width: 1024, height: 800 } });

  test("primary actions keep their 36px height", async ({ page }) => {
    await mockRealisticApi(page);
    const all: Box[] = [];
    for (const route of TIER1) all.push(...(await primaryBoxes(page, route)));
    expect(all.length).toBeGreaterThanOrEqual(5);
    for (const b of all) expect(b.height, `${b.route} "${b.name}"`).toBe(36);
  });
});
