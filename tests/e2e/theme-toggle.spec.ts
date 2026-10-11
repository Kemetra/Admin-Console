import { type Page, expect, test } from "./fixtures";

/**
 * RT-398 — opt-in dark theme. The top-bar toggle switches <html data-theme>,
 * the choice survives a reload, and the inline pre-paint script restores it
 * before the app bundle runs (no light flash). Forced colours keep the toggle's
 * state and focus visible. Mocked DP2 (C-5).
 */

const context = {
  user: {
    id: "u1",
    email: "amal@northstar.eg",
    display_name: "Amal Saleh",
    is_platform_admin: true,
  },
  active_tenant: { id: "t1", name: "Northstar Retail" },
  active_store: null,
  active_role_code: "platform_admin",
  memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "platform_admin" }],
};

async function mockApi(page: Page): Promise<void> {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(context) }),
  );
}

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme ?? "");
const bodyBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("toggle on, reload: still dark, restored before the app bundle runs", async ({ page, t }) => {
  await mockApi(page);
  await page.goto("/");
  const toggle = page.getByRole("button", { name: t("theme.darkMode") });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await theme(page)).toBe("");
  expect(await bodyBackground(page)).toBe("rgb(247, 249, 250)"); // light canvas

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await theme(page)).toBe("dark");
  expect(await bodyBackground(page)).toBe("rgb(14, 22, 31)"); // dark canvas #0e161f

  // With every script bundle blocked, only the inline pre-paint script can set it.
  await page.route("**/assets/*.js", (r) => r.abort());
  await page.reload();
  expect(await theme(page)).toBe("dark");
  expect(await bodyBackground(page)).toBe("rgb(14, 22, 31)");

  // And with the app running again, the toggle reflects the stored choice.
  await page.unroute("**/assets/*.js");
  await page.reload();
  await expect(page.getByRole("button", { name: t("theme.darkMode") })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await theme(page)).toBe("dark");
});

test("toggle off returns to the light default and persists it across a reload", async ({
  page,
  t,
}) => {
  await mockApi(page);
  // Seed dark once, through the app's own origin, not on every navigation (an
  // init script would re-seed dark on the reload and hide a persistence bug).
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("rt.theme.v1:user:u1", "dark");
    localStorage.setItem("rt.theme.v1:last", "dark");
  });
  await page.reload();
  const toggle = page.getByRole("button", { name: t("theme.darkMode") });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await theme(page)).toBe("dark");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await theme(page)).toBe("");
  // The pre-paint mirror must say light too, or the next load flashes dark.
  expect(await page.evaluate(() => localStorage.getItem("rt.theme.v1:last"))).toBe("light");

  // With the bundles blocked, only the pre-paint script paints: it must stay light.
  await page.route("**/assets/*.js", (r) => r.abort());
  await page.reload();
  expect(await theme(page)).toBe("");
  await page.unroute("**/assets/*.js");

  await page.reload();
  await expect(page.getByRole("button", { name: t("theme.darkMode") })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(await theme(page)).toBe("");
  expect(await bodyBackground(page)).toBe("rgb(247, 249, 250)"); // light canvas
  expect(await page.evaluate(() => localStorage.getItem("rt.theme.v1:user:u1"))).toBe("light");
});

test.describe("forced-colors: active", () => {
  test("dark + forced colours: the on toggle keeps a 2px edge and a real focus outline", async ({
    page,
    t,
  }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await mockApi(page);
    await page.addInitScript(() => {
      localStorage.setItem("rt.theme.v1:user:u1", "dark");
      localStorage.setItem("rt.theme.v1:last", "dark");
    });
    await page.goto("/");
    const toggle = page.getByRole("button", { name: t("theme.darkMode") });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    const edge = await toggle.evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(edge).toBe("2px");

    await toggle.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(toggle).toBeFocused();
    const outline = await toggle.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: Number.parseFloat(cs.outlineWidth) };
    });
    expect(outline.style).toBe("solid");
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });
});
