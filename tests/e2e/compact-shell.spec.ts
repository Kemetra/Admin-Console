import type { Locator } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { TIER1, mockRealisticApi } from "./compact-shell-data";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-825 (RT-785 SHELL-M1, D1/D2/D3): the compact shell at ≤768px. A ≥44px menu
 * button at the inline start opens a modal navigation drawer from the inline
 * start; the top bar keeps only the menu button, the mark and the avatar; name,
 * role, language, theme and sign-out live in the drawer. Runs as a touch phone
 * (isMobile, hasTouch) at each approved width, in both locale projects, with
 * long realistic names. Mocked Backend-Core (C-5).
 *
 * The overflow check guards a vacuous pass: a mobile viewport zooms out to fit
 * wide content, which grows `innerWidth` with it. So the viewport must still be
 * the configured width, the page must not be wider, and `.content` must not
 * scroll sideways (13503 finding 2).
 */

const LONG_NAME = "محمد عبد الرحمن السيد";
const LONG_TENANT = "نورثستار للتجزئة والتوزيع";

const user = {
  id: "u1",
  email: "mohamed.abdelrahman@northstar-retail.eg",
  display_name: LONG_NAME,
  is_platform_admin: true,
};

const context = {
  user,
  active_tenant: { id: "t1", name: LONG_TENANT },
  active_store: null,
  active_role_code: "tenant_admin",
  memberships: [{ tenant_id: "t1", tenant_name: LONG_TENANT, role_code: "tenant_admin" }],
};

const stores = Array.from({ length: 4 }, (_, i) => ({
  id: `s${String(i)}`,
  code: `CFC-${String(1000 + i)}`,
  name: `فرع كايرو فستيفال سيتي مول التجمع الخامس ${String(i)}`,
  is_active: i % 2 === 0,
  timezone: "Africa/Cairo",
}));

const json = (status: number, body: unknown) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function mockApi(page: Page, ctx: unknown = context): Promise<void> {
  // A list query answers an empty page; anything else an empty object.
  await page.route("**/api/v1/**", (r) =>
    r.fulfill(json(200, r.request().url().includes("?") ? { items: [], nextCursor: null } : {})),
  );
  await page.route("**/api/v1/catalog/sale-sync-ops/needs-repair**", (r) =>
    r.fulfill(json(200, { items: [], nextCursor: null })),
  );
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(200, ctx)));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json(200, stores)));
  // RT-782: the platform directory measured with long names and slugs.
  await page.route("**/api/v1/tenants", (r) => r.fulfill(json(200, tenants)));
}

const tenants = Array.from({ length: 3 }, (_, i) => ({
  id: `0190f000-0000-7000-8000-00000000d0${String(i)}`,
  slug: `northstar-retail-and-distribution-${String(i)}`,
  name: `${LONG_TENANT} ${String(i)}`,
}));

interface Overflow {
  innerWidth: number;
  scrollWidth: number;
  contentScroll: number;
  contentClient: number;
}

const overflow = (page: Page): Promise<Overflow> =>
  page.evaluate(() => {
    const content = document.querySelector<HTMLElement>(".content");
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      contentScroll: content?.scrollWidth ?? -1,
      contentClient: content?.clientWidth ?? -1,
    };
  });

async function expectNoSidewaysScroll(page: Page, width: number, label: string): Promise<void> {
  const o = await overflow(page);
  expect(o.innerWidth, `${label}: viewport not zoomed out`).toBe(width);
  expect(o.scrollWidth, `${label}: page width`).toBeLessThanOrEqual(width);
  expect(o.contentClient, `${label}: .content rendered`).toBeGreaterThan(0);
  expect(o.contentScroll, `${label}: .content sideways scroll`).toBeLessThanOrEqual(
    o.contentClient,
  );
}

/** Every match is a 44px touch target (or only 44px tall, for full-width rows). */
async function expectTouchTargets(
  locator: Locator,
  atLeast: number,
  axes: "both" | "height" = "both",
): Promise<void> {
  const boxes = await locator.evaluateAll((els) =>
    els.map((el) => {
      const b = el.getBoundingClientRect();
      return { name: el.textContent ?? "", width: b.width, height: b.height };
    }),
  );
  expect(boxes.length).toBeGreaterThanOrEqual(atLeast);
  for (const box of boxes) {
    expect(box.height, `${box.name} height`).toBeGreaterThanOrEqual(44);
    if (axes === "both") expect(box.width, `${box.name} width`).toBeGreaterThanOrEqual(44);
  }
}

/** Fully inside [0, width] on the inline axis. */
async function expectInsideViewport(locator: Locator, width: number): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("no box");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
}

/** Flush with the inline-start edge: the right in Arabic, the left in English. */
async function expectAtInlineStart(page: Page, locator: Locator, width: number): Promise<void> {
  await expectInsideViewport(locator, width);
  const box = await locator.boundingBox();
  const rtl = (await page.locator("html").getAttribute("dir")) === "rtl";
  const edge = rtl ? (box?.x ?? 0) + (box?.width ?? 0) : (box?.x ?? -1);
  expect(Math.round(edge)).toBe(rtl ? width : 0);
}

