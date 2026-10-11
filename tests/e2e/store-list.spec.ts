import { type Page, expect, test } from "./fixtures";

/**
 * RF-2 store list E2E (VG-2, Scenarios S4/S5). With an active tenant the store
 * roster renders scoped to it; with no active tenant the surface pre-gates to a
 * scope prompt (S5) and never issues listStores. Mocked DP2 (C-5).
 */

const user = {
  id: "u1",
  email: "amal@northstar.eg",
  display_name: "Amal Saleh",
  is_platform_admin: true,
};

async function mockBase(page: Page, ctx: unknown): Promise<void> {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ctx) }),
  );
}

test("S4: store list renders the active tenant's stores and opens a detail", async ({
  page,
  t,
}) => {
  await mockBase(page, {
    user,
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: null,
    active_role_code: "tenant_admin",
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "tenant_admin" }],
  });
  await page.route("**/api/v1/stores", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true },
        { id: "s2", code: "NCM", name: "New Cairo Mall", is_active: false },
      ]),
    }),
  );
  await page.route("**/api/v1/stores/s1", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true }),
    }),
  );

  await page.goto("/stores");
  await expect(
    page.getByRole("heading", { name: t("stores.list.title"), exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "Cairo Festival City" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "New Cairo Mall" })).toBeVisible();
  // State badges are catalog labels, one per row.
  await expect(
    page.getByRole("cell", { name: t("stores.state.active"), exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: t("stores.state.inactive"), exact: true }),
  ).toBeVisible();

  await page.getByRole("cell", { name: "Cairo Festival City" }).click();
  await expect(page.getByRole("heading", { name: "Cairo Festival City" })).toBeVisible();
  await expect(page.getByText("CFC")).toBeVisible();
});

test("S5: no active tenant -> scope prompt, store list never loads", async ({ page, t }) => {
  let storesCalled = false;
  await mockBase(page, {
    user,
    // Platform admin with multiple memberships but no tenant selected yet.
    active_tenant: null,
    active_store: null,
    memberships: [
      { tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "platform_admin" },
      { tenant_id: "t2", tenant_name: "Helios Markets", role_code: "platform_admin" },
    ],
  });
  await page.route("**/api/v1/stores", (r) => {
    storesCalled = true;
    return r.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  });

  // With no active tenant RF-1 shows the scope gate at "/", so assert the gate
  // is what an operator sees; the store route is unreachable without scope.
  await page.goto("/stores");
  // The protected layout gates on context: no active tenant -> RF-1 scope gate.
  await expect(page.getByRole("heading", { name: t("shell.gate.title") })).toBeVisible();
  expect(storesCalled).toBe(false);
});
