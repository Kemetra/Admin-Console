/** RT-372 part B test data: pairing codes. */
import { DEVICE_1, DUBAI_STORE } from "./device-fixtures";

export const CODE_ID = "0190f000-0000-7000-8000-0000000000d1";
export const TERMINAL_ID = "0190f000-0000-7000-8000-0000000000f1";
export const SECRET_CODE = "FAKE-TEST-CODE-0000";

/** The 201 body of an issue: the one place the secret code appears. */
export function issued(over: Record<string, unknown> = {}) {
  return {
    pairingCodeId: CODE_ID,
    code: SECRET_CODE,
    kind: "replace",
    storeId: DUBAI_STORE,
    terminalId: TERMINAL_ID,
    terminalLabel: "Counter 2",
    replacesDeviceId: DEVICE_1,
    expiresAt: "2026-10-17T11:00:00Z",
    createdAt: "2026-10-17T10:30:00Z",
    ...over,
  };
}

/** A pending code as listed: never the code or its hash. */
export function pending(over: Record<string, unknown> = {}) {
  return {
    pairingCodeId: CODE_ID,
    kind: "replace",
    storeId: DUBAI_STORE,
    terminalId: TERMINAL_ID,
    terminalLabel: "Counter 2",
    status: "pending",
    replacesDeviceId: DEVICE_1,
    expiresAt: "2099-01-01T00:00:00Z",
    createdAt: "2026-10-17T09:00:00Z",
    ...over,
  };
}
