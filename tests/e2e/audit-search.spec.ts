import { type Page, expect, test } from "./fixtures";

/**
 * RF-6 audit search E2E (VG-2, S1/S2/S4). Scoped search + filter → rows;
 * POS-event rows render read-only (no write affordance); 403 → not-permitted
 * banner with request_id. Mocked DP2 (C-5).
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

const events = [
  {
    id: "e1",
    occurred_at: "2026-06-01T21:14:03Z",
    action: "shift.forced_close",
    actor_label: "Omar Khaled",
    actor_user_id: "u2",
    store_id: "s1",
    target_type: "shift",
    target_id: "sh-9",
    request_id: "11111111-1111-1111-1111-111111111111",
    metadata: { reason: "till_discrepancy" },
  },
  {
    id: "e2",
    occurred_at: "2026-06-01T20:02:55Z",
    action: "auth.signin",
    actor_label: "Amal Saleh",
    actor_user_id: "u1",
    store_id: null,
    request_id: "22222222-2222-2222-2222-222222222222",
    metadata: {},
  },
];

async function mockContext(page: Page): Promise<void> {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ctx) }),
  );
}

test("S1: scoped search + Apply renders audit rows", async ({ page, t }) => {
  await mockContext(page);
  await page.route("**/api/v1/audit/events**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: events, next_cursor: null }),
    }),
  );

  await page.goto("/audit");
  // pre-query: prompt, no rows yet
  await expect(page.getByText(t("audit.prequery", { tenant: "Northstar Retail" }))).toBeVisible();
  await page.getByRole("button", { name: t("audit.filters.apply"), exact: true }).click();
  await expect(page.getByText("shift.forced_close")).toBeVisible();
  await expect(page.getByText("auth.signin")).toBeVisible();
  // RT-399: the time column names UTC and shows the exact evidence instant.
  await expect(page.getByRole("columnheader", { name: t("audit.field.time") })).toBeVisible();
  await expect(page.getByText("2026-06-01 21:14:03 UTC", { exact: true })).toBeVisible();
  await expect(
    page.getByText(t("audit.pager.loaded", { count: 2 }), { exact: true }),
  ).toBeVisible();
});

test("S2: a POS-originated event renders read-only (no write affordance)", async ({ page, t }) => {
  await mockContext(page);
  await page.route("**/api/v1/audit/events**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "p1",
            occurred_at: "2026-06-01T19:40:12Z",
            action: "operator.session.takeover",
            actor_label: "Lina F.",
            store_id: "s1",
            request_id: "33333333-3333-3333-3333-333333333333",
            metadata: { terminal: "POS-04" },
          },
        ],
        next_cursor: null,
      }),
    }),
  );

  await page.goto("/audit");
  await page.getByRole("button", { name: t("audit.filters.apply"), exact: true }).click();
  await expect(page.getByText("operator.session.takeover")).toBeVisible();
  // read-only: opening it offers no acknowledge/annotate/export buttons
  await page.getByText("operator.session.takeover").click();
  const drawer = page.getByRole("dialog", { name: t("audit.inspect.title") });
  await expect(drawer).toBeVisible();
  // Locale-neutral: the only buttons are Copy (request_id) and the drawer's
  // Close, so no acknowledge/annotate/export/save/revoke affordance exists.
  await expect(drawer.getByRole("button")).toHaveCount(2);
  await expect(
    drawer.getByRole("button", { name: t("audit.inspect.copy"), exact: true }),
  ).toBeVisible();
});

test("S4: 403 → not-permitted banner with request_id", async ({ page, t }) => {
  await mockContext(page);
  await page.route("**/api/v1/audit/events**", (r) =>
    r.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "forbidden", request_id: "req-403" } }),
    }),
  );

  await page.goto("/audit");
  await page.getByRole("button", { name: t("audit.filters.apply"), exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText(t("audit.errors.forbidden"))).toBeVisible();
  await expect(page.getByText(/req-403/)).toBeVisible();
});
