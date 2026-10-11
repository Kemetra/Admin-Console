import { type Page, expect, test } from "./fixtures";

/**
 * RF-2 unpermitted tenant-create E2E (VG-2, Scenario S3, FR-004-004). The
 * action is rendered, attempted, and the backend 403 is surfaced via the
 * persistent banner with its request_id — never pre-hidden by role (OQ-3). The
 * operator stays in place. Mocked DP2 (C-5).
 */

const resolvedContext = {
  user: {
    id: "u5",
    email: "staff@northstar.eg",
    display_name: "Sara Staff",
    is_platform_admin: false,
  },
  active_tenant: { id: "t1", name: "Northstar Retail" },
  active_store: null,
  active_role_code: "store_staff",
  memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "store_staff" }],
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

test("S3: a non-admin can open the create form (not pre-hidden) and sees a 403 on submit", async ({
  page,
  t,
}) => {
  await mockBase(page);
  await page.route("**/api/v1/tenants", (r) => {
    if (r.request().method() === "POST") {
      return r.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "forbidden", request_id: "req-403" } }),
      });
    }
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: "t1", slug: "northstar", name: "Northstar Retail" }]),
    });
  });

  // The create entry point is rendered for everyone (no role pre-hide, OQ-3).
  await page.goto("/tenants");
  await page.getByRole("link", { name: t("tenants.list.add") }).click();
  await expect(page).toHaveURL(/\/tenants\/new$/);

  await page.getByLabel(t("tenants.field.slug"), { exact: true }).fill("attempt");
  await page.getByLabel(t("tenants.field.name"), { exact: true }).fill("Attempt Co");
  await page.getByRole("button", { name: t("tenants.form.create") }).click();

  // 403 surfaces in the persistent banner with request_id; operator stays put.
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(t("errors.forbidden"));
  await expect(page.getByText(/req-403/)).toBeVisible();
  await expect(page).toHaveURL(/\/tenants\/new$/);
});