/** Tab never leaves the dialog (30 presses outnumber its controls). */
async function expectTabTrapped(page: Page, dialog: Locator): Promise<void> {
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
}

/** Border-box size of a locator, rounded to whole CSS px. */
async function boxOf(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  return box;
}

/** Waits until the drawer's enter animation is over, so boxes and colours are final. */
async function settled(page: Page): Promise<void> {
  await page
    .locator(".drawer-scrim")
    .evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)).then(() => undefined),
    );
}

const menuButton = (page: Page, t: (k: "shell.menu") => string) =>
  page.getByRole("button", { name: t("shell.menu"), exact: true });
const drawer = (page: Page, t: (k: "shell.menu") => string) =>
  page.getByRole("dialog", { name: t("shell.menu") });

for (const width of [360, 390, 412, 640, 768]) {
  test.describe(`compact shell at ${String(width)}px`, () => {
    test.use({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });

    test("the top bar holds only the menu, the mark and the avatar", async ({ page, t }) => {
      await mockApi(page);
      await page.goto("/");
      const button = menuButton(page, t);
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
      await expect(
        page.locator(".topbar").getByRole("img", { name: "Retail Tower OS" }),
      ).toBeVisible();
      await expect(page.locator(".topbar__avatar")).toBeVisible();
      await expect(page.locator(".topbar .tower-lockup__tag")).toBeHidden();
      await expect(page.locator(".topbar__name")).toBeHidden();
      await expect(
        page.locator(".topbar").getByRole("button", { name: t("theme.darkMode") }),
      ).toBeHidden();
      await expect(page.locator(".sidebar")).toBeHidden();
      // The menu button sits at the inline start: right in Arabic, left in English.
      const bar = await boxOf(page, ".topbar");
      const rtl = (await page.locator("html").getAttribute("dir")) === "rtl";
      if (rtl) expect(bar.x + bar.width - ((box?.x ?? 0) + (box?.width ?? 0))).toBeLessThan(40);
      else expect((box?.x ?? 0) - bar.x).toBeLessThan(40);
    });

    test("the drawer opens by tap, traps focus, Escape returns focus, navigating closes", async ({
      page,
      t,
    }) => {
      await mockApi(page);
      await page.goto("/");
      const button = menuButton(page, t);
      await button.tap();
      const dialog = drawer(page, t);
      await expect(dialog).toBeVisible();
      await settled(page);
      await expect(button).toHaveAttribute("aria-expanded", "true");
      // Inside the viewport, from the inline-start edge; the name block too.
      await expectAtInlineStart(page, dialog, width);
      await expectInsideViewport(dialog.getByText(LONG_NAME), width);
      await expectTabTrapped(page, dialog);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(button).toBeFocused();
      await expect(button).toHaveAttribute("aria-expanded", "false");

      await button.tap();
      await dialog.getByRole("link", { name: t("shell.nav.stores") }).tap();
      await expect(page).toHaveURL(/\/stores$/);
      await expect(dialog).toBeHidden();
      await expect(button).toBeFocused();
    });

    test("every drawer control and the scope controls are 44px touch targets", async ({
      page,
      t,
    }) => {
      await mockApi(page);
      await page.goto("/");
      await menuButton(page, t).tap();
      const dialog = drawer(page, t);
      await expectTouchTargets(dialog.locator("a, button"), 6);
      await page.keyboard.press("Escape");

      const scope = page.locator(".scope__btn");
      await expectTouchTargets(scope, 1);
      await scope.tap();
      const menu = page.getByRole("menu");
      await expect(menu.getByRole("menuitem").first()).toBeVisible();
      await expectTouchTargets(menu.getByRole("menuitem"), 1, "height");
      await expectInsideViewport(menu, width);
    });

    test("theme, language and sign-out work by tap from the drawer", async ({ page, t }) => {
      await mockApi(page);
      await page.route("**/api/v1/auth/**", (r) => r.fulfill({ status: 204 }));
      await page.goto("/");
      const html = page.locator("html");
      const startDir = await html.getAttribute("dir");

      await menuButton(page, t).tap();
      await drawer(page, t)
        .getByRole("button", { name: t("theme.darkMode") })
        .tap();
      await expect(html).toHaveAttribute("data-theme", "dark");

      await drawer(page, t).locator("button[lang]").tap();
      await expect(html).not.toHaveAttribute("dir", startDir ?? "");

      // The drawer re-renders in the new language; sign out from it.
      await page
        .locator(".drawer")
        .getByRole("button", { name: /Sign out|تسجيل الخروج/ })
        .tap();
      await expect(page).toHaveURL(/\/signin/);
    });

    test("no sideways scroll on Tier 1 routes and /platform with long names", async ({ page }) => {
      await mockRealisticApi(page);
      for (const path of TIER1) {
        await page.goto(path);
        // A crash replaces the shell, so the page heading proves it rendered.
        await page.locator(".content h1").first().waitFor();
        await page.waitForLoadState("networkidle");
        await expectNoSidewaysScroll(page, width, path);
      }
      await mockApi(page, { ...context, active_tenant: null, memberships: [] });
      await page.goto("/platform/tenants");
      await page.locator(".content").waitFor();
      await expectNoSidewaysScroll(page, width, "/platform/tenants");
    });
  });
}

