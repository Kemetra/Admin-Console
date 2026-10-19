import type {
  BacklogItem,
  ProductReconciliationResult,
  ProductReconciliationRun,
  RecordedProductRepair,
} from "@/lib/product-reconciliation-queries";

/** RT-727 fixtures, shaped by the generated contract types. */
export const PRODUCT_A = "0190f000-0000-7000-8000-0000000000b1";
export const PRODUCT_B = "0190f000-0000-7000-8000-0000000000b2";
export const MAPPING_B = "0190f000-0000-7000-8000-0000000000c2";
export const RUN_A = "0190f000-0000-7000-8000-0000000000d1";
export const RESULT_A = "0190f000-0000-7000-8000-0000000000e1";
export const REQUEST_ID = "11111111-2222-4333-8444-555555555555";

export function backlogItem(over: Partial<BacklogItem> = {}): BacklogItem {
  return {
    tenantProductId: PRODUCT_A,
    mismatchClass: "unmapped_dp2_product",
    suggestionMappingId: null,
    suggestionMappingVersion: null,
    suggestionSource: null,
    suggestedBy: null,
    suggestedAt: null,
    erpnextItemRef: null,
    observedAt: "2026-10-19T08:00:00Z",
    ...over,
  };
}

export function suggestionItem(): BacklogItem {
  return backlogItem({
    tenantProductId: PRODUCT_B,
    mismatchClass: "suggestion_unconfirmed",
    suggestionMappingId: MAPPING_B,
    suggestionMappingVersion: 3,
    suggestionSource: "manual",
    suggestedAt: "2026-10-18T09:00:00Z",
    erpnextItemRef: "ITEM-COLA-330",
  });
}

export function run(over: Partial<ProductReconciliationRun> = {}): ProductReconciliationRun {
  return {
    id: RUN_A,
    trigger: "on_demand",
    status: "completed",
    erpnextViewStatus: "available",
    startedAt: "2026-10-19T07:00:00Z",
    finishedAt: "2026-10-19T07:01:00Z",
    summary: { unmapped_dp2_product: 1, match: 4 },
    ...over,
  };
}

export function result(
  over: Partial<ProductReconciliationResult> = {},
): ProductReconciliationResult {
  return {
    id: RESULT_A,
    runId: RUN_A,
    mismatchClass: "unmapped_dp2_product",
    tenantProductId: PRODUCT_A,
    erpnextItemRef: null,
    resultState: "open",
    detail: null,
    mappingId: null,
    mappingVersion: null,
    ...over,
  };
}

export function repair(over: Partial<RecordedProductRepair> = {}): RecordedProductRepair {
  return {
    targetKind: "backlog_item",
    targetRef: PRODUCT_A,
    repairKind: "suggest_confirm",
    outcome: "mapped",
    resolvedItemMapId: MAPPING_B,
    recordedAt: "2026-10-19T08:05:00Z",
    ...over,
  };
}

export const ok = <T>(data: T, status = 200) => ({ status, data });

export function failure(status: number, code = "x", retryAfterSeconds?: number) {
  return {
    status,
    error: { error: { code, message: "x", request_id: REQUEST_ID } },
    retryAfterSeconds,
  };
}
