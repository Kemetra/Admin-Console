/**
 * Data layer for the Backend-Core console device registry: typed wrappers over
 * the generated `apiClient`.
 *
 *   - RT-371 reads: `consoleListDevices` (the fleet, exception-first, keyset
 *     paged) and `consoleGetDevice` (one device with its revoke note and retire
 *     attribution).
 *   - RT-372 lifecycle: `consoleGetDeviceImpact` (the read-only preview the
 *     console renders before every action), `consoleRevokeDevice` and
 *     `consoleRetireDevice`, and `consoleListPairingCodes` (the retire warning).
 *
 * Boundary: no DELETE (a device row is never removed) and no bulk operation.
 * Same `{ status, data?, error? }` shape as `src/lib/shift-close-queries.ts`;
 * cookie transport is on the generated client. No hand-rolled fetch.
 */
import { apiClient } from "@/generated/client";
import type { DevicesSchema } from "@/generated/schema";

type Schemas = DevicesSchema.components["schemas"];

// --- Generated projections (no hand-typed shapes) -----------------------------

export type DeviceSummary = Schemas["DeviceSummary"];
export type DeviceDetail = Schemas["DeviceDetail"];
export type DevicePage = Schemas["DevicePage"];
export type TrustState = Schemas["TrustState"];
export type RevokeReason = Schemas["RevokeReason"];
export type DeviceImpactPreview = Schemas["DeviceImpactPreview"];
export type DeviceLifecycleAction = Schemas["DeviceLifecycleAction"];
export type DeviceRevokeRequest = Schemas["DeviceRevokeRequest"];
export type DeviceRevokeResult = Schemas["DeviceRevokeResult"];
export type DeviceRetireResult = Schemas["DeviceRetireResult"];
export type PairingCodePage = Schemas["PairingCodePage"];
export type PairingCodeListQuery = NonNullable<
  DevicesSchema.operations["consoleListPairingCodes"]["parameters"]["query"]
>;
export type DeviceListQuery = NonNullable<
  DevicesSchema.operations["consoleListDevices"]["parameters"]["query"]
>;

// --- Typed operation wrappers -------------------------------------------------

/** GET /api/v1/devices */
export async function consoleListDevices(query: DeviceListQuery = {}) {
  const { data, error, response } = await apiClient.GET("/api/v1/devices", {
    params: { query },
  });
  return { status: response.status, data, error };
}

/** GET /api/v1/devices/{deviceId}: a refusal is the same non-disclosing 404. */
export async function consoleGetDevice(deviceId: string) {
  const { data, error, response } = await apiClient.GET("/api/v1/devices/{deviceId}", {
    params: { path: { deviceId } },
  });
  return { status: response.status, data, error };
}

/**
 * GET /api/v1/devices/{deviceId}/impact: what the action would do now, and the
 * server's verdict. `reason` is sent only for `revoke` (any other action with a
 * reason is a 400). A snapshot, not a reservation: the mutation decides again.
 */
export async function consoleGetDeviceImpact(
  deviceId: string,
  action: DeviceLifecycleAction,
  reason?: RevokeReason,
) {
  const { data, error, response } = await apiClient.GET("/api/v1/devices/{deviceId}/impact", {
    params: { path: { deviceId }, query: action === "revoke" ? { action, reason } : { action } },
  });
  return { status: response.status, data, error };
}

/** POST /api/v1/devices/{deviceId}/revoke: idempotent; a 409 carries the fresh preview. */
export async function consoleRevokeDevice(deviceId: string, body: DeviceRevokeRequest) {
  const { data, error, response } = await apiClient.POST("/api/v1/devices/{deviceId}/revoke", {
    params: { path: { deviceId } },
    body,
  });
  return { status: response.status, data, error };
}

/** POST /api/v1/devices/{deviceId}/retire: terminal and idempotent; a 409 carries the preview. */
export async function consoleRetireDevice(deviceId: string, retireReason: string) {
  const { data, error, response } = await apiClient.POST("/api/v1/devices/{deviceId}/retire", {
    params: { path: { deviceId } },
    body: { retireReason },
  });
  return { status: response.status, data, error };
}

/**
 * GET /api/v1/pairing-codes: the live pending codes in scope, newest first.
 * Read here so a retire of a revoked device can warn about the replacement
 * codes it would cancel; the code itself and its hash are never in the answer.
 */
export async function consoleListPairingCodes(query: PairingCodeListQuery = {}) {
  const { data, error, response } = await apiClient.GET("/api/v1/pairing-codes", {
    params: { query },
  });
  return { status: response.status, data, error };
}
