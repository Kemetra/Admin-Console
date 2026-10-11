import { type Page, expect, test } from "./fixtures";

/**
 * RF-2 store soft-delete E2E (VG-2, Scenario S8). Soft-delete behind the inline
 * confirm that names the store, then re-fetch the list and route back. Mocked
 * DP2 (C-5).
 */

const ctx = {
  user: {
    id: "u1",
    email: "amal@northstar.eg",
    display_name: "Amal Saleh",
    is_platform_admin: true,
  },
  active_tenant: { id: "t1", name: "Northstar Retail" },
  active_store: null,
  active_role_code: "tenant_admin",
  memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "tenant_admin" }],
};

async function mockBase(page: Page): Promise<void> {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ctx) }),
  );
}

test("S8: soft-delete a store behind a confirm, then return to the list", async ({ page, t }) => {
  await mockBase(page);
  await page.route("**/api/v1/stores", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true },
      ]),
    }),
  );
  await page.route("**/api/v1/stores/s1", (r) => {
    if (r.request().method() === "DELETE") {
      return r.fulfill({ status: 204, body: "" });
    }
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true }),
    });
  });

  await page.goto("/stores/s1");
  await expect(page.getByRole("heading", { name: "Cairo Festival City" })).toBeVisible();
  const softDelete = t("stores.detail.softDelete");
  await page.getByRole("button", { name: softDelete, exact: true }).click();

  // inline confirm names the store
  const confirm = page.getByRole("region", {
    name: t("components.confirmDelete.label", { action: softDelete }),
  });
  await expect(confirm).toContainText("Cairo Festival City");
  await confirm.getByRole("button", { name: softDelete, exact: true }).click();

  // routed back to the store list
  await expect(
    page.getByRole("heading", { name: t("stores.list.title"), exact: true }),
  ).toBeVisible();
});
