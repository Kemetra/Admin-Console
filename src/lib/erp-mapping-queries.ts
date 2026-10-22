/**
 * RT-725 data layer: typed wrappers over the generated `apiClient` for the
 * ERPNext item and warehouse mapping operations Backend-Core serves
 * (`catalog/erpnext-item-map.yaml`, `catalog/erpnext-warehouse-map.yaml`). All
 * are owner / tenant_admin, tenant-scoped, cookie-session; a wrong role is the
 * API's non-disclosing 404.
 *
 *   - Items: `tenantAdminListErpnextItemMappings`,
 *     `tenantAdminSuggestErpnextItemMapping` (for a product picked in the shared
 *     catalog picker, RT-767, or the product of a row just retired),
 *     `tenantAdminConfirmErpnextItemMapping`, `tenantAdminRetireErpnextItemMapping`.
 *   - Warehouses: `tenantAdminListErpnextWarehouseMappings`,
 *     `tenantAdminSetErpnextWarehouseMapping`,
 *     `tenantAdminRetireErpnextWarehouseMapping`.
 *
 * Every call goes to Backend-Core; nothing reaches ERPNext or the Connector.
 * Same `{ status, data?, error? }` shape as the other wrappers, plus the
 * `Retry-After` seconds a console 429 carries. A mutation is sent once: no
 * wrapper retries, and a request that never got an answer rejects (the caller
 * reads that as an unknown outcome).
 */
import { apiClient } from "@/generated/client";
import type { ErpnextItemMapSchema, ErpnextWarehouseMapSchema } from "@/generated/schema";
import { classifyRateLimit } from "@/lib/rate-limit";

type ItemSchemas = ErpnextItemMapSchema.components["schemas"];
type WarehouseSchemas = ErpnextWarehouseMapSchema.components["schemas"];

// --- Generated projections (no hand-typed shapes) -----------------------------

export type ErpnextItemMapping = ItemSchemas["ErpnextItemMapping"];
export type ItemMappingState = ErpnextItemMapping["state"];
export type SuggestItemMappingRequest = ItemSchemas["SuggestErpnextItemMappingRequest"];
export type ErpnextWarehouseMapping = WarehouseSchemas["ErpnextWarehouseMapping"];
export type SetWarehouseMappingRequest = WarehouseSchemas["SetErpnextWarehouseMappingRequest"];

/** What every wrapper returns. `retryAfter` is the 429 wait in seconds, when sent. */
export interface MappingResult<P> {
  status: number;
  data?: P;
  error?: unknown;
  retryAfter?: number;
}

function withRetryAfter<P>(status: number, data: P | undefined, error: unknown, res: Response) {
  const result: MappingResult<P> = { status, data, error };
  // The shared RT-621 classifier: 429 only, 30 s fallback, clamped to [1, 3600].
  const wait = classifyRateLimit({
    status,
    retryAfter: res.headers.get("Retry-After"),
  })?.retryAfterSeconds;
  if (wait !== undefined) result.retryAfter = wait;
  return result;
}

// --- Item mappings ---------------------------------------------------------------

/** GET /api/v1/catalog/erpnext-item-mappings[?state=]. */
export async function tenantAdminListErpnextItemMappings(state?: ItemMappingState) {
  const { data, error, response } = await apiClient.GET("/api/v1/catalog/erpnext-item-mappings", {
    params: { query: state ? { state } : {} },
  });
  return withRetryAfter(response.status, data, error, response);
}

/** POST /api/v1/catalog/erpnext-item-mappings: a manual, inert suggestion. */
export async function tenantAdminSuggestErpnextItemMapping(body: SuggestItemMappingRequest) {
  const { data, error, response } = await apiClient.POST("/api/v1/catalog/erpnext-item-mappings", {
    body,
  });
  return withRetryAfter(response.status, data, error, response);
}

/** POST /api/v1/catalog/erpnext-item-mappings/{id}/confirm with the observed version. */
export async function tenantAdminConfirmErpnextItemMapping(id: string, version: number) {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/catalog/erpnext-item-mappings/{id}/confirm",
    { params: { path: { id } }, body: { version } },
  );
  return withRetryAfter(response.status, data, error, response);
}

/** POST /api/v1/catalog/erpnext-item-mappings/{id}/retire with the observed version. */
export async function tenantAdminRetireErpnextItemMapping(id: string, version: number) {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/catalog/erpnext-item-mappings/{id}/retire",
    { params: { path: { id } }, body: { version } },
  );
  return withRetryAfter(response.status, data, error, response);
}

// --- Warehouse mappings ------------------------------------------------------------

/** GET /api/v1/catalog/erpnext-warehouse-mappings. */
export async function tenantAdminListErpnextWarehouseMappings() {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/catalog/erpnext-warehouse-mappings",
    {},
  );
  return withRetryAfter(response.status, data, error, response);
}

/** POST /api/v1/catalog/erpnext-warehouse-mappings: store → ERPNext Warehouse. */
export async function tenantAdminSetErpnextWarehouseMapping(body: SetWarehouseMappingRequest) {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/catalog/erpnext-warehouse-mappings",
    { body },
  );
  return withRetryAfter(response.status, data, error, response);
}

/** POST /api/v1/catalog/erpnext-warehouse-mappings/{id}/retire with the observed version. */
export async function tenantAdminRetireErpnextWarehouseMapping(id: string, version: number) {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/catalog/erpnext-warehouse-mappings/{id}/retire",
    { params: { path: { id } }, body: { version } },
  );
  return withRetryAfter(response.status, data, error, response);
}
