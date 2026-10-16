/**
 * RT-371 data layer: typed wrappers over the generated `apiClient` for the two
 * read operations of the Backend-Core console device registry (RT-365):
 *
 *   - `consoleListDevices`: the fleet, exception-first, keyset paged.
 *   - `consoleGetDevice`: one device with its revoke note and retire attribution.
 *
 * Boundary: only these TWO ops are wrapped. `consoleRevokeDevice` is in the
 * contract but belongs to RT-372 (lifecycle flows); nothing here writes. Same
 * `{ status, data?, error? }` shape as `src/lib/shift-close-queries.ts`; cookie
 * transport is on the generated client. No hand-rolled fetch.
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
