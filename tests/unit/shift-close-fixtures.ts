/** RT-18 shared test data: two stores in different zones and shift-close payloads. */

export const DUBAI_STORE = "0190f000-0000-7000-8000-0000000000a1";
export const NEW_YORK_STORE = "0190f000-0000-7000-8000-0000000000a2";
export const SHIFT_1 = "0190f000-0000-7000-8000-0000000000b1";
export const SHIFT_2 = "0190f000-0000-7000-8000-0000000000b2";
export const SHIFT_3 = "0190f000-0000-7000-8000-0000000000b3";
export const USER_A = "0190f000-0000-7000-8000-0000000000c1";
export const USER_B = "0190f000-0000-7000-8000-0000000000c2";
export const USER_C = "0190f000-0000-7000-8000-0000000000c3";

export const CLOSED_AT = "2026-10-07T20:30:00Z";
export const OPENED_AT = "2026-10-07T08:05:00Z";
export const RECEIVED_AT = "2026-10-07T20:31:12Z";

export const stores = [
  {
    id: DUBAI_STORE,
    code: "DXB",
    name: "Dubai Mall",
    timezone: "Asia/Dubai",
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

export function ctx(role = "owner", tenantId: string | null = "t1") {
  return {
    context: {
      active_tenant: tenantId ? { id: tenantId, name: "Northstar Retail" } : null,
      active_store: null,
      active_role_code: role,
    },
  };
}

export function summary(over: Record<string, unknown> = {}) {
  return {
    shiftId: SHIFT_1,
    storeId: DUBAI_STORE,
    currencyCode: "EGP",
    closedAt: CLOSED_AT,
    closeKind: "normal",
    forcedReason: null,
    closingUserId: USER_A,
    varianceApprovedByUserId: null,
    openingFloat: "500.0000",
    cashSalesTotal: "2500.0000",
    cashRefundsTotal: "100.0000",
    payInTotal: "0.0000",
    payOutTotal: "50.0000",
    expectedCash: "2850.0000",
    countedCash: "2875.0000",
    variance: "25.0000",
    saleCount: 42,
    receivedAt: RECEIVED_AT,
    ...over,
  };
}

export function detail(over: Record<string, unknown> = {}) {
  return {
    ...summary(),
    openedAt: OPENED_AT,
    openingUserId: USER_B,
    recordedByUserId: USER_C,
    cashRefundReturnRefs: ["RET-0001", "RET-0002"],
    cashMovements: [
      {
        movementId: "0190f000-0000-7000-8000-0000000000d1",
        kind: "pay_out",
        amount: "50.0000",
        reasonCode: "petty_expense",
        note: "Cleaning supplies",
        occurredAt: "2026-10-07T12:00:00Z",
        recordedByUserId: USER_A,
        receivedAt: "2026-10-07T12:00:05Z",
      },
    ],
    ...over,
  };
}

export function page(items: unknown[], nextCursor: string | null = null) {
  return { status: 200, data: { items, nextCursor } };
}

export function failure(status: number, requestId = "req-1") {
  return { status, error: { error: { code: "x", message: "y", request_id: requestId } } };
}
