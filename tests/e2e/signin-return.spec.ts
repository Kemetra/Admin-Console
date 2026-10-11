import { type LocaleFixtures, type Page, expect, test } from "./fixtures";

/**
 * RT-355 against the BUILT SPA (C-5 mocked Backend-Core). A signed-out user who
 * opens a protected URL is sent to /signin and, after a single-tenant
 * (auto-select) sign-in, returns to that exact URL. With several tenants the
 * chooser still lands on `/`. The context fetch 401s until sign-in succeeds,
 * so the sign-in starts from a settled signed-out context, as in real use.
 * RT-399: runs in both locales, selecting by the catalog copy the app renders.
 */
const t1 = { tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "tenant_admin" };
const t2 = { tenant_id: "t2", tenant_name: "Helios Markets", role_code: "tenant_admin" };
const user = { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" };

async function mockSignIn(page: Page, memberships: (typeof t1)[]): Promise<void> {
  let signedIn = false;
  const active = memberships.length === 1 ? { id: "t1", name: "Northstar Retail" } : null;
  const ctx = {
    user,
    active_tenant: active,
    active_store: null,
    active_role_code: "tenant_admin",
    memberships,
  };
  await page.route("**/api/v1/**", (r) => r.fulfill({ status: 200, json: {} }));
  await page.route("**/api/v1/auth/refresh", (r) => r.fulfill({ status: 401, json: {} }));
  await page.route("**/api/v1/context/me", (r) =>
    signedIn
      ? r.fulfill({ status: 200, json: ctx })
      : r.fulfill({ status: 401, json: { error: { code: "unauthorized" } } }),
  );
  await page.route("**/api/v1/auth/signin", (r) => {
    signedIn = true;
    return r.fulfill({ status: 200, json: { user: { id: "u1" }, memberships } });
  });
}

async function signIn(page: Page, t: LocaleFixtures["t"]): Promise<void> {
  await page.getByLabel(t("auth.signIn.email.label")).fill("amal@northstar.eg");
  await page.getByLabel(t("auth.signIn.password.label")).fill("password1");
  await page.getByRole("button", { name: t("auth.signIn.submit") }).click();
}

test("S1: a deep link survives sign-in and auto-select returns to it", async ({ page, t }) => {
  await mockSignIn(page, [t1]);
  await page.goto("/audit?actor=u1#top");
  await expect(page).toHaveURL(/\/signin$/);

  await signIn(page, t);

  await expect(page).toHaveURL(/\/audit\?actor=u1#top$/);
  await expect(page.getByRole("heading", { name: t("audit.title") })).toBeVisible();
});

test("S2: several tenants land on the chooser at /, not the deep link", async ({ page, t }) => {
  await mockSignIn(page, [t1, t2]);
  await page.goto("/audit?actor=u1");
  await expect(page).toHaveURL(/\/signin$/);

  await signIn(page, t);

  await expect(page.getByRole("heading", { name: t("shell.gate.title") })).toBeVisible();
  await expect(page).toHaveURL(/:\d+\/$/);
});

test("S3: opening /signin directly lands on Overview", async ({ page, t }) => {
  await mockSignIn(page, [t1]);
  await page.goto("/signin");

  await signIn(page, t);

  await expect(page.getByRole("heading", { name: t("shell.overview.title") })).toBeVisible();
  await expect(page).toHaveURL(/:\d+\/$/);
});
