import type { AiEntitlementsSchema } from "@/generated/schema";
import type {
  AiFeatureAvailability,
  AiFeatureEntitlement,
  AiRequestMeter,
  TenantAiEntitlements,
  TenantAiEntitlementsFull,
  TenantAiEntitlementsMinimal,
} from "@/lib/ai-entitlements-queries";
import { beforeEach, describe, expect, expectTypeOf, test, vi } from "vitest";
import { TENANT_ID, fullActive, fullNone, minimalView } from "./ai-plan-fixtures";

const GET = vi.fn();
vi.mock("@/generated/client", () => ({
  apiClient: { GET: (...a: unknown[]) => GET(...a) },
}));

import { consoleGetTenantAiEntitlements } from "@/lib/ai-entitlements-queries";

type Schemas = AiEntitlementsSchema.components["schemas"];
type Operation = AiEntitlementsSchema.operations["consoleGetTenantAiEntitlements"];

/**
 * RT-665 contract shape (ai-entitlements.openapi.yaml 1.0.0-draft, Backend-Core
 * 62f8699). The projections are the generated types, never hand-typed, and the
 * fixtures are typed `satisfies` them; these assertions pin the pieces the panel
 * relies on, so a repin that changes one fails here at compile time.
 */
describe("generated AI entitlements contract", () => {
  test("the read answers the full or the minimal view", () => {
    expectTypeOf<TenantAiEntitlements>().toEqualTypeOf<
      TenantAiEntitlementsFull | TenantAiEntitlementsMinimal
    >();
    expectTypeOf<
      Operation["responses"][200]["content"]["application/json"]
    >().toEqualTypeOf<TenantAiEntitlements>();
    expectTypeOf<TenantAiEntitlementsFull["view"]>().toEqualTypeOf<"full">();
    expectTypeOf<TenantAiEntitlementsMinimal["view"]>().toEqualTypeOf<"minimal">();
  });

  test("the read takes the tenant in the path and nothing else", () => {
    expectTypeOf<Operation["parameters"]["path"]>().toEqualTypeOf<{ tenant_id: string }>();
    expectTypeOf<Operation["parameters"]["query"]>().toEqualTypeOf<never | undefined>();
  });

  test("the minimal view carries availability only", () => {
    expectTypeOf<keyof TenantAiEntitlementsMinimal>().toEqualTypeOf<
      "view" | "evaluatedAt" | "features"
    >();
    expectTypeOf<keyof AiFeatureAvailability>().toEqualTypeOf<"featureId" | "availability">();
    expectTypeOf<AiFeatureAvailability["availability"]>().toEqualTypeOf<
      "available" | "unavailable"
    >();
  });

  test("the full view's feature and meter fields the panel renders", () => {
    expectTypeOf<keyof AiFeatureEntitlement>().toEqualTypeOf<
      "featureId" | "availability" | "unavailableReason" | "entitled" | "optOut" | "meters"
    >();
    expectTypeOf<keyof AiRequestMeter>().toEqualTypeOf<
      | "meter"
      | "unit"
      | "window"
      | "storeRef"
      | "limit"
      | "used"
      | "reserved"
      | "remaining"
      | "resetsAt"
    >();
    expectTypeOf<AiRequestMeter["unit"]>().toEqualTypeOf<"request">();
    expectTypeOf<Schemas["AiEntitlementState"]>().toEqualTypeOf<
      "none" | "trial" | "active" | "grace" | "expired" | "cancelled"
    >();
    expectTypeOf<Schemas["AiTenantFacingReasonCode"]>().toEqualTypeOf<
      "not_entitled" | "trial_expired" | "grace_read_only" | "feature_disabled_tenant"
    >();
  });

  test("no view carries a price, currency, plan name, token cost or credit balance", () => {
    const fields = JSON.stringify([
      Object.keys(fullActive),
      Object.keys(fullActive.features[0]),
      Object.keys(fullActive.features[0].meters[0]),
      Object.keys(minimalView),
    ]);
    expect(fields).not.toMatch(/price|currency|plan|token|cost|credit|spend/i);
    // The state `none` has no effective revision, hence no dates.
    expect(fullNone.effectiveFrom).toBeNull();
    expect(fullNone.effectiveUntil).toBeNull();
  });
});

describe("consoleGetTenantAiEntitlements", () => {
  beforeEach(() => GET.mockReset());

  test("calls exactly the contract's read path with the tenant, and returns the status, data and error", async () => {
    GET.mockResolvedValue({ data: fullActive, response: { status: 200 } });
    const res = await consoleGetTenantAiEntitlements(TENANT_ID);
    expect(GET).toHaveBeenCalledTimes(1);
    expect(GET).toHaveBeenCalledWith("/api/v1/tenants/{tenant_id}/ai/entitlements", {
      params: { path: { tenant_id: TENANT_ID } },
    });
    expect(res).toEqual({ status: 200, data: fullActive, error: undefined });
  });

  test("a refusal keeps its status and error body for the caller to branch on", async () => {
    const error = { error: { code: "not_found", message: "x", request_id: "r1" } };
    GET.mockResolvedValue({ error, response: { status: 404 } });
    expect(await consoleGetTenantAiEntitlements(TENANT_ID)).toEqual({
      status: 404,
      data: undefined,
      error,
    });
  });
});
