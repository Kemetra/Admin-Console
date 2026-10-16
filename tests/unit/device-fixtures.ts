/** RT-371 shared test data: two stores in different zones and device payloads. */

export const DUBAI_STORE = "0190f000-0000-7000-8000-0000000000a1";
export const NEW_YORK_STORE = "0190f000-0000-7000-8000-0000000000a2";
/** A store the caller's roster does not list (outside a store manager's scope). */
export const OTHER_STORE = "0190f000-0000-7000-8000-0000000000a9";
export const DEVICE_1 = "0190f000-0000-7000-8000-0000000000e1";
export const DEVICE_2 = "0190f000-0000-7000-8000-0000000000e2";
export const DEVICE_3 = "0190f000-0000-7000-8000-0000000000e3";
export const SHIFT_OPEN = "0190f000-0000-7000-8000-0000000000b9";
export const USER_A = "0190f000-0000-7000-8000-0000000000c1";
export const USER_B = "0190f000-0000-7000-8000-0000000000c2";

export const CREATED_AT = "2026-07-01T09:00:00Z";
/** Far in the future, so "expiry passed" never depends on the test clock. */
export const EXPIRES_FUTURE = "2099-01-01T00:00:00Z";
/** Long past: an active device with this expiry shows "expiry passed". */
export const EXPIRES_PAST = "2020-01-01T00:00:00Z";
export const REVOKED_AT = "2026-10-10T12:00:00Z";
export const RETIRED_AT = "2026-10-12T08:00:00Z";
export const SEEN_AT = "2026-10-15T18:45:00Z";

export const stores = [
  { id: DUBAI_STORE, code: "DXB", name: "Dubai Mall", timezone: "Asia/Dubai", is_active: true },
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
    deviceId: DEVICE_1,
    storeId: DUBAI_STORE,
    label: "Till 1",
    trustState: "active",
    createdAt: CREATED_AT,
    expiresAt: EXPIRES_FUTURE,
    lastSeenAt: null,
    lastSeenSource: null,
    revokedAt: null,
    revokedByUserId: null,
    revokeReason: null,
    retiredAt: null,
    replacesDeviceId: null,
    replacedByDeviceId: null,
    custodyExceptionShiftId: null,
    ...over,
  };
}

/** A revoked device whose open shift is the custody exception (rank 0). */
export function custodySummary(over: Record<string, unknown> = {}) {
  return summary({
    deviceId: DEVICE_2,
    label: "Till 2",
    trustState: "revoked",
    revokedAt: REVOKED_AT,
    revokedByUserId: USER_A,
    revokeReason: "stolen",
    custodyExceptionShiftId: SHIFT_OPEN,
    ...over,
  });
}

export function detail(over: Record<string, unknown> = {}) {
  return {
    ...summary(),
    revokeNote: null,
    retiredByUserId: null,
    retireReason: null,
    ...over,
  };
}

export function page(items: unknown[], nextCursor: string | null = null) {
  return { status: 200, data: { items, nextCursor } };
}

export function failure(status: number, requestId = "req-1") {
  return { status, error: { error: { code: "x", message: "y", request_id: requestId } } };
}
