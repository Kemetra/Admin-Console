/**
 * RT-389 data layer: typed wrappers over the generated `apiClient` for the six
 * Console operations of the shift variance policy contract (RT-384, runtime
 * RT-387):
 *
 *   - tenant default: read, list revisions, publish (Apply Now);
 *   - store override: read, list revisions, publish (set or clear).
 *
 * Boundary: `posGetCashVariancePolicy` (the POS terminal read) is in the same
 * document and is NOT wrapped. Inheritance is Backend-Core's (K-9): nothing here
 * resolves, merges or compares policies. Publishes are `x-idempotency:
 * required`, so they take the key and return the response headers. Same
 * `{ status, data?, error? }` shape as `src/lib/sale-queries.ts`; cookie
 * transport is on the generated client. No hand-rolled fetch.
 */
import { apiClient } from "@/generated/client";
import type { CashVariancePolicySchema } from "@/generated/schema";

type Schemas = CashVariancePolicySchema.components["schemas"];

// --- Generated projections (no hand-typed shapes) -----------------------------

export type CashVariancePolicyValue = Schemas["CashVariancePolicyValue"];
export type ResolvedCashVariancePolicy = Schemas["ResolvedCashVariancePolicy"];
export type TenantResolvedCashVariancePolicy = Schemas["TenantResolvedCashVariancePolicy"];
export type TenantCashVariancePolicy = Schemas["TenantCashVariancePolicy"];
export type StoreCashVariancePolicy = Schemas["StoreCashVariancePolicy"];
export type ActiveStoreOverride = Schemas["ActiveStoreOverride"];
export type CashVariancePolicyRevision = Schemas["CashVariancePolicyRevision"];
export type TenantRevisionPage = Schemas["TenantCashVariancePolicyRevisionPage"];
export type StoreRevisionPage = Schemas["StoreCashVariancePolicyRevisionPage"];
export type PublishTenantBody = Schemas["PublishTenantCashVariancePolicyRequest"];
export type PublishStoreBody = Schemas["PublishStoreCashVariancePolicyOverrideRequest"];
export type PolicySource = Schemas["PolicySource"];

/** Cursor + page size of a revision list (both optional). */
export interface RevisionQuery {
  cursor?: string;
  page_size?: number;
}

// --- Typed operation wrappers -------------------------------------------------

/** GET /api/v1/tenants/{tenant_id}/cash-variance-policy (owner / tenant_admin). */
export async function consoleGetTenantCashVariancePolicy(tenantId: string) {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/tenants/{tenant_id}/cash-variance-policy",
    { params: { path: { tenant_id: tenantId } } },
  );
  return { status: response.status, data, error };
}

/** GET /api/v1/tenants/{tenant_id}/cash-variance-policy/revisions: newest first, keyset paged. */
export async function consoleListTenantCashVariancePolicyRevisions(
  tenantId: string,
  query: RevisionQuery = {},
) {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/tenants/{tenant_id}/cash-variance-policy/revisions",
    { params: { path: { tenant_id: tenantId }, query } },
  );
  return { status: response.status, data, error };
}

/** POST /api/v1/tenants/{tenant_id}/cash-variance-policy/revisions. `x-idempotency: required`. */
export async function consolePublishTenantCashVariancePolicy(
  tenantId: string,
  body: PublishTenantBody,
  idempotencyKey: string,
) {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/tenants/{tenant_id}/cash-variance-policy/revisions",
    {
      params: { path: { tenant_id: tenantId }, header: { "Idempotency-Key": idempotencyKey } },
      body,
    },
  );
  return { status: response.status, data, error, headers: response.headers };
}

/** GET /api/v1/stores/{store_id}/cash-variance-policy (owner / tenant_admin / store_manager). */
export async function consoleGetStoreCashVariancePolicy(storeId: string) {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/stores/{store_id}/cash-variance-policy",
    { params: { path: { store_id: storeId } } },
  );
  return { status: response.status, data, error };
}

/** GET /api/v1/stores/{store_id}/cash-variance-policy/revisions: newest first, keyset paged. */
export async function consoleListStoreCashVariancePolicyRevisions(
  storeId: string,
  query: RevisionQuery = {},
) {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/stores/{store_id}/cash-variance-policy/revisions",
    { params: { path: { store_id: storeId }, query } },
  );
  return { status: response.status, data, error };
}

/**
 * POST /api/v1/stores/{store_id}/cash-variance-policy/revisions: set or clear
 * the store override. `x-idempotency: required`.
 */
export async function consolePublishStoreCashVariancePolicyOverride(
  storeId: string,
  body: PublishStoreBody,
  idempotencyKey: string,
) {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/stores/{store_id}/cash-variance-policy/revisions",
    {
      params: { path: { store_id: storeId }, header: { "Idempotency-Key": idempotencyKey } },
      body,
    },
  );
  return { status: response.status, data, error, headers: response.headers };
}
