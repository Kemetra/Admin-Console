import { type Page, expect, test } from "./fixtures";

/**
 * RT-400 store detail → edit E2E (screens 17 and 19). The detail page offers
 * «Edit store» and no delete. On the edit page the name save sends `{ name }`
 * only and routes back to the detail; «Suspend store» sends
 * `{ is_active: false }` on its own and stays put. Mocked DP2 (C-5).
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

async function mockStore(page: Page, patches: unknown[]): Promise<void> {
  const store = { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true };
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ctx) }),
  );
  await page.route("**/api/v1/stores/s1", (r) => {
    if (r.request().method() === "PATCH") {
      const body = r.request().postDataJSON() as Record<string, unknown>;
      patches.push(body);
      Object.assign(store, body);
    }
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(store) });
  });
}

test("RT-400: detail offers edit and no delete; save sends the name only", async ({ page, t }) => {
  const patches: unknown[] = [];
  await mockStore(page, patches);

  await page.goto("/stores/s1");
  await expect(page.getByRole("heading", { name: "Cairo Festival City" })).toBeVisible();
  await expect(page.getByRole("button", { name: /delete|حذف/i })).toHaveCount(0);
  await page.getByRole("link", { name: t("stores.detail.edit"), exact: true }).click();

  await expect(page.getByRole("heading", { name: t("stores.form.section") })).toBeVisible();
  await expect(page.locator("#store-code")).toHaveAttribute("readonly", "");
  await page.locator("#store-name").fill("CFC Mall");
  await page.getByRole("button", { name: t("stores.form.saveChanges"), exact: true }).click();

  await expect(page.getByRole("heading", { name: "CFC Mall" })).toBeVisible();
  expect(patches).toEqual([{ name: "CFC Mall" }]);
});

test("RT-400: «Suspend store» asks first, then sends is_active=false", async ({ page, t }) => {
  const patches: unknown[] = [];
  await mockStore(page, patches);

  await page.goto("/stores/s1/edit");
  const status = page.getByRole("region", { name: t("stores.status.title") });
  await expect(status.getByText(t("stores.state.active"), { exact: true })).toBeVisible();
  await status.getByRole("button", { name: t("stores.status.suspend"), exact: true }).click();

  // nothing is sent until the inline confirm, which names the store
  const confirm = page.getByRole("region", { name: t("stores.status.confirmLabel") });
  await expect(confirm).toContainText("Cairo Festival City");
  expect(patches).toEqual([]);
  await confirm.getByRole("button", { name: t("stores.status.suspend"), exact: true }).click();

  await expect(status.getByText(t("stores.state.inactive"), { exact: true })).toBeVisible();
  await expect(
    status.getByRole("button", { name: t("stores.status.activate"), exact: true }),
  ).toBeVisible();
  expect(patches).toEqual([{ is_active: false }]);
});
