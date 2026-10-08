/**
 * RT-178 data layer: typed wrappers over the generated `apiClient` for the
 * ERPNext negative on-hand read pair (RT-177) and the existing stock-run
 * trigger that serves as the "Request fresh snapshot" action.
 *
 *   - `listErpnextNegativeOnHandStores` — per-store summary (owner /
 *     tenant_admin / store_manager; store_manager is store-scoped server-side).
 *   - `listErpnextNegativeOnHand` — one store's negative items.
 *   - `triggerReconciliationRun` — owner / tenant_admin only; `Idempotency-Key`
 *     required (16–128 printable ASCII).
 *
 * Boundary: only these THREE ops of `erpnext-reconciliation/reconciliation.yaml`
 * are wrapped. The posting backlog / repair ops, run reads, and the stock-result
 * `re_sync` / `re_map` repair are NOT wrapped and NOT called (RT-178 non-goals).
 * Same `{ status, data?, error? }` shape as `src/lib/unknown-items-queries.ts`;
 * cookie transport is on the generated client. No hand-rolled fetch.
 */
import { apiClient } from "@/generated/client";
import type { ErpnextReconciliationSchema } from "@/generated/schema";

type Schemas = ErpnextReconciliationSchema.components["schemas"];

// --- Generated projections (no hand-typed shapes) -----------------------------

export type StockSnapshotStatus = Schemas["StockSnapshotStatus"];
export type PendingSnapshotRequest = Schemas["PendingSnapshotRequest"];
export type NegativeOnHandItem = Schemas["NegativeOnHandItem"];
export type StoreNegativeOnHandSummary = Schemas["StoreNegativeOnHandSummary"];
export type StoreNegativeOnHandSummaryPage = Schemas["StoreNegativeOnHandSummaryPage"];
export type StoreNegativeOnHandPage = Schemas["StoreNegativeOnHandPage"];
export type ReconciliationRun = Schemas["ReconciliationRun"];
export type SnapshotStatusCode = StockSnapshotStatus["status"];

export interface NegativeOnHandPageQuery {
  cursor?: string;
  limit?: number;
}

// --- Typed operation wrappers -------------------------------------------------

/** GET /api/v1/catalog/erpnext-reconciliation/negative-on-hand/stores */
export async function listErpnextNegativeOnHandStores(query: NegativeOnHandPageQuery = {}) {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/catalog/erpnext-reconciliation/negative-on-hand/stores",
    { params: { query } },
  );
  return { status: response.status, data, error };
}

/** GET /api/v1/catalog/erpnext-reconciliation/stores/{storeId}/negative-on-hand */
export async function listErpnextNegativeOnHand(
  storeId: string,
  query: NegativeOnHandPageQuery = {},
) {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/catalog/erpnext-reconciliation/stores/{storeId}/negative-on-hand",
    { params: { path: { storeId }, query } },
  );
  return { status: response.status, data, error };
}

/**
 * POST /api/v1/catalog/erpnext-reconciliation/runs — the existing on-demand
 * stock run. The Connector re-reads the store's ERPNext Bins on its next pull
 * and reports a new snapshot. `x-idempotency: required`.
 */
export async function triggerReconciliationRun(storeId: string, idempotencyKey: string) {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/catalog/erpnext-reconciliation/runs",
    {
      params: { header: { "Idempotency-Key": idempotencyKey } },
      body: { storeId },
    },
  );
  return { status: response.status, data, error, headers: response.headers };
}
