import type { Locale } from "../../src/i18n/locale";
import { translate } from "../../src/i18n/translate";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-399 — Arabic-first locale with English second, in both projects. The app
 * paints the project locale (the browser's own locale is set to the other one,
 * so the device never picks it), the top-bar switch flips <html lang/dir> and
 * the whole frame, the choice survives a reload (also before the bundle runs),
 * logical CSS mirrors the layout, and the chrome never shows two languages.
 * Mocked DP2 (C-5).
 */

const context = {
  user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
  active_tenant: { id: "t1", name: "Northstar Retail" },
  active_store: null,
  active_role_code: "owner",
  memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "owner" }],
};

async function mockApi(page: Page): Promise<void> {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(context) }),
  );
}

const TAG: Record<Locale, string> = { ar: "ar-EG", en: "en" };
const DIR: Record<Locale, string> = { ar: "rtl", en: "ltr" };
const other = (l: Locale): Locale => (l === "ar" ? "en" : "ar");

const docLocale = (page: Page) =>
  page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));

test("renders the project locale, whatever the browser's own language", async ({
  page,
  appLocale,
  t,
}) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: t("shell.overview.title") })).toBeVisible();
  expect(await docLocale(page)).toEqual({ lang: TAG[appLocale], dir: DIR[appLocale] });
  expect(await page.title()).toBe(t("app.title"));
  // The switch offers the other language, named in that language.
  const toggle = page.getByRole("button", {
    name: translate(other(appLocale), "locale.switch.action"),
  });
  await expect(toggle).toHaveText(translate(other(appLocale), "locale.switch.name"));
  await expect(toggle).toHaveAttribute("lang", TAG[other(appLocale)]);
});

test("the switch flips the frame and the choice survives a reload, before the bundle runs", async ({
  page,
  appLocale,
}) => {
  await mockApi(page);
  await page.goto("/");
  const next = other(appLocale);
  await page.getByRole("button", { name: translate(next, "locale.switch.action") }).click();

  expect(await docLocale(page)).toEqual({ lang: TAG[next], dir: DIR[next] });
  const nav = page.getByRole("navigation", { name: translate(next, "shell.nav.label") });
  await expect(nav.getByRole("link", { name: translate(next, "shell.nav.stores") })).toBeVisible();
  await expect(page.getByText(translate(next, "theme.darkMode"))).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: translate(next, "shell.overview.title") }),
  ).toBeVisible();
  expect(await docLocale(page)).toEqual({ lang: TAG[next], dir: DIR[next] });

  // With every script bundle blocked, only the inline pre-paint script runs.
  await page.route("**/assets/*.js", (r) => r.abort());
  await page.reload();
  expect(await docLocale(page)).toEqual({ lang: TAG[next], dir: DIR[next] });
  await page.unroute("**/assets/*.js");

  // And back again.
  await page.reload();
  await page.getByRole("button", { name: translate(appLocale, "locale.switch.action") }).click();
  expect(await docLocale(page)).toEqual({ lang: TAG[appLocale], dir: DIR[appLocale] });
  await page.reload();
  expect(await docLocale(page)).toEqual({ lang: TAG[appLocale], dir: DIR[appLocale] });
});

test("logical CSS mirrors the layout: sidebar on the inline start", async ({ page, appLocale }) => {
  await mockApi(page);
  await page.goto("/");
  const sidebar = await page.locator(".sidebar").boundingBox();
  const content = await page.locator(".content").boundingBox();
  if (!sidebar || !content) throw new Error("shell regions not rendered");
  if (appLocale === "en") {
    expect(sidebar.x).toBeLessThan(content.x); // LTR: sidebar on the left
  } else {
    expect(sidebar.x).toBeGreaterThan(content.x); // RTL: sidebar on the right
  }
  // The nav text starts on the reading side.
  const align = await page
    .locator(".nav-entry")
    .first()
    .evaluate((el) => getComputedStyle(el).textAlign);
  expect(align).toBe("start");
});

test("one locale at a time: the frame's own copy never mixes in the other script", async ({
  page,
  appLocale,
}) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.locator(".nav-entry__label").first()).toBeVisible();
  const chrome = await page
    .locator(
      ".nav-entry__label, .nav-section, .content__title, .tower-lockup__tag, .topbar__name small",
    )
    .allTextContents();
  expect(chrome.length).toBeGreaterThan(5);
  const foreign = appLocale === "ar" ? /[A-Za-z]{2,}/ : /[؀-ۿ]/;
  for (const text of chrome) expect(foreign.test(text), text).toBe(false);
});
