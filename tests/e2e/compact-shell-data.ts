import type { Page } from "./fixtures";

/**
 * RT-825: realistic mocked Backend-Core data for the compact-shell overflow
 * check (C-5). Long Arabic names, machine refs (UUIDs, codes) and one row per
 * list, in the shapes the sales, devices, shift-closes, sale-sync, unknown-items
 * and audit specs use, so each Tier 1 route is measured with content, not in
 * an empty or error state.
 */

export const LONG_NAME = "محمد عبد الرحمن السيد";
export const LONG_TENANT = "نورثستار للتجزئة والتوزيع";
export const STORE = "0190f000-0000-7000-8000-0000000005a1";
export const SALE = "0190f000-0000-7000-8000-0000000005b1";
export const DEVICE = "0190f000-0000-7000-8000-0000000000a1";
export const SHIFT = "0190f000-0000-7000-8000-0000000000c1";
const LINE = "0190f000-0000-7000-8000-0000000005e1";
const USER = "0190f000-0000-7000-8000-0000000000e1";

export const user = {
  id: "u1",
  email: "mohamed.abdelrahman@northstar-retail.eg",
  display_name: LONG_NAME,
  is_platform_admin: true,
};

const storeName = "فرع كايرو فستيفال سيتي مول التجمع الخامس";

export const store = {
  id: STORE,
  tenant_id: "t1",
  code: "CFC-1000",
  name: storeName,
  timezone: "Africa/Cairo",
  is_active: true,
};

export const context = {
  user,
  active_tenant: { id: "t1", name: LONG_TENANT },
  active_store: { id: STORE, name: storeName },
  active_role_code: "tenant_admin",
  memberships: [{ tenant_id: "t1", tenant_name: LONG_TENANT, role_code: "tenant_admin" }],
};

const saleItem = {
  saleRef: SALE,
  storeRef: STORE,
  saleNumber: "R-0042-CFC-1000",
  businessDate: "2026-10-07",
  occurredAt: "2026-10-07T10:30:00Z",
  receivedAt: "2026-10-07T10:30:04Z",
  device: { deviceRef: null, label: "كاشير المدخل الرئيسي 1", labelSource: "snapshot" },
  operator: { userRef: null, displayName: LONG_NAME, nameSource: "snapshot" },
  currencyCode: "EGP",
  posTotal: "12345.5000",
  syncStatus: "synced",
  voided: false,
  returnState: "partial",
  erpPostingState: "unknown",
};

const saleDetail = {
  summary: saleItem,
  storeTimezone: "Africa/Cairo",
  lines: [
    {
      lineRef: LINE,
      sequence: 1,
      lineName: "مياه معدنية طبيعية عبوة عائلية كبيرة 1.5 لتر",
      unitPrice: "10.0000",
      currencyCode: "EGP",
      quantity: "3",
      lineAmount: "30.0000",
      taxAmount: null,
      unit: "bottle",
      returnedQuantity: "1",
    },
  ],
  lineOrder: "recorded",
  tenderState: "recorded",
  tenders: [
    { method: "cash", amount: "12000.0000", reference: null, sequence: 1 },
    {
      method: "card_external",
      amount: "345.5000",
      reference: "AUTH-7781-NORTHSTAR-0042",
      sequence: 2,
    },
  ],
  changeGiven: "0.0000",
  settledAt: "2026-10-07T10:30:00Z",
  receiptNumber: "R-0042-CFC-1000",
  receiptHeader: null,
  void: null,
  returns: [
    {
      returnRef: "0190f000-0000-7000-8000-0000000005f1",
      recordedAt: "2026-10-07T10:50:00Z",
      businessDate: "2026-10-07",
      returnTotal: "10.0000",
      lines: [{ lineRef: LINE, quantity: "1", lineAmount: "10.0000" }],
    },
  ],
  erpPosting: {
    sale: "unknown",
    saleDocumentRef: null,
    reversal: "unknown",
    reversalDocumentRef: null,
  },
};

