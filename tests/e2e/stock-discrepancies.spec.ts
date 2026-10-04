import { type Page, expect, test } from "@playwright/test";

/**
 * RT-178 ERPNext stock discrepancies E2E against mocked Backend-Core (C-5).
 * S1: role-gated nav → store summary → per-store item table (quantity verbatim,
 * "as of" header, Not mapped badge) → Request fresh snapshot (Idempotency-Key).
 * S2: store_manager — nav visible, refresh hidden. S3: cashier — no nav entry.
 * S4: per-store 404 → not-found.
 */
const S1 = "0190f000-0000-7000-8000-0000000000a1";
const S2 = "0190f000-0000-7000-8000-0000000000a2";
const READ_AT = "2026-10-04T07:58:12.000Z";

function ctx(role: string) {
  return {
    user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: null,
    active_role_code: role,
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: role }],
  };
}

const snapshot = {
  status: "fresh",
  erpnextWarehouseRef: "Stores - NSR",
  runId: "0190f000-0000-7000-8000-0000000000b1",
  readAt: READ_AT,
  recordedAt: "2026-10-04T08:00:03.000Z",
  staleAfterSeconds: 86400,
  reportedEntryCount: 42,
  pendingRequest: null,
};

const storesPage = {
  items: [
    { storeId: S1, storeName: "Cairo Festival City", snapshot, negativeItemCount: 2 },
    {
      storeId: S2,
      storeName: "Zamalek",
      snapshot: {
        ...snapshot,
        status: "no_snapshot",
        runId: null,
        readAt: null,
        recordedAt: null,
        reportedEntryCount: null,
      },
      negativeItemCount: 0,
    },
  ],
  nextCursor: null,
};

const storePage = {
  storeId: S1,
  snapshot,
  items: [
    {
      discrepancyKind: "erpnext_negative_on_hand",
      erpnextItemRef: { doctype: "Item", name: "ITM-0001" },
      mappingStatus: "mapped",
      tenantProduct: { id: "0190f000-0000-7000-8000-0000000000c1", name: "Panadol 500mg" },
      erpnextWarehouseRef: "Stores - NSR",
      quantity: "-3.000000",
      stockUom: "Nos",
    },
    {
      discrepancyKind: "erpnext_negative_on_hand",
      erpnextItemRef: { doctype: "Item", name: "ERP-ONLY-77" },
      mappingStatus: "unmapped",
      tenantProduct: null,
      erpnextWarehouseRef: "Stores - NSR",
      quantity: "-1.500000",
      stockUom: "Box",
    },
  ],
  nextCursor: null,
};

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

async function mockBase(page: Page, role: string): Promise<void> {
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx(role))));
  await page.route("**/api/v1/catalog/erpnext-reconciliation/negative-on-hand/stores**", (r) =>
    r.fulfill(json(storesPage)),
  );
  await page.route(
    `**/api/v1/catalog/erpnext-reconciliation/stores/${S1}/negative-on-hand**`,
    (r) => r.fulfill(json(storePage)),
  );
}

test("S1: tenant_admin → summary → store items verbatim → request fresh snapshot", async ({
  page,
}) => {
  await mockBase(page, "tenant_admin");
  let triggerKey: string | null = null;
  let triggerBody: unknown = null;
  await page.route("**/api/v1/catalog/erpnext-reconciliation/runs", (r) => {
    triggerKey = r.request().headers()["idempotency-key"] ?? null;
    triggerBody = r.request().postDataJSON();
    return r.fulfill(
      json(
        {
          id: "0190f000-0000-7000-8000-0000000000d1",
          storeId: S1,
          kind: "stock",
          trigger: "on_demand",
          status: "running",
          startedAt: "2026-10-04T08:10:00.000Z",
        },
        201,
      ),
    );
  });

  await page.goto("/");
  await page.getByRole("link", { name: /stock discrepancies/i }).click();
  await expect(page.getByRole("heading", { name: "ERPNext stock discrepancies" })).toBeVisible();
  const zamalek = page.getByRole("row", { name: /Zamalek/ });
  await expect(zamalek.getByRole("cell", { name: "Unknown" })).toBeVisible();

  await page.getByRole("link", { name: "Cairo Festival City" }).click();
  await expect(
    page.getByRole("heading", { name: `ERPNext snapshot as of ${READ_AT}` }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "-3.000000" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "-1.500000" })).toBeVisible();
  await expect(page.getByText("Not mapped", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Request fresh snapshot" }).click();
  await expect.poll(() => triggerKey).toMatch(/^[\x21-\x7E]{16,128}$/);
  expect(triggerBody).toEqual({ storeId: S1 });
});

test("S2: store_manager sees the nav entry but no refresh button", async ({ page }) => {
  await mockBase(page, "store_manager");
  await page.goto(`/stock-discrepancies/${S1}`);
  await expect(page.getByRole("link", { name: /stock discrepancies/i })).toBeVisible();
  await expect(page.getByRole("cell", { name: "-3.000000" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Request fresh snapshot" })).toHaveCount(0);
});

test("S3: cashier has no nav entry", async ({ page }) => {
  await mockBase(page, "cashier");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("link", { name: /stock discrepancies/i })).toHaveCount(0);
});

test("S4: per-store 404 renders not-found", async ({ page }) => {
  await mockBase(page, "store_manager");
  await page.route(
    `**/api/v1/catalog/erpnext-reconciliation/stores/${S2}/negative-on-hand**`,
    (r) => r.fulfill(json({ error: { code: "not_found", message: "Not found" } }, 404)),
  );
  await page.goto(`/stock-discrepancies/${S2}`);
  await expect(page.getByRole("heading", { name: "Store not found" })).toBeVisible();
});
