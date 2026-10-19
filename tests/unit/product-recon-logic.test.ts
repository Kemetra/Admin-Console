import {
  BACKLOG_CLASSES,
  RESULT_CLASSES,
  backlogRepair,
  canUseProductReconciliation,
  classFilter,
  classView,
  classifyRepair,
  classifyTrigger,
  detailEntries,
  isRunId,
  itemRefOf,
  mappingRefOf,
  mappingRepairRequest,
  readErrorOf,
  refusalView,
  repairOutcomeView,
  resultRepair,
  resultStateView,
  runStatusView,
  runTriggerKey,
  suggestConfirmRequest,
  summaryEntries,
  viewStatusView,
} from "@/product-reconciliation/productReconLogic";
import { describe, expect, test } from "vitest";
import {
  MAPPING_B,
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

describe("repair eligibility (RT-733: confirm / re_point with the version the server sent)", () => {
  test("an unmapped backlog product is suggest_confirm; a suggestion is confirm at its version", () => {
    expect(backlogRepair(backlogItem())).toEqual({
      repairKind: "suggest_confirm",
      tenantProductId: PRODUCT_A,
    });
    expect(backlogRepair(suggestionItem())).toEqual({
      repairKind: "confirm",
      tenantProductId: suggestionItem().tenantProductId,
      mapping: { mappingId: MAPPING_B, version: 3 },
      erpnextItemRef: "ITEM-COLA-330",
    });
  });

  test("a suggestion without both the mapping id and version is never sent with a guess", () => {
    for (const over of [
      { suggestionMappingVersion: null },
      { suggestionMappingVersion: undefined },
      { suggestionMappingVersion: 0 },
      { suggestionMappingVersion: 2.5 },
      { suggestionMappingId: null },
      { suggestionMappingId: "not-a-uuid" },
    ]) {
      expect(backlogRepair({ ...suggestionItem(), ...over })).toBe("needs-version");
    }
  });

  test("results: open lines with a product are repairable by class", () => {
    const ids = { runId: RUN_A, resultId: RESULT_A };
    const mapped = { mappingId: MAPPING_B, mappingVersion: 7, erpnextItemRef: "ITEM-1" };
    expect(resultRepair(result())).toEqual({
      repairKind: "suggest_confirm",
      tenantProductId: PRODUCT_A,
      ...ids,
    });
    expect(resultRepair(result({ mismatchClass: "suggestion_unconfirmed", ...mapped }))).toEqual({
      repairKind: "confirm",
      tenantProductId: PRODUCT_A,
      mapping: { mappingId: MAPPING_B, version: 7 },
      erpnextItemRef: "ITEM-1",
      ...ids,
    });
    expect(resultRepair(result({ mismatchClass: "attribute_drift", ...mapped }))).toEqual({
      repairKind: "re_point",
      tenantProductId: PRODUCT_A,
      mapping: { mappingId: MAPPING_B, version: 7 },
      erpnextItemRef: "ITEM-1",
      ...ids,
    });
    expect(resultRepair(result({ mismatchClass: "suggestion_unconfirmed" }))).toBe("needs-version");
    expect(resultRepair(result({ mismatchClass: "attribute_drift" }))).toBe("not-repairable");
    expect(resultRepair(result({ resultState: "repaired", ...mapped }))).toBe("not-open");
    expect(
      resultRepair(result({ mismatchClass: "unmapped_erpnext_item", tenantProductId: null })),
    ).toBe("not-repairable");
    expect(resultRepair(result({ mismatchClass: "match", ...mapped }))).toBe("not-repairable");
  });

  test("mappingRefOf takes both facts as sent, or nothing", () => {
    expect(mappingRefOf(MAPPING_B, 1)).toEqual({ mappingId: MAPPING_B, version: 1 });
    expect(mappingRefOf(MAPPING_B, null)).toBeNull();
    expect(mappingRefOf(null, 1)).toBeNull();
  });

  test("a confirm / re_point request carries mappingId + version, never an item ref", () => {
    const mapping = { mappingId: MAPPING_B, version: 4 };
    expect(
      mappingRepairRequest({
        repairKind: "confirm",
        tenantProductId: PRODUCT_A,
        mapping,
        erpnextItemRef: "ITEM-1",
      }),
    ).toEqual({
      repairKind: "confirm",
      tenantProductId: PRODUCT_A,
      mappingId: MAPPING_B,
      version: 4,
    });
    expect(
      mappingRepairRequest({
        repairKind: "re_point",
        tenantProductId: PRODUCT_A,
        mapping,
        runId: RUN_A,
        resultId: RESULT_A,
      }),
    ).toEqual({
      repairKind: "re_point",
      tenantProductId: PRODUCT_A,
      mappingId: MAPPING_B,
      version: 4,
      runId: RUN_A,
      resultId: RESULT_A,
    });
    expect(mappingRepairRequest({ repairKind: "confirm", tenantProductId: PRODUCT_A })).toBeNull();
    expect(
      mappingRepairRequest({ repairKind: "suggest_confirm", tenantProductId: PRODUCT_A, mapping }),
    ).toBeNull();
  });

  test("a no_op_echo of a confirm / re_point names the mapping (FR-011)", () => {
    expect(repairOutcomeView("no_op_echo", "confirm").messageKey).toBe(
      "productRecon.repair.outcome.no_op_echo_mapping",
    );
    expect(repairOutcomeView("no_op_echo", "re_point").messageKey).toBe(
      "productRecon.repair.outcome.no_op_echo_mapping",
    );
    expect(repairOutcomeView("no_op_echo", "suggest_confirm").messageKey).toBe(
      "productRecon.repair.outcome.no_op_echo",
    );
  });

  test("the item reference is trimmed and bounded to the contract's 1..180", () => {
    expect(itemRefOf("  ITEM-1 ")).toBe("ITEM-1");
    expect(itemRefOf("   ")).toBeNull();
    expect(itemRefOf("x".repeat(180))).toHaveLength(180);
    expect(itemRefOf("x".repeat(181))).toBeNull();
  });

  test("the request is strict: no tenant or actor, run + result only together", () => {
    expect(
      suggestConfirmRequest(
        { repairKind: "suggest_confirm", tenantProductId: PRODUCT_A },
        "ITEM-1",
      ),
    ).toEqual({
      repairKind: "suggest_confirm",
      tenantProductId: PRODUCT_A,
      erpnextItemRef: "ITEM-1",
    });
    expect(
      suggestConfirmRequest(
        {
          repairKind: "suggest_confirm",
          tenantProductId: PRODUCT_A,
          runId: RUN_A,
          resultId: RESULT_A,
        },
        "I",
      ),
    ).toEqual({
      repairKind: "suggest_confirm",
      tenantProductId: PRODUCT_A,
      erpnextItemRef: "I",
      runId: RUN_A,
      resultId: RESULT_A,
    });
    expect(
      suggestConfirmRequest(
        { repairKind: "suggest_confirm", tenantProductId: PRODUCT_A, runId: RUN_A },
        "I",
      ),
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
