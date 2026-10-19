/**
 * RT-726 data layer: typed wrappers over the generated `apiClient` for the four
 * operations of the Backend-Core sale sync-ops contract
 * (`sale-sync-ops/sale-sync-ops.yaml`, spec 032 §9):
 *
 *   - `consoleGetSaleSyncStatus`: one sale's server-authoritative sync status.
 *   - `consoleGetSaleAuditTimeline`: the redacted sync timeline of one sale.
 *   - `consoleListNeedsRepair`: the open NEEDS_REPAIR queue, keyset paged.
 *   - `consoleRepairSaleSync`: the one write, a server-mediated repair of one
 *     NEEDS_REPAIR sale. `Idempotency-Key` is required; the caller owns the key.
 *
 * Boundary: Backend-Core only. No POS route, no ERP call. Same
 * `{ status, data?, error? }` shape as `src/lib/sale-queries.ts`, plus the
 * `Retry-After` seconds of a 429. Cookie transport is on the generated client.
 */
import { apiClient } from "@/generated/client";
import type { SaleSyncOpsSchema } from "@/generated/schema";

type Schemas = SaleSyncOpsSchema.components["schemas"];

// --- Generated projections (no hand-typed shapes) -----------------------------

export type SaleSyncStatus = Schemas["SaleSyncStatus"];
export type SyncStatusValue = Schemas["SyncStatusValue"];
export type DeadLetterDetail = Schemas["DeadLetterDetail"];
export type NeedsRepairItem = Schemas["NeedsRepairItem"];
export type NeedsRepairPage = Schemas["NeedsRepairPage"];
export type SaleAuditTimeline = Schemas["SaleAuditTimeline"];
export type AuditTimelineEntry = Schemas["AuditTimelineEntry"];
export type NeedsRepairQuery = NonNullable<
  SaleSyncOpsSchema.operations["consoleListNeedsRepair"]["parameters"]["query"]
>;

/** Whole seconds from a 429's `Retry-After`, when the server sent a usable one. */
function retryAfterOf(response: Response): number | undefined {
  if (response.status !== 429) return undefined;
  const seconds = Number(response.headers.get("Retry-After"));
  return Number.isInteger(seconds) && seconds > 0 ? seconds : undefined;
}

function resultOf<D, E>(res: { data?: D; error?: E; response: Response }) {
  return {
    status: res.response.status,
    data: res.data,
    error: res.error,
    retryAfter: retryAfterOf(res.response),
  };
}

// --- Typed operation wrappers -------------------------------------------------

/** GET /api/v1/catalog/sale-sync-ops/sales/{saleRef}/status */
export async function consoleGetSaleSyncStatus(saleRef: string) {
  return resultOf(
    await apiClient.GET("/api/v1/catalog/sale-sync-ops/sales/{saleRef}/status", {
      params: { path: { saleRef } },
    }),
  );
}

/** GET /api/v1/catalog/sale-sync-ops/sales/{saleRef}/audit-timeline */
export async function consoleGetSaleAuditTimeline(saleRef: string) {
  return resultOf(
    await apiClient.GET("/api/v1/catalog/sale-sync-ops/sales/{saleRef}/audit-timeline", {
      params: { path: { saleRef } },
    }),
  );
}

/** GET /api/v1/catalog/sale-sync-ops/needs-repair */
export async function consoleListNeedsRepair(query: NeedsRepairQuery) {
  return resultOf(
    await apiClient.GET("/api/v1/catalog/sale-sync-ops/needs-repair", {
      params: { query },
    }),
  );
}

/**
 * POST /api/v1/catalog/sale-sync-ops/sales/{saleRef}/repair. Sent once per
 * operator confirmation, never retried here. The same key replays the stored
 * outcome; the caller decides when a new key is due.
 */
export async function consoleRepairSaleSync(saleRef: string, idempotencyKey: string) {
  return resultOf(
    await apiClient.POST("/api/v1/catalog/sale-sync-ops/sales/{saleRef}/repair", {
      params: { path: { saleRef }, header: { "Idempotency-Key": idempotencyKey } },
    }),
  );
}
