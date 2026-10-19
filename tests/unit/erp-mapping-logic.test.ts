import {
  type MappingOp,
  canManageMappings,
  classifyFailure,
  cleanRef,
  failureKey,
  parseStateFilter,
  purposeKey,
  requestIdOf,
  shouldRefreshAfter,
  sourceKey,
  stateView,
  unmappedStores,
} from "@/erp-mappings/mappingLogic";
import { translate } from "@/i18n";
import type { ErpnextWarehouseMapping } from "@/lib/erp-mapping-queries";
import { describe, expect, test } from "vitest";

/** RT-725 pure rules: every contract status per operation, labels, inputs. */
const REQ = "11111111-2222-4333-8444-555555555555";
const envelope = { error: { code: "conflict", message: "x", request_id: REQ } };
const MUTATIONS: MappingOp[] = [
  "suggest",
  "confirm",
  "retireItem",
  "setWarehouse",
  "retireWarehouse",
];
const READS: MappingOp[] = ["listItems", "listWarehouses"];

describe("role gate", () => {
  test("mirrors the API's owner / tenant_admin", () => {
    expect(canManageMappings("owner")).toBe(true);
    expect(canManageMappings("tenant_admin")).toBe(true);
    for (const role of ["store_manager", "cashier", "platform_admin", null, undefined]) {
      expect(canManageMappings(role)).toBe(false);
    }
  });
});

describe("classifyFailure", () => {
  test.each(MUTATIONS)("%s: every documented status has its own kind", (op) => {
    const of = (status: number) => classifyFailure(op, { status, error: envelope }).kind;
    expect(of(400)).toBe("validation");
    expect(of(401)).toBe("session");
    expect(of(403)).toBe("origin");
    expect(of(404)).toBe("not-found");
    expect(of(409)).toBe("conflict");
    expect(of(429)).toBe("rate-limited");
    expect(of(500)).toBe("unknown");
    expect(of(503)).toBe("unknown");
    expect(of(418)).toBe("failed");
    expect(classifyFailure(op, undefined)).toEqual({ kind: "unknown" });
  });

  test.each(READS)("%s: a role refusal hides the surface; no answer is a failed read", (op) => {
    const of = (status: number) => classifyFailure(op, { status }).kind;
    expect(of(400)).toBe("validation");
    expect(of(401)).toBe("session");
    expect(of(403)).toBe("unavailable");
    expect(of(404)).toBe("unavailable");
    expect(of(409)).toBe("failed");
    expect(of(429)).toBe("rate-limited");
    expect(of(500)).toBe("failed");
    expect(classifyFailure(op, undefined)).toEqual({ kind: "failed" });
  });

  test("keeps the request id and the 429 wait", () => {
    expect(classifyFailure("confirm", { status: 409, error: envelope })).toEqual({
      kind: "conflict",
      requestId: REQ,
    });
    expect(classifyFailure("confirm", { status: 429, error: envelope, retryAfter: 12 })).toEqual({
      kind: "rate-limited",
      retryAfter: 12,
      requestId: REQ,
    });
    expect(classifyFailure("confirm", { status: 429 })).toEqual({ kind: "rate-limited" });
  });

  test("requestIdOf reads only a non-empty string", () => {
    expect(requestIdOf(envelope)).toBe(REQ);
    expect(requestIdOf({ error: { request_id: "" } })).toBeUndefined();
    expect(requestIdOf({ error: { request_id: 7 } })).toBeUndefined();
    expect(requestIdOf(undefined)).toBeUndefined();
  });

  test("only a 409, a 404 or an unknown outcome re-reads the list", () => {
    expect(shouldRefreshAfter({ kind: "conflict" })).toBe(true);
    expect(shouldRefreshAfter({ kind: "not-found" })).toBe(true);
    expect(shouldRefreshAfter({ kind: "unknown" })).toBe(true);
    for (const kind of ["validation", "session", "origin", "rate-limited", "failed"] as const) {
      expect(shouldRefreshAfter({ kind })).toBe(false);
    }
  });
});

