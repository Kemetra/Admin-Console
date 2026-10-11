import {
  type PayerListPage,
  flattenPayerPages,
  nextPayerCursor,
  payerCategoryKey,
  payerStatusKey,
} from "@/payers/payerListLogic";
import { describe, expect, test } from "vitest";

/**
 * 017 payer-list keyset pagination (FR-007 / OQ-CON-LIST-FILTER) — pure helpers,
 * no client, no generated types. `nextCursor: null` means last page; pages
 * flatten newest-first in fetch order. (The useInfiniteQuery binding that calls
 * these lands in the G-client slice; the LOGIC is testable now.)
 */
function page(items: string[], nextCursor: string | null): PayerListPage {
  return { items: items.map((payerRef) => ({ payerRef })), nextCursor };
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
