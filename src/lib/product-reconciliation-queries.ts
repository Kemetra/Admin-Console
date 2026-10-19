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

/** Whole seconds from a 429's `Retry-After` (1..3600), or undefined. */
function retryAfterOf(response: Response): number | undefined {
  if (response.status !== 429) return undefined;
  const seconds = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
  return Number.isNaN(seconds) ? undefined : seconds;
}

// --- Typed operation wrappers -------------------------------------------------

/** GET /api/v1/catalog/erpnext-product-reconciliation/backlog */
export async function listProductReconciliationBacklog(
  query: PageQuery & { class?: BacklogClass } = {},
) {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/catalog/erpnext-product-reconciliation/backlog",
    { params: { query } },
  );
  return { status: response.status, data, error, retryAfterSeconds: retryAfterOf(response) };
}

/** GET /api/v1/catalog/erpnext-product-reconciliation/runs (newest first). */
export async function listProductReconciliationRuns(query: PageQuery = {}) {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/catalog/erpnext-product-reconciliation/runs",
    { params: { query } },
  );
  return { status: response.status, data, error, retryAfterSeconds: retryAfterOf(response) };
}

/** POST /api/v1/catalog/erpnext-product-reconciliation/runs. v1 sends an empty body. */
export async function triggerProductReconciliationRun(idempotencyKey: string) {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/catalog/erpnext-product-reconciliation/runs",
    { params: { header: { "Idempotency-Key": idempotencyKey } }, body: {} },
  );
  return { status: response.status, data, error, retryAfterSeconds: retryAfterOf(response) };
}

/** GET /api/v1/catalog/erpnext-product-reconciliation/runs/{runId}/results */
export async function getProductReconciliationRunResults(
  runId: string,
  query: ClassPageQuery = {},
) {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/catalog/erpnext-product-reconciliation/runs/{runId}/results",
    { params: { path: { runId }, query } },
  );
  return { status: response.status, data, error, retryAfterSeconds: retryAfterOf(response) };
}

/** POST /api/v1/catalog/erpnext-product-reconciliation/repairs */
export async function repairProductMapping(
  body: RepairProductMappingRequest,
  idempotencyKey: string,
) {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/catalog/erpnext-product-reconciliation/repairs",
    { params: { header: { "Idempotency-Key": idempotencyKey } }, body },
  );
  return { status: response.status, data, error, retryAfterSeconds: retryAfterOf(response) };
}
