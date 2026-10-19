/**
 * RT-727 data layer: typed wrappers over the generated `apiClient` for the five
 * operations of `catalog/product-reconciliation.yaml` (Backend-Core spec 021,
 * ERPNext product-master reconciliation). All five are owner / tenant_admin,
 * tenant-scoped (no store axis), cookie-session; any other role is the API's
 * non-disclosing 404.
 *
 *   - `listProductReconciliationBacklog`: the live unmapped-product backlog.
 *   - `listProductReconciliationRuns`: past runs, newest first.
 *   - `triggerProductReconciliationRun`: start an on-demand run.
 *     `Idempotency-Key` required.
 *   - `getProductReconciliationRunResults`: one run's classified results.
 *   - `repairProductMapping`: drive the 013 mapping lifecycle for one product.
 *     `Idempotency-Key` required.
 *
 * Every call goes to Backend-Core through the generated client; nothing reaches
 * ERPNext or the Connector. Same `{ status, data?, error? }` shape as the other
 * wrappers, plus the parsed `Retry-After` of a 429 (RT-574) so a caller can say
 * when to try again. Nothing here retries.
 */
import { apiClient } from "@/generated/client";
import type { ProductReconciliationSchema } from "@/generated/schema";
import { classifyRateLimit } from "@/lib/rate-limit";

type Schemas = ProductReconciliationSchema.components["schemas"];

// --- Generated projections (no hand-typed shapes) -----------------------------

export type BacklogItem = Schemas["BacklogItem"];
export type BacklogPage = Schemas["BacklogPage"];
export type ProductReconciliationRun = Schemas["ProductReconciliationRun"];
export type RunPage = Schemas["RunPage"];
export type ProductReconciliationResult = Schemas["ProductReconciliationResult"];
export type ResultPage = Schemas["ResultPage"];
export type RepairProductMappingRequest = Schemas["RepairProductMappingRequest"];
export type RecordedProductRepair = Schemas["RecordedProductRepair"];
export type MismatchClass = ProductReconciliationResult["mismatchClass"];
export type BacklogClass = BacklogItem["mismatchClass"];

export interface PageQuery {
  cursor?: string;
  limit?: number;
}

export interface ClassPageQuery extends PageQuery {
  class?: MismatchClass;
}

/** A 429's wait in seconds via the shared RT-621 classifier (30 s fallback, [1, 3600]). */
function retryAfterOf(response: Response): number | undefined {
  return classifyRateLimit({
    status: response.status,
    retryAfter: response.headers.get("retry-after"),
  })?.retryAfterSeconds;
}

/** What the generated client resolves to, for any operation. */
interface Fetched {
  data?: unknown;
  error?: unknown;
  response: Response;
}

/** The uniform wrapper shape for one settled call. */
async function settle<R extends Fetched>(call: Promise<R>) {
  const { data, error, response } = await call;
  return {
    status: response.status,
    data: data as R["data"],
    error: error as R["error"],
    retryAfterSeconds: retryAfterOf(response),
  };
}

// --- Typed operation wrappers -------------------------------------------------

/** GET /api/v1/catalog/erpnext-product-reconciliation/backlog */
export function listProductReconciliationBacklog(query: PageQuery & { class?: BacklogClass } = {}) {
  return settle(
    apiClient.GET("/api/v1/catalog/erpnext-product-reconciliation/backlog", { params: { query } }),
  );
}

/** GET /api/v1/catalog/erpnext-product-reconciliation/runs (newest first). */
export function listProductReconciliationRuns(query: PageQuery = {}) {
  return settle(
    apiClient.GET("/api/v1/catalog/erpnext-product-reconciliation/runs", { params: { query } }),
  );
}

/** POST /api/v1/catalog/erpnext-product-reconciliation/runs. v1 sends an empty body. */
export function triggerProductReconciliationRun(idempotencyKey: string) {
  return settle(
    apiClient.POST("/api/v1/catalog/erpnext-product-reconciliation/runs", {
      params: { header: { "Idempotency-Key": idempotencyKey } },
      body: {},
    }),
  );
}

/** GET /api/v1/catalog/erpnext-product-reconciliation/runs/{runId}/results */
export function getProductReconciliationRunResults(runId: string, query: ClassPageQuery = {}) {
  return settle(
    apiClient.GET("/api/v1/catalog/erpnext-product-reconciliation/runs/{runId}/results", {
      params: { path: { runId }, query },
    }),
  );
}

/** POST /api/v1/catalog/erpnext-product-reconciliation/repairs */
export function repairProductMapping(body: RepairProductMappingRequest, idempotencyKey: string) {
  return settle(
    apiClient.POST("/api/v1/catalog/erpnext-product-reconciliation/repairs", {
      params: { header: { "Idempotency-Key": idempotencyKey } },
      body,
    }),
  );
}
