/**
 * RT-560 data layer (spec 016 Phase A): typed wrappers over the generated
 * `apiClient` for the five read-only operations of the ERP connection & sync
 * status surface. All are owner / tenant_admin, tenant-scoped, cookie-session.
 *
 *   - C1 `tenantAdminListConnectorInstances`: the tenant's registrations.
 *   - C2 `listConnectorHealth`: the read-derived liveness per registration.
 *   - C3 `consoleGetSyncOpsSummary`, `consoleListPostingBacklog`,
 *     `consoleListReconciliationRuns`: the sync-ops read model.
 *
 * Boundary: only these FIVE GETs are wrapped. The credential lifecycle (register
 * / issue / rotate / revoke / disable, Phase B), the machine heartbeat and the
 * posting repair ops (Phase C) are NOT wrapped and NOT called. Every call goes
 * to Backend-Core through the generated client; nothing reaches ERPNext or the
 * Connector. Same `{ status, data?, error? }` shape as the other wrappers.
 */
import { apiClient } from "@/generated/client";
import type {
  ConnectorAdminSchema,
  ConnectorHealthSchema,
  SyncOpsSchema,
} from "@/generated/schema";

type SyncOpsSchemas = SyncOpsSchema.components["schemas"];

// --- Generated projections (no hand-typed shapes) -----------------------------

export type ConnectorInstance = ConnectorAdminSchema.components["schemas"]["ConnectorInstance"];
export type ConnectorHealthView =
  ConnectorHealthSchema.components["schemas"]["ConnectorHealthView"];
export type ConnectorHealthList =
  ConnectorHealthSchema.components["schemas"]["ConnectorHealthList"];
export type Liveness = ConnectorHealthView["liveness"];
export type SyncOpsSummary = SyncOpsSchemas["SyncOpsSummary"];
export type DomainSummary = SyncOpsSchemas["DomainSummary"];
export type PostingBacklogPage = SyncOpsSchemas["PostingBacklogPage"];
export type PostingBacklogItem = SyncOpsSchemas["PostingBacklogItem"];
export type ReconciliationRunPage = SyncOpsSchemas["ReconciliationRunPage"];
export type ReconciliationRunView = SyncOpsSchemas["ReconciliationRunView"];

export interface StoreFilter {
  store_id?: string;
}

export interface PageQuery extends StoreFilter {
  cursor?: string;
  page_size?: number;
}

// --- Typed operation wrappers -------------------------------------------------

/** GET /api/v1/connector/instances (C1). */
export async function tenantAdminListConnectorInstances() {
  const { data, error, response } = await apiClient.GET("/api/v1/connector/instances", {});
  return { status: response.status, data, error };
}

/** GET /api/v1/connector/health (C2). */
export async function listConnectorHealth() {
  const { data, error, response } = await apiClient.GET("/api/v1/connector/health", {});
  return { status: response.status, data, error };
}

/** GET /api/v1/catalog/erpnext-sync-ops/summary (C3). */
export async function consoleGetSyncOpsSummary(query: StoreFilter = {}) {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/catalog/erpnext-sync-ops/summary",
    { params: { query } },
  );
  return { status: response.status, data, error };
}

/** GET /api/v1/catalog/erpnext-sync-ops/posting-backlog (C3, dead-letters only). */
export async function consoleListPostingBacklog(query: PageQuery = {}) {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/catalog/erpnext-sync-ops/posting-backlog",
    { params: { query } },
  );
  return { status: response.status, data, error };
}

/** GET /api/v1/catalog/erpnext-sync-ops/reconciliation-runs (C3, newest first). */
export async function consoleListReconciliationRuns(query: PageQuery = {}) {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/catalog/erpnext-sync-ops/reconciliation-runs",
    { params: { query } },
  );
  return { status: response.status, data, error };
}
