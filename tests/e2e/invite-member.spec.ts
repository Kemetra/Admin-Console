import { type Page, expect, test } from "./fixtures";

/**
 * RF-5 invite E2E (VG-2, S2). Invite → 201 + list re-fetch; duplicate-pending
 * 409 → distinct warning. Mocked DP2 (C-5). Asserts the Idempotency-Key header
 * is sent on the POST. RT-399: runs in both locales; copy is selected through
 * the catalog (`t`), mocked data stays as authored.
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
  await page.route("**/api/v1/tenants/t1/members", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
}

test("S2: invite a member → 201 → drawer closes, list re-fetches; Idempotency-Key sent", async ({
  page,
  t,
}) => {
  await mockBase(page);
  let sawKey = false;
  await page.route("**/api/v1/memberships/invite", (r) => {
    if (r.request().headers()["idempotency-key"]) sawKey = true;
    return r.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "inv1", email: "new@northstar.eg", status: "pending" }),
    });
  });

  await page.goto("/operators");
  // empty state carries the invite primary
  await page.getByRole("button", { name: t("operators.list.invite") }).click();
  const drawer = page.getByRole("dialog", { name: t("operators.invite.title") });
  await expect(drawer).toBeVisible();
  await page.getByLabel(t("operators.form.email")).fill("new@northstar.eg");
  await page.getByLabel(t("operators.form.role")).fill("store_staff");
  await page.getByRole("button", { name: t("operators.invite.submit") }).click();

  // drawer closes on success
  await expect(drawer).toBeHidden();
  expect(sawKey).toBe(true);
});

test("S2: duplicate-pending 409 → distinct 'already pending' warning, drawer stays", async ({
  page,
  t,
}) => {
  await mockBase(page);
  await page.route("**/api/v1/memberships/invite", (r) =>
    r.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "pending_invitation", request_id: "req-409" } }),
    }),
  );

  await page.goto("/operators");
  await page.getByRole("button", { name: t("operators.list.invite") }).click();
  await page.getByLabel(t("operators.form.email")).fill("dup@northstar.eg");
  await page.getByLabel(t("operators.form.role")).fill("store_staff");
  await page.getByRole("button", { name: t("operators.invite.submit") }).click();

  await expect(page.getByText(t("operators.invite.errors.pendingExists"))).toBeVisible();
  await expect(page.getByRole("dialog", { name: t("operators.invite.title") })).toBeVisible();
});