test.describe("compact shell checks at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("axe passes with the drawer closed and open, light and dark", async ({ page, t }) => {
    await mockApi(page);
    await page.goto("/");
    for (const theme of ["light", "dark"] as const) {
      if (theme === "dark") {
        await page.evaluate(() => {
          localStorage.setItem("rt.theme.v1:user:u1", "dark");
          localStorage.setItem("rt.theme.v1:last", "dark");
        });
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      }
      await expectNoAxeViolations(page, `${theme} closed`);
      await menuButton(page, t).tap();
      await expect(drawer(page, t)).toBeVisible();
      await settled(page);
      await expectNoAxeViolations(page, `${theme} open`);
      await page.keyboard.press("Escape");
    }
  });

  test("keyboard: the menu button is the first stop and opens the drawer", async ({ page, t }) => {
    await mockApi(page);
    await page.goto("/");
    await page.locator(".content").waitFor();
    await page.keyboard.press("Tab");
    await expect(menuButton(page, t)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(drawer(page, t)).toBeVisible();
    await expect(drawer(page, t)).toBeFocused();
    await page.keyboard.press("Tab");
    expect(await drawer(page, t).evaluate((d) => d.contains(document.activeElement))).toBe(true);
  });

  test("forced colors keep the drawer edge, the active marker and the focus ring", async ({
    page,
    t,
  }) => {
    await mockApi(page);
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/stores");
    await page.locator(".content").waitFor();
    await page.keyboard.press("Tab");
    const ring = await menuButton(page, t).evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(ring).not.toBe("none");
    await page.keyboard.press("Enter");
    await settled(page);
    const edge = await page
      .locator(".drawer")
      .evaluate((el) => getComputedStyle(el).borderInlineEndStyle);
    expect(edge).toBe("solid");
    const marker = await drawer(page, t)
      .locator(".nav-entry--active")
      .evaluate((el) => getComputedStyle(el, "::before").backgroundColor);
    expect(marker).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("reduced motion: the drawer neither slides nor waits to close", async ({ page, t }) => {
    await mockApi(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await menuButton(page, t).tap();
    const animation = await page
      .locator(".drawer")
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe("none");
    await page.keyboard.press("Escape");
    await expect(drawer(page, t)).toHaveCount(0, { timeout: 100 });
  });
});

/** RT-781 support-session states (support-session.spec), at the 390px frame (RT-777 §3). */
const NOW = "2026-10-22T10:00:00Z";
const MIN = 60_000;
const at = (ms: number) => new Date(Date.parse(NOW) + ms).toISOString();
const session = (status: "active" | "expired", left: number, capIn: number) => ({
  id: "11111111-1111-4111-8111-111111111111",
  tenant_id: "t1",
  purpose: "incident",
  ticket_ref: "SUP-2291-NORTHSTAR-ESCALATION",
  status,
  expires_at: at(left),
  renewal_cap_at: at(capIn),
});

test.describe("support-session bar at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  const STATES = {
    active: session("active", 40 * MIN, 8 * 60 * MIN),
    expiring: session("active", 4 * MIN, 8 * 60 * MIN),
    cap_reached: session("active", 4 * MIN, 4 * MIN),
    expired: session("expired", -MIN, 8 * 60 * MIN),
  };

  for (const [state, s] of Object.entries(STATES)) {
    test(`${state}: the bar does not widen the layout`, async ({ page, t }) => {
      await page.clock.install({ time: new Date(NOW) });
      await mockApi(page, {
        user,
        active_tenant: { id: "t1", name: LONG_TENANT },
        active_store: null,
        active_role_code: "owner",
        memberships: [{ tenant_id: "t9", tenant_name: "Kemetra Internal", role_code: "owner" }],
        support_session: s,
      });
      await page.goto("/");
      await expect(page.getByRole("region", { name: t("platform.session.region") })).toBeVisible();
      await expectNoSidewaysScroll(page, 390, state);
    });
  }
});

test.describe("desktop shell above 768px is unchanged", () => {
  test.use({ viewport: { width: 1024, height: 800 } });

  test("sidebar and top-bar controls show; no menu button", async ({ page, t }) => {
    await mockApi(page);
    await page.goto("/");
    await expect(page.locator(".sidebar")).toBeVisible();
    await expect(menuButton(page, t)).toBeHidden();
    await expect(
      page.locator(".topbar").getByRole("button", { name: t("theme.darkMode") }),
    ).toBeVisible();
    await expect(page.locator(".topbar__name")).toBeVisible();
    await expect(page.locator(".topbar .tower-lockup__tag")).toBeVisible();
  });
});
