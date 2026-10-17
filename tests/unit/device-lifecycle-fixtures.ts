/** RT-372 shared test data: impact previews and lifecycle results. */
import { DEVICE_1, SHIFT_OPEN, USER_A, detail } from "./device-fixtures";

export const NOW = "2026-10-17T10:00:00Z";

/** An impact preview for an active device with nothing in the way (verdict allowed). */
export function impact(over: Record<string, unknown> = {}) {
  return {
    deviceId: DEVICE_1,
    action: "revoke",
    revokeReason: "lost",
    trustState: "active",
    verdict: "allowed",
    blockCode: null,
    requires: [],
    openShift: null,
    custodyExceptionShiftId: null,
    cascade: { operatorSessionCount: 2, pendingPairingCodeCount: 1 },
    replacesDeviceId: null,
    replacedByDeviceId: null,
    evaluatedAt: NOW,
    ...over,
  };
}

/** The open shift block of a preview, `cash_up` with received facts by default. */
export function openShift(over: Record<string, unknown> = {}) {
  return {
    shiftId: SHIFT_OPEN,
    source: "cash_up",
    openedAt: "2026-10-17T07:30:00Z",
    openingCashierUserId: USER_A,
    cashFacts: {
      view: "server_received",
      receivedCount: 3,
      lastReceivedAt: "2026-10-17T09:40:00Z",
    },
    ...over,
  };
}

/** A `{ status, data }` wrapper result for a 200 revoke. */
export function revoked(over: Record<string, unknown> = {}, outcome = "revoked") {
  return {
    status: 200,
    data: {
      outcome,
      device: detail({
        trustState: "revoked",
        revokedAt: "2026-10-17T10:00:00Z",
        revokedByUserId: USER_A,
        revokeReason: "lost",
        ...over,
      }),
    },
  };
}

export function retired(over: Record<string, unknown> = {}, outcome = "retired") {
  return {
    status: 200,
    data: {
      outcome,
      device: detail({
        trustState: "retired",
        revokedAt: "2026-10-17T10:00:00Z",
        retiredAt: "2026-10-17T10:00:00Z",
        retiredByUserId: USER_A,
        retireReason: "End of life",
        revokeReason: "retired",
        ...over,
      }),
    },
  };
}

export function conflict(code: string, details?: unknown, requestId = "req-409") {
  return {
    status: 409,
    error: {
      error: { code, message: "refused", request_id: requestId, ...(details ? { details } : {}) },
    },
  };
}