const device = {
  deviceId: DEVICE,
  storeId: STORE,
  label: "كاشير المدخل الرئيسي 1",
  trustState: "active",
  createdAt: "2026-07-01T09:00:00Z",
  expiresAt: "2099-01-01T00:00:00Z",
  lastSeenAt: null,
  lastSeenSource: null,
  revokedAt: null,
  revokedByUserId: null,
  revokeReason: null,
  retiredAt: null,
  replacesDeviceId: null,
  replacedByDeviceId: null,
  custodyExceptionShiftId: null,
};

const shift = {
  shiftId: SHIFT,
  storeId: STORE,
  currencyCode: "EGP",
  closedAt: "2026-10-07T20:30:00Z",
  closeKind: "normal",
  forcedReason: null,
  closingUserId: USER,
  varianceApprovedByUserId: null,
  openingFloat: "500.0000",
  cashSalesTotal: "25000.0000",
  cashRefundsTotal: "100.0000",
  payInTotal: "0.0000",
  payOutTotal: "50.0000",
  expectedCash: "25350.0000",
  countedCash: "25375.0000",
  variance: "25.0000",
  saleCount: 42,
  receivedAt: "2026-10-07T20:31:12Z",
};

const shiftDetail = {
  ...shift,
  openedAt: "2026-10-07T08:05:00Z",
  openingUserId: USER,
  recordedByUserId: USER,
  cashRefundReturnRefs: [],
  cashMovements: [],
};

const queueItem = { ...saleItem, syncStatus: "failed-needs-repair" };

const unknownItem = {
  id: "u1",
  tenant_id: "t1",
  store_id: STORE,
  identifier_type: "barcode",
  identifier_value: "5012345678900123",
  source_system: null,
  resolution_status: "pending",
  resolution_action: null,
  resolved_at: null,
  resolved_by: null,
  encountered_at: "2026-06-10T10:00:00Z",
};

const json = (body: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(body),
});

/** Routes registered later win in Playwright, so the generic answers go first. */
export async function mockRealisticApi(page: Page, ctx: unknown = context): Promise<void> {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill(json(r.request().url().includes("?") ? { items: [], nextCursor: null } : {})),
  );
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx)));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json([store])));
  await page.route(`**/api/v1/stores/${STORE}`, (r) => r.fulfill(json(store)));
  await page.route("**/api/v1/sales?**", (r) =>
    r.fulfill(
      json({
        items: [saleItem],
        nextCursor: null,
        asOf: "2026-10-08T09:15:00Z",
        storeRef: STORE,
        storeTimezone: "Africa/Cairo",
      }),
    ),
  );
  await page.route(`**/api/v1/sales/${SALE}`, (r) => r.fulfill(json(saleDetail)));
  await page.route("**/api/v1/catalog/sale-sync-ops/needs-repair**", (r) =>
    r.fulfill(json({ items: [queueItem], nextCursor: null })),
  );
  await page.route("**/api/v1/devices?**", (r) =>
    r.fulfill(json({ items: [device], nextCursor: null })),
  );
  await page.route(`**/api/v1/devices/${DEVICE}`, (r) => r.fulfill(json(device)));
  await page.route("**/api/v1/shift-closes?**", (r) =>
    r.fulfill(json({ items: [shift], nextCursor: null })),
  );
  await page.route(`**/api/v1/shift-closes/${SHIFT}`, (r) => r.fulfill(json(shiftDetail)));
  await page.route("**/api/v1/catalog/unknown-items?*", (r) =>
    r.fulfill(json({ items: [unknownItem], next_cursor: null })),
  );
}

/** Tier 1 routes (13206), with the ids the mocks above answer. */
export const TIER1 = [
  "/",
  "/stores",
  `/stores/${STORE}`,
  "/sales",
  `/sales/${SALE}`,
  "/sales-needing-repair",
  "/devices",
  `/devices/${DEVICE}`,
  "/shift-closes",
  `/shift-closes/${SHIFT}`,
  "/unknown-items",
  "/audit",
];
