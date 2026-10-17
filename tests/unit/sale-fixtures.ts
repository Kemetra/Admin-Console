/** RT-587 shared test data: a Cairo and a New York store, and console sales payloads. */

export const CAIRO_STORE = "0190f000-0000-7000-8000-0000000005a1";
export const NEW_YORK_STORE = "0190f000-0000-7000-8000-0000000005a2";
export const SALE_1 = "0190f000-0000-7000-8000-0000000005b1";
export const SALE_2 = "0190f000-0000-7000-8000-0000000005b2";
export const DEVICE_1 = "0190f000-0000-7000-8000-0000000005c1";
export const USER_1 = "0190f000-0000-7000-8000-0000000005d1";
export const LINE_1 = "0190f000-0000-7000-8000-0000000005e1";
export const LINE_2 = "0190f000-0000-7000-8000-0000000005e2";
export const RETURN_1 = "0190f000-0000-7000-8000-0000000005f1";

export const AS_OF = "2026-10-08T09:15:00Z";

export const stores = [
  {
    id: CAIRO_STORE,
    code: "CAI",
    name: "Cairo Festival",
    timezone: "Africa/Cairo",
    is_active: true,
  },
  {
    id: NEW_YORK_STORE,
    code: "NYC",
    name: "Fifth Avenue",
    timezone: "America/New_York",
    is_active: true,
  },
];

export function ctx(role = "owner", tenantId: string | null = "t1", activeStoreId?: string) {
  return {
    context: {
      active_tenant: tenantId ? { id: tenantId, name: "Northstar Retail" } : null,
      active_store: activeStoreId ? { id: activeStoreId, name: "Cairo Festival" } : null,
      active_role_code: role,
    },
  };
}

export function item(over: Record<string, unknown> = {}) {
  return {
    saleRef: SALE_1,
    storeRef: CAIRO_STORE,
    saleNumber: "R-0042",
    businessDate: "2026-10-07",
    occurredAt: "2026-10-07T10:30:00Z",
    receivedAt: "2026-10-07T10:30:04Z",
    device: { deviceRef: DEVICE_1, label: "Till 1", labelSource: "snapshot" },
    operator: { userRef: USER_1, displayName: "Mona Adel", nameSource: "snapshot" },
    currencyCode: "EGP",
    posTotal: "250.0000",
    syncStatus: "synced",
    voided: false,
    returnState: "none",
    erpPostingState: "posted",
    ...over,
  };
}

export function line(over: Record<string, unknown> = {}) {
  return {
    lineRef: LINE_1,
    sequence: 1,
    lineName: "Mineral water 1.5L",
    unitPrice: "10.0000",
    currencyCode: "EGP",
    quantity: "3",
    lineAmount: "30.0000",
    taxAmount: "4.2000",
    unit: "bottle",
    returnedQuantity: "0",
    ...over,
  };
}

export function detail(over: Record<string, unknown> = {}) {
  return {
    summary: item(),
    storeTimezone: "Africa/Cairo",
    lines: [
      line(),
      line({
        lineRef: LINE_2,
        sequence: 2,
        lineName: "Dates 500g",
        unitPrice: "220.0000",
        quantity: "1",
        lineAmount: "220.0000",
        taxAmount: null,
        unit: "pack",
      }),
    ],
    lineOrder: "recorded",
    tenderState: "recorded",
    tenders: [
      { method: "cash", amount: "200.0000", reference: null, sequence: 1 },
      { method: "card_external", amount: "50.0000", reference: "AUTH-7781", sequence: 2 },
    ],
    changeGiven: "0.0000",
    settledAt: "2026-10-07T10:30:00Z",
    receiptNumber: "R-0042",
    receiptHeader: {
      branchName: "Cairo Festival",
      branchAddress: "90th St, New Cairo",
      taxRegistrationId: "TRN-123-456",
    },
    void: null,
    returns: [],
    erpPosting: {
      sale: "posted",
      saleDocumentRef: "ACC-SINV-2026-00042",
      reversal: null,
      reversalDocumentRef: null,
    },
    ...over,
  };
}

export function page(items: unknown[], nextCursor: string | null = null, over = {}) {
  return {
    status: 200,
    data: {
      items,
      nextCursor,
      asOf: AS_OF,
      storeRef: CAIRO_STORE,
      storeTimezone: "Africa/Cairo",
      from: "2026-10-01",
      to: "2026-10-07",
      ...over,
    },
  };
}

export function failure(status: number, requestId = "req-1") {
  return { status, error: { error: { code: "x", message: "y", request_id: requestId } } };
}
