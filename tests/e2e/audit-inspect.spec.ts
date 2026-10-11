import { type Page, expect, test } from "./fixtures";

/**
 * RF-6 row inspect E2E (VG-2, S3). Open the inspect drawer from a row → full
 * read-only detail; no extra listAuditEvents call fires; Esc closes. Mocked DP2.
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

async function mockContext(page: Page): Promise<() => number> {
  let auditCalls = 0;
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ctx) }),
  );
  await page.route("**/api/v1/audit/events**", (r) => {
    auditCalls += 1;
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "e1",
            occurred_at: "2026-06-01T21:14:03Z",
            action: "shift.forced_close",
            actor_label: "Omar Khaled",
            store_id: "s1",
            target_type: "shift",
            target_id: "sh-9",
            request_id: "11111111-1111-1111-1111-111111111111",
            metadata: { reason: "till_discrepancy" },
          },
        ],
        next_cursor: null,
      }),
    });
  });
  return () => auditCalls;
}

test("S3: row inspect opens read-only detail; no extra fetch; Esc closes", async ({ page, t }) => {
  const auditCalls = await mockContext(page);
  await page.goto("/audit");
  await page.getByRole("button", { name: t("audit.filters.apply"), exact: true }).click();
  await expect(page.getByText("shift.forced_close")).toBeVisible();
  const callsAfterSearch = auditCalls();

  await page.getByText("shift.forced_close").click();
  const drawer = page.getByRole("dialog", { name: t("audit.inspect.title") });
  await expect(drawer).toBeVisible();
  // full detail incl. metadata
  await expect(drawer.getByText("till_discrepancy")).toBeVisible();
  await expect(drawer.getByText("11111111-1111-1111-1111-111111111111")).toBeVisible();
  // RT-399: the evidence time is exact UTC in both locales, under a UTC label.
  await expect(drawer.getByText(t("audit.field.time"), { exact: true })).toBeVisible();
  await expect(drawer.getByText("2026-06-01 21:14:03 UTC", { exact: true })).toBeVisible();
  // no extra listAuditEvents call (reads the already-fetched row)
  expect(auditCalls()).toBe(callsAfterSearch);

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});
