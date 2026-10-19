import {
  BACKLOG_CLASSES,
  RESULT_CLASSES,
  backlogRepairBlock,
  canUseProductReconciliation,
  classFilter,
  classView,
  classifyRepair,
  classifyTrigger,
  detailEntries,
  isRunId,
  itemRefOf,
  readErrorOf,
  refusalView,
  repairOutcomeView,
  resultRepairBlock,
  resultStateView,
  runStatusView,
  runTriggerKey,
  suggestConfirmRequest,
  summaryEntries,
  viewStatusView,
} from "@/product-reconciliation/productReconLogic";
import { describe, expect, test } from "vitest";
import {
  PRODUCT_A,
  REQUEST_ID,
  RESULT_A,
  RUN_A,
  backlogItem,
  failure,
  ok,
  repair,
  result,
  run,
  suggestionItem,
} from "./product-recon-fixtures";

describe("RT-727 role gate mirrors @Roles(owner, tenant_admin)", () => {
  test.each(["owner", "tenant_admin"])("%s may use the surface", (role) => {
    expect(canUseProductReconciliation(role)).toBe(true);
  });
  test.each(["store_manager", "store_staff", "cashier", "auditor", "", null, undefined])(
    "%s may not",
    (role) => {
      expect(canUseProductReconciliation(role)).toBe(false);
    },
  );
});

describe("server values: known ones map, unknown stays Unknown", () => {
  test("every contract class has its own label", () => {
    const keys = RESULT_CLASSES.map((cls) => classView(cls).labelKey);
    expect(new Set(keys).size).toBe(RESULT_CLASSES.length);
    expect(keys).not.toContain("productRecon.unknown");
  });

  test("an unknown class, status, view, state or trigger reads Unknown", () => {
    expect(classView("brand_new_class").labelKey).toBe("productRecon.unknown");
    expect(runStatusView("queued").labelKey).toBe("productRecon.unknown");
    expect(viewStatusView("stale").labelKey).toBe("productRecon.unknown");
    expect(resultStateView("ignored").labelKey).toBe("productRecon.unknown");
    expect(runTriggerKey("webhook")).toBe("productRecon.unknown");
    expect(repairOutcomeView("rolled_back").messageKey).toBe("productRecon.repair.outcome.unknown");
  });

  test("an unavailable ERPNext view is reported, not a failure (FR-007)", () => {
    expect(viewStatusView("unavailable").tone).toBe("neutral");
    expect(runStatusView("failed").tone).toBe("danger");
  });

  test("the class filter accepts only the list's classes", () => {
    expect(classFilter("attribute_drift", RESULT_CLASSES)).toBe("attribute_drift");
    expect(classFilter("attribute_drift", BACKLOG_CLASSES)).toBe("");
    expect(classFilter("nonsense", RESULT_CLASSES)).toBe("");
    expect(classFilter(null, RESULT_CLASSES)).toBe("");
  });

  test("summary and detail are shown as received, ordered by key", () => {
    expect(summaryEntries({ match: 4, attribute_drift: 1, note: "x" })).toEqual([
      ["attribute_drift", "1"],
      ["match", "4"],
      ["note", "x"],
    ]);
    expect(detailEntries({ attributes: { uom: "Nos" } })).toEqual([
      ["attributes", '{"uom":"Nos"}'],
    ]);
    expect(summaryEntries(null)).toEqual([]);
  });

  test("a run id must be a UUID before it is sent", () => {
    expect(isRunId(RUN_A)).toBe(true);
    expect(isRunId("latest")).toBe(false);
    expect(isRunId(undefined)).toBe(false);
  });
});

