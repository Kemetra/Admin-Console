import { type Page, expect, test } from "./fixtures";

/**
 * RF-2 tenant roster E2E (VG-2, Scenarios S1/S2 tenant). Drives the built SPA
 * with mocked DP2 responses (C-5: no live backend). Covers the roster → detail
 * path and the empty state. Register the broad catch-all first so the specific
 * route wins (Playwright matches in reverse registration order).
 */

const user = {
  id: "u1",
  email: "amal@northstar.eg",
  display_name: "Amal Saleh",
  is_platform_admin: true,
};

const resolvedContext = {
  user,
  active_tenant: { id: "t1", name: "Northstar Retail" },
  active_store: null,
  active_role_code: "platform_admin",
  memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "platform_admin" }],
};

async function mockBase(page: Page): Promise<void> {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(resolvedContext),
    }),
  );
}

test("S1: tenant roster renders the backend-scoped set and opens a detail", async ({ page, t }) => {
  await mockBase(page);
  await page.route("**/api/v1/tenants", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "t1", slug: "northstar", name: "Northstar Retail" },
        { id: "t2", slug: "helios", name: "Helios Markets" },
      ]),
    }),
  );
  await page.route("**/api/v1/tenants/t2", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "t2", slug: "helios", name: "Helios Markets", status: "active" }),
    }),
  );

  await page.goto("/tenants");
  await expect(
    page.getByRole("heading", { name: t("tenants.list.title"), exact: true }),
  ).toBeVisible();
  // Scope to table cells: "Northstar Retail" also appears in the scope header.
  await expect(page.getByRole("cell", { name: "Northstar Retail" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Helios Markets" })).toBeVisible();

  // Row → detail
  await page.getByRole("cell", { name: "Helios Markets" }).click();
  await expect(page.getByRole("heading", { name: "Helios Markets" })).toBeVisible();
  // The status code drives a catalog label; the raw code is never the copy.
  await expect(page.getByText(t("tenants.status.active"), { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: t("tenants.detail.back") })).toBeVisible();
});

test("empty roster renders a successful zero-row state with a create entry point", async ({
  page,
  t,
}) => {
  await mockBase(page);
  await page.route("**/api/v1/tenants", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );

  await page.goto("/tenants");
  await expect(page.getByText(t("tenants.list.empty"))).toBeVisible();
  await expect(page.getByRole("link", { name: t("tenants.list.add") })).toBeVisible();
});

test("T034 a11y: a table row is keyboard-focusable and Enter opens its detail", async ({
  page,
}) => {
  await mockBase(page);
  await page.route("**/api/v1/tenants", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: "t1", slug: "northstar", name: "Northstar Retail" }]),
    }),
  );
  await page.route("**/api/v1/tenants/t1", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "t1",
        slug: "northstar",
        name: "Northstar Retail",
        status: "active",
      }),
    }),
  );

  await page.goto("/tenants");
  const row = page.getByRole("row").filter({ hasText: "northstar" });
  await row.focus();
  await expect(row).toBeFocused();
  // Keyboard activation (no hover-only functionality): Enter opens the detail.
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Northstar Retail" })).toBeVisible();
});
