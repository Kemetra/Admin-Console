import { createQueryClient } from "@/lib/query";
import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

/** RT-389 contract-shaped fixtures (cash-variance-policy.openapi.yaml 1.0.0-draft). */
export const TENANT_ID = "0190f000-0000-7000-8000-000000000001";
export const STORE_ID = "0190f000-0000-7000-8000-0000000000a1";
export const REV_1 = "0190f000-0000-7000-8000-0000000000b1";
export const REV_2 = "0190f000-0000-7000-8000-0000000000b2";
export const REV_3 = "0190f000-0000-7000-8000-0000000000b3";
export const USER_A = "0190f000-0000-7000-8000-0000000000c1";
export const USER_OWNER = "0190f000-0000-7000-8000-0000000000c2";

export const NONE = { mode: "none" } as const;
export const LIMIT_1250 = { mode: "limit", limitAmount: "1250.0000", currencyCode: "EGP" } as const;
export const LIMIT_500 = { mode: "limit", limitAmount: "500.0000", currencyCode: "EGP" } as const;

export function revision(over: Record<string, unknown> = {}) {
  return {
    revisionId: REV_1,
    scope: "tenant",
    storeId: null,
    kind: "set",
    policyValue: LIMIT_1250,
    reason: "Quarterly review",
    effectiveFrom: "2026-10-07T10:00:00Z",
    effectiveUntil: null,
    permanent: false,
    approvedByUserId: null,
    supersedesRevisionId: null,
    state: "current",
    createdByUserId: USER_A,
    createdAt: "2026-10-07T10:00:00Z",
    ...over,
  };
}

export const systemTenantRead = {
  tenantDefault: { policySource: "system", policyRevisionId: null, policyValue: NONE },
  latestRevision: null,
  latestRevisionId: null,
};

export const limitTenantRead = {
  tenantDefault: { policySource: "tenant", policyRevisionId: REV_1, policyValue: LIMIT_1250 },
  latestRevision: revision(),
  latestRevisionId: REV_1,
};

/** A store on the tenant default, with no override. */
export const plainStoreRead = {
  storeId: STORE_ID,
  effective: { policySource: "tenant", policyRevisionId: REV_1, policyValue: LIMIT_1250 },
  tenantDefault: { policySource: "tenant", policyRevisionId: REV_1, policyValue: LIMIT_1250 },
  activeOverride: null,
  latestRevisionId: null,
  permanentOverrideHorizonDays: 90,
};

export function overriddenStoreRead(over: Record<string, unknown> = {}) {
  return {
    ...plainStoreRead,
    effective: { policySource: "store", policyRevisionId: REV_2, policyValue: LIMIT_500 },
    activeOverride: {
      revisionId: REV_2,
      policyValue: LIMIT_500,
      reason: "Shrinkage audit",
      effectiveUntil: "2026-11-01T09:00:00Z",
      permanent: false,
      approvedByUserId: null,
      createdByUserId: USER_A,
      createdAt: "2026-10-08T09:00:00Z",
    },
    latestRevisionId: REV_2,
    ...over,
  };
}

export const apiError = (code: string, requestId = "req-1") => ({
  error: { code, message: "x", request_id: requestId },
});

export function renderWithQuery(ui: ReactNode) {
  const client = createQueryClient();
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}
