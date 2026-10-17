import {
  type PayerListPage,
  type PayerRow,
  flattenPayerPages,
  nextPayerCursor,
  payerCategoryKey,
  payerScope,
  payerStatusKey,
} from "@/payers/payerListLogic";
import { describe, expect, test } from "vitest";

/**
 * 017 payer-list keyset pagination (FR-007 / OQ-CON-LIST-FILTER) — pure helpers,
 * no client, no generated types. `nextCursor: null` means last page; pages
 * flatten newest-first in fetch order. (The useInfiniteQuery binding that calls
 * these lands in the G-client slice; the LOGIC is testable now.)
 */
function row(payerRef: string, over: Partial<PayerRow> = {}): PayerRow {
  return {
    payerRef,
    category: "insurer",
    displayName: `Payer ${payerRef}`,
    externalRef: null,
    status: "active",
    storeId: null,
    version: 0,
    ...over,
  };
}

function page(items: string[], nextCursor: string | null): PayerListPage {
  return { items: items.map((payerRef) => row(payerRef)), nextCursor };
}

describe("nextPayerCursor", () => {
  test("present nextCursor -> that cursor (more pages)", () => {
    expect(nextPayerCursor(page(["a"], "CUR1"))).toBe("CUR1");
  });

  test("null nextCursor -> undefined (last page; stops useInfiniteQuery)", () => {
    expect(nextPayerCursor(page(["a"], null))).toBeUndefined();
  });
});

describe("flattenPayerPages", () => {
  test("flattens multiple pages in order", () => {
    const pages = [page(["a", "b"], "CUR1"), page(["c"], null)];
    expect(flattenPayerPages(pages).map((p) => p.payerRef)).toEqual(["a", "b", "c"]);
  });

  test("empty result -> empty array (zero-account tenant is not an error)", () => {
    expect(flattenPayerPages([page([], null)])).toEqual([]);
  });

  test("no pages yet -> empty array", () => {
    expect(flattenPayerPages([])).toEqual([]);
  });

  test("a page may be empty while its cursor is non-null; the walk still continues", () => {
    const pages = [page([], "CUR1"), page(["a"], null)];
    expect(nextPayerCursor(pages[0])).toBe("CUR1");
    expect(flattenPayerPages(pages).map((p) => p.payerRef)).toEqual(["a"]);
  });

  test("a keyset walk is not a snapshot: a payer seen twice is kept once, where it first appeared", () => {
    const pages = [page(["a", "b"], "CUR1"), page(["b", "c"], null)];
    expect(flattenPayerPages(pages).map((p) => p.payerRef)).toEqual(["a", "b", "c"]);
  });
});

/**
 * A payer is tenant-wide (`storeId` null) or scoped to one store. The store's
 * name comes from the roster the caller can see; a store the roster does not
 * list is still "a store", never its raw id.
 */
describe("payerScope", () => {
  const stores = [{ id: "s1", name: "Cairo Festival City" }, { id: "s2" }];

  test("storeId null -> tenant-wide", () => {
    expect(payerScope(row("a"), stores)).toEqual({ kind: "tenant" });
  });

  test("a store in the roster -> its name", () => {
    expect(payerScope(row("a", { storeId: "s1" }), stores)).toEqual({
      kind: "store",
      name: "Cairo Festival City",
    });
  });

  test("a store the roster does not list, or lists without a name -> a store with no name", () => {
    expect(payerScope(row("a", { storeId: "s9" }), stores)).toEqual({ kind: "store" });
    expect(payerScope(row("a", { storeId: "s2" }), stores)).toEqual({ kind: "store" });
  });
});

/**
 * RT-399: raw `category` / `status` codes drive copy; they are not copy. Each
 * maps to a catalog label key, and an unknown code gets a localized fallback
 * instead of leaking the raw value.
 */
describe("payer label keys", () => {
  test("each v1 category maps to its own label key", () => {
    expect(payerCategoryKey("credit_customer")).toBe("payers.category.credit_customer");
    expect(payerCategoryKey("corporate")).toBe("payers.category.corporate");
    expect(payerCategoryKey("insurer")).toBe("payers.category.insurer");
  });

  test("an unknown (upstream-extended) category -> the localized fallback", () => {
    expect(payerCategoryKey("patient")).toBe("payers.category.unknown");
    expect(payerCategoryKey("toString")).toBe("payers.category.unknown");
  });

  test("status: suspended -> suspended label; otherwise active (display-only)", () => {
    expect(payerStatusKey("suspended")).toBe("payers.status.suspended");
    expect(payerStatusKey("active")).toBe("payers.status.active");
  });
});