describe("repair eligibility (suggest_confirm only: confirm/re_point need a version not exposed here)", () => {
  test("an unmapped backlog product can be repaired; a suggestion needs its version", () => {
    expect(backlogRepairBlock(backlogItem())).toBeNull();
    expect(backlogRepairBlock(suggestionItem())).toBe("needs-version");
  });

  test("only an open unmapped result with a product can be repaired", () => {
    expect(resultRepairBlock(result())).toBeNull();
    expect(resultRepairBlock(result({ resultState: "repaired" }))).toBe("not-open");
    expect(resultRepairBlock(result({ mismatchClass: "suggestion_unconfirmed" }))).toBe(
      "needs-version",
    );
    expect(
      resultRepairBlock(result({ mismatchClass: "unmapped_erpnext_item", tenantProductId: null })),
    ).toBe("not-repairable");
    expect(resultRepairBlock(result({ mismatchClass: "attribute_drift" }))).toBe("not-repairable");
  });

  test("the item reference is trimmed and bounded to the contract's 1..180", () => {
    expect(itemRefOf("  ITEM-1 ")).toBe("ITEM-1");
    expect(itemRefOf("   ")).toBeNull();
    expect(itemRefOf("x".repeat(180))).toHaveLength(180);
    expect(itemRefOf("x".repeat(181))).toBeNull();
  });

  test("the request is strict: no tenant or actor, run + result only together", () => {
    expect(suggestConfirmRequest({ tenantProductId: PRODUCT_A }, "ITEM-1")).toEqual({
      repairKind: "suggest_confirm",
      tenantProductId: PRODUCT_A,
      erpnextItemRef: "ITEM-1",
    });
    expect(
      suggestConfirmRequest({ tenantProductId: PRODUCT_A, runId: RUN_A, resultId: RESULT_A }, "I"),
    ).toEqual({
      repairKind: "suggest_confirm",
      tenantProductId: PRODUCT_A,
      erpnextItemRef: "I",
      runId: RUN_A,
      resultId: RESULT_A,
    });
    expect(
      suggestConfirmRequest({ tenantProductId: PRODUCT_A, runId: RUN_A }, "I"),
    ).not.toHaveProperty("runId");
  });
});

describe("read errors: every contract status is typed", () => {
  test.each([
    [400, "rejected"],
    [401, "session"],
    [403, "forbidden"],
    [404, "not-found"],
    [429, "rate-limited"],
    [500, "generic"],
    [503, "generic"],
  ])("%i → %s, with the request id", (status, kind) => {
    const error = readErrorOf(failure(status, "x", status === 429 ? 30 : undefined));
    expect(error.kind).toBe(kind);
    expect(error.requestId).toBe(REQUEST_ID);
    expect(error.retryAfterSeconds).toBe(status === 429 ? 30 : undefined);
  });
});

describe("trigger outcome", () => {
  test("201 (or a 200 replay) with the run is started, as returned", () => {
    expect(classifyTrigger(ok(run({ status: "running" }), 201))).toEqual({
      kind: "started",
      run: run({ status: "running" }),
    });
    expect(classifyTrigger(ok(run(), 200)).kind).toBe("started");
  });

  test.each([
    [400, "validation_error", "rejected"],
    [401, "x", "session"],
    [403, "origin_rejected", "origin"],
    [409, "conflict", "conflict"],
    [429, "rate_limited", "rate-limited"],
    [500, "system_failure", "error"],
  ])("%i %s → refused %s", (status, code, refusal) => {
    expect(classifyTrigger(failure(status, code, status === 429 ? 9 : undefined))).toEqual({
      kind: "refused",
      refusal,
      requestId: REQUEST_ID,
      retryAfterSeconds: status === 429 ? 9 : undefined,
    });
  });
});

describe("repair outcome", () => {
  test.each(["mapped", "no_op_echo", "still_unmapped", "conflict"] as const)(
    "a recorded %s is shown as the server reported it",
    (outcome) => {
      const classified = classifyRepair(ok(repair({ outcome }), 201));
      expect(classified).toEqual({ kind: "recorded", repair: repair({ outcome }) });
      expect(repairOutcomeView(outcome).messageKey).toBe(`productRecon.repair.outcome.${outcome}`);
    },
  );

  test.each([
    [400, "validation_error", "rejected"],
    [401, "x", "session"],
    [403, "origin_rejected", "origin"],
    [404, "not_found", "not-found"],
    [409, "conflict", "conflict"],
    [429, "rate_limited", "rate-limited"],
    [500, "system_failure", "error"],
  ])("%i %s → refused %s", (status, code, refusal) => {
    const classified = classifyRepair(failure(status, code));
    expect(classified).toMatchObject({ kind: "refused", refusal, requestId: REQUEST_ID });
    expect(refusalView(classified.kind === "refused" ? classified.refusal : "error")).toBeDefined();
  });

  test("a 2xx without a body is not a success", () => {
    expect(classifyRepair({ status: 201 }).kind).toBe("refused");
  });
});
