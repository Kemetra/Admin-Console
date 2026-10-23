import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-780 (RT-777 S1): the `/platform` entry gate against the built SPA with a
 * mocked Backend-Core (C-5). Runs in both locales; axe on the shell and the
 * no-access state, light and dark.
 */

const admin = {
  id: "u1",
  email: "ops@kemetra.test",
  display_name: "Ops Admin",
  is_platform_admin: true,
};
const member = {
  id: "u2",
  email: "amal@northstar.eg",
  display_name: "Amal Saleh",
  is_platform_admin: false,
};

const tenantContext = (user: typeof admin) => ({
  user,
  active_tenant: { id: "t1", name: "Northstar Retail" },
  active_store: null,
  active_role_code: "owner",
  memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "owner" }],
});

async function mockContext(page: Page, status: number, body: unknown): Promise<string[]> {
  const calls: string[] = [];
  await page.route("**/api/v1/**", (r) => {
    calls.push(`${r.request().method()} ${new URL(r.request().url()).pathname}`);
    return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
  return calls;
}

test("platform admin with no membership and no tenant reaches /platform/tenants", async ({
  page,
  t,
}) => {
  const calls = await mockContext(page, 200, { user: admin, active_tenant: null, memberships: [] });
  await page.goto("/platform");
  await expect(page).toHaveURL(/\/platform\/tenants$/);
  await expect(
    page.getByRole("heading", { level: 1, name: t("platform.tenants.title") }),
  ).toBeVisible();
  await expect(page.locator(".tower-lockup__tag")).toHaveText(t("platform.label"));
  await expect(page.getByRole("navigation", { name: t("platform.nav.label") })).toBeVisible();
  // No tenant scope bar, picker or generic no-access; never a tenant switch.
  await expect(page.getByRole("heading", { name: t("shell.gate.title") })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: t("auth.noAccess.title") })).toHaveCount(0);
  expect(calls.filter((c) => c.includes("switch"))).toEqual([]);
  await expectNoAxeViolations(page, "platform shell");
});

test("platform shell passes axe in dark", async ({ page, t }) => {
  await mockContext(page, 200, { user: admin, active_tenant: null, memberships: [] });
  await page.goto("/platform");
  await page.evaluate(() => {
    localStorage.setItem("rt.theme.v1:user:u1", "dark");
    localStorage.setItem("rt.theme.v1:last", "dark");
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("heading", { level: 1, name: t("platform.tenants.title") }),
  ).toBeVisible();
  await expectNoAxeViolations(page, "platform shell dark");
});

test("platform admin with a membership is not forced through the tenant picker", async ({
  page,
  t,
}) => {
  await mockContext(page, 200, {
    user: admin,
    active_tenant: null,
    memberships: [
      { tenant_id: "t1", tenant_name: "Northstar Retail" },
      { tenant_id: "t2", tenant_name: "Helios Markets" },
    ],
  });
  await page.goto("/platform/tenants");
  await expect(
    page.getByRole("heading", { level: 1, name: t("platform.tenants.title") }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: t("shell.gate.title") })).toHaveCount(0);
});

test("a non-admin gets the non-disclosing state, light and dark, axe clean", async ({
  page,
  t,
}) => {
  await mockContext(page, 200, tenantContext(member));
  await page.goto("/platform/tenants");
  await expect(page.getByRole("heading", { name: t("platform.noAccess.title") })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: t("platform.tenants.title") }),
  ).toHaveCount(0);
  await expectNoAxeViolations(page, "platform not available");
  await page.evaluate(() => {
    localStorage.setItem("rt.theme.v1:user:u2", "dark");
    localStorage.setItem("rt.theme.v1:last", "dark");
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectNoAxeViolations(page, "platform not available dark");
});

test("a path that does not exist shows the same state as a non-admin", async ({ page, t }) => {
  await mockContext(page, 200, { user: admin, active_tenant: null, memberships: [] });
  await page.goto("/platform/nope");
  await expect(page.getByRole("heading", { name: t("platform.noAccess.title") })).toBeVisible();
  await expect(page.getByText(t("platform.noAccess.body"))).toBeVisible();
});

test("unauthenticated redirects to sign-in", async ({ page }) => {
  await mockContext(page, 401, { error: { code: "unauthenticated" } });
  await page.route("**/api/v1/auth/refresh", (r) =>
    r.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/platform/tenants");
  await expect(page).toHaveURL(/\/signin/);
});

test("the tenant console is unchanged: a member still lands on the Overview", async ({
  page,
  t,
}) => {
  await mockContext(page, 200, tenantContext(admin));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: t("shell.overview.title") })).toBeVisible();
  await expect(page.getByRole("navigation", { name: t("shell.nav.label") })).toBeVisible();
});
