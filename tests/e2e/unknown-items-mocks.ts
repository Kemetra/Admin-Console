import type { Page } from "./fixtures";

/** Shared mocked DP2 for the unknown-items e2e specs (no live backend). */
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

/** A pending barcode item; override the fields a spec cares about. */
export function pendingItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    tenant_id: "t1",
    store_id: "s1",
    identifier_type: "barcode",
    identifier_value: "5012345678900",
    source_system: null,
    resolution_status: "pending",
    resolution_action: null,
    resolved_at: null,
    resolved_by: null,
    encountered_at: "2026-06-10T10:00:00Z",
    ...overrides,
  };
}

export async function mockContext(page: Page): Promise<void> {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ctx) }),
  );
}

export async function mockQueue(page: Page, items: unknown[]): Promise<void> {
  await page.route("**/api/v1/catalog/unknown-items?*", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items, next_cursor: null }),
    }),
  );
}
