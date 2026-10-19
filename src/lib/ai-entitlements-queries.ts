/**
 * RT-665 data layer: one typed wrapper over the generated `apiClient` for the
 * single AI entitlements operation the Console reads (RT-662 contract #865,
 * runtime RT-664, not built yet):
 *
 *   - `consoleGetTenantAiEntitlements`: GET /api/v1/tenants/{tenant_id}/ai/entitlements
 *
 * Boundary: `consolePutTenantAiFeatureOptOut` (the owner's opt-out write) is in
 * the same document and is NOT wrapped: this item is read-only. The server-
 * internal `check` shapes have no path and no client. Admin-Console never decides
 * entitlement: it renders the server's view. Same `{ status, data?, error? }`
 * shape as `src/lib/cash-variance-policy-queries.ts`; cookie transport is on the
 * generated client. No hand-rolled fetch.
 */
import { apiClient } from "@/generated/client";
import type { AiEntitlementsSchema } from "@/generated/schema";

type Schemas = AiEntitlementsSchema.components["schemas"];

// --- Generated projections (no hand-typed shapes) -----------------------------

export type TenantAiEntitlements = Schemas["TenantAiEntitlements"];
export type TenantAiEntitlementsFull = Schemas["TenantAiEntitlementsFull"];
export type TenantAiEntitlementsMinimal = Schemas["TenantAiEntitlementsMinimal"];
export type AiFeatureEntitlement = Schemas["AiFeatureEntitlement"];
export type AiFeatureAvailability = Schemas["AiFeatureAvailability"];
export type AiRequestMeter = Schemas["AiRequestMeter"];
export type AiTenantOptOut = Schemas["AiTenantOptOut"];
export type AiEntitlementState = Schemas["AiEntitlementState"];
export type AiTenantFacingReasonCode = Schemas["AiTenantFacingReasonCode"];

// --- Typed operation wrapper --------------------------------------------------

/**
 * GET /api/v1/tenants/{tenant_id}/ai/entitlements. The server picks the view
 * from the caller's role: `full` for owner / tenant_admin, `minimal` for
 * store_manager, a non-disclosing 404 for everyone else.
 */
export async function consoleGetTenantAiEntitlements(tenantId: string) {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/tenants/{tenant_id}/ai/entitlements",
    { params: { path: { tenant_id: tenantId } } },
  );
  return { status: response.status, data, error };
}
