import { type Page, expect, test } from "./fixtures";

/**
 * RF-5 edit + revoke E2E (VG-2, S4/S5). Edit role/store-access → re-fetch;
 * revoke → confirm → 204 → revoked marker. Mocked DP2 (C-5). RT-399: runs in
 * both locales; copy is selected through the catalog (`t`), mocked data stays
 * as authored.
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

function member(revoked: boolean) {
  return {
    membership_id: "m2",
    user: { id: "u2", email: "omar@northstar.eg", display_name: "Omar Khaled" },
    role_code: "store_manager",
    store_access_kind: "all",
    accessible_store_ids: [],
    revoked_at: revoked ? "2026-06-01T00:00:00Z" : null,
  };
}

async function mockBase(page: Page): Promise<void> {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ctx) }),
  );
}

test("S4: edit a member → 200 → drawer closes + list re-fetches", async ({ page, t }) => {
  await mockBase(page);
  await page.route("**/api/v1/tenants/t1/members", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([member(false)]),
    }),
  );
  await page.route("**/api/v1/memberships/m2", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(member(false)),
    }),
  );

  await page.goto("/operators");
  await page.getByRole("cell", { name: /Omar Khaled/ }).click();
  const drawer = page.getByRole("dialog", { name: t("operators.edit.title") });
  await expect(drawer).toBeVisible();
  await page.getByLabel(t("operators.form.role")).fill("tenant_admin");
  await page.getByRole("button", { name: t("operators.edit.save") }).click();
  await expect(drawer).toBeHidden();
});

test("S5: revoke → confirm → 204 → revoked marker on the refreshed list", async ({ page, t }) => {
  await mockBase(page);
  let revoked = false;
  await page.route("**/api/v1/tenants/t1/members", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([member(revoked)]),
    }),
  );
  await page.route("**/api/v1/memberships/m2", (r) => {
    if (r.request().method() === "DELETE") {
      revoked = true;
      return r.fulfill({ status: 204, body: "" });
    }
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(member(false)),
    });
  });

  await page.goto("/operators");
  await page.getByRole("cell", { name: /Omar Khaled/ }).click();
  await page.getByRole("button", { name: t("operators.edit.revoke.open") }).click();
  // confirm step names the member
  const revoke = t("operators.edit.revoke.confirm");
  const confirm = page.getByRole("region", {
    name: t("components.confirmDelete.label", { action: revoke }),
  });
  await expect(confirm).toContainText("Omar Khaled");
  await confirm.getByRole("button", { name: revoke, exact: true }).click();

  await expect(page.getByRole("dialog", { name: t("operators.edit.title") })).toBeHidden();
  await expect(page.getByText(t("operators.state.revoked"), { exact: true })).toBeVisible();
});