describe("failureKey", () => {
  test("conflicts and not-founds name what the operation addressed", () => {
    const conflict = { kind: "conflict" } as const;
    expect(failureKey("suggest", conflict)).toBe("erp.map.error.suggestConflict");
    expect(failureKey("confirm", conflict)).toBe("erp.map.error.confirmConflict");
    expect(failureKey("retireItem", conflict)).toBe("erp.map.error.retireConflict");
    expect(failureKey("setWarehouse", conflict)).toBe("erp.map.error.setConflict");
    expect(failureKey("retireWarehouse", conflict)).toBe("erp.map.error.retireConflict");
    const notFound = { kind: "not-found" } as const;
    expect(failureKey("suggest", notFound)).toBe("erp.map.error.productNotFound");
    expect(failureKey("confirm", notFound)).toBe("erp.map.error.mappingNotFound");
    expect(failureKey("setWarehouse", notFound)).toBe("erp.map.error.storeNotFound");
    expect(failureKey("listItems", notFound)).toBe("erp.map.error.unavailable");
    expect(failureKey("listItems", conflict)).toBe("erp.map.error.failed");
  });

  test("every other kind", () => {
    expect(failureKey("confirm", { kind: "validation" })).toBe("erp.map.error.validation");
    expect(failureKey("listItems", { kind: "validation" })).toBe("erp.map.error.readRejected");
    expect(failureKey("confirm", { kind: "session" })).toBe("erp.map.error.session");
    expect(failureKey("listItems", { kind: "unavailable" })).toBe("erp.map.error.unavailable");
    expect(failureKey("confirm", { kind: "origin" })).toBe("erp.map.error.origin");
    expect(failureKey("confirm", { kind: "rate-limited" })).toBe("erp.map.error.rateLimited");
    expect(failureKey("confirm", { kind: "rate-limited", retryAfter: 9 })).toBe(
      "erp.map.error.rateLimitedWait",
    );
    expect(failureKey("confirm", { kind: "unknown" })).toBe("erp.map.error.unknownOutcome");
    expect(failureKey("confirm", { kind: "failed" })).toBe("erp.map.error.failed");
  });

  test("the rate-limit wait interpolates in both locales", () => {
    expect(translate("en", "erp.map.error.rateLimitedWait", { seconds: 9 })).toContain("9");
    expect(translate("ar", "erp.map.error.rateLimitedWait", { seconds: 9 })).toContain("9");
  });
});

describe("labels: Unknown stays Unknown", () => {
  test("state", () => {
    expect(stateView("suggested")).toMatchObject({
      labelKey: "erp.map.state.suggested",
      known: true,
    });
    expect(stateView("confirmed")).toMatchObject({
      labelKey: "erp.map.state.confirmed",
      known: true,
    });
    expect(stateView("archived")).toMatchObject({
      labelKey: "erp.map.state.unknown",
      known: false,
    });
    expect(stateView("toString")).toMatchObject({ known: false });
  });

  test("source and purpose: an unknown value has no key (shown as received)", () => {
    expect(sourceKey("barcode")).toBe("erp.map.source.barcode");
    expect(sourceKey("item_code")).toBe("erp.map.source.itemCode");
    expect(sourceKey("manual")).toBe("erp.map.source.manual");
    expect(sourceKey("ml")).toBeUndefined();
    expect(purposeKey("stock")).toBe("erp.map.purpose.stock");
    expect(purposeKey("returns")).toBe("erp.map.purpose.returns");
    expect(purposeKey("transit")).toBeUndefined();
  });
});

describe("inputs", () => {
  test("the state filter is one of the two contract states, else all", () => {
    expect(parseStateFilter("suggested")).toBe("suggested");
    expect(parseStateFilter("confirmed")).toBe("confirmed");
    expect(parseStateFilter("retired")).toBe("");
    expect(parseStateFilter(null)).toBe("");
  });

  test("references are trimmed", () => {
    expect(cleanRef("  ITEM-1 ")).toBe("ITEM-1");
    expect(cleanRef("   ")).toBe("");
  });

  test("a store with an active stock mapping is not offered again", () => {
    const row = (store_id: string, over: Partial<ErpnextWarehouseMapping> = {}) =>
      ({
        id: `m-${store_id}`,
        store_id,
        purpose: "stock",
        erpnext_warehouse_ref: "W",
        version: 1,
        set_at: "2026-10-01T00:00:00Z",
        retired_at: null,
        created_at: "2026-10-01T00:00:00Z",
        updated_at: "2026-10-01T00:00:00Z",
        ...over,
      }) as ErpnextWarehouseMapping;
    const stores = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    expect(
      unmappedStores(stores, [
        row("a"),
        row("b", { retired_at: "2026-10-02T00:00:00Z" }),
        row("c", { purpose: "returns" }),
      ]).map((s) => s.id),
    ).toEqual(["b", "c", "d"]);
  });
});
