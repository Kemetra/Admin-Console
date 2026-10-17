import {
  MAX_SPAN_DAYS,
  PAGE_SIZE,
  buildListQuery,
  emptyFilters,
  filtersFromSearch,
  filtersToSearch,
  isQueryReady,
  spanDays,
  todayIn,
  validateFilters,
} from "@/sales/saleFilters";
import {
  canReadSales,
  erpStateKey,
  isSaleRef,
  listEnded,
  nextSaleCursor,
  returnStateKey,
  shiftClosesHref,
  syncStatusKey,
  tenderMethodKey,
} from "@/sales/saleLogic";
import { describe, expect, test } from "vitest";
import { CAIRO_STORE } from "./sale-fixtures";

const base = {
  ...emptyFilters(),
  storeId: CAIRO_STORE,
  fromDate: "2026-10-01",
  toDate: "2026-10-07",
};

describe("sale filters: URL round trip (FR-007)", () => {
  test("every filter lives in its own URL key and comes back unchanged", () => {
    const filters = {
      storeId: CAIRO_STORE,
      fromDate: "2026-10-01",
      toDate: "2026-10-07",
      saleNumber: "R-0042",
      syncStatus: "failed-needs-repair" as const,
      voided: "true" as const,
      returnState: "partial" as const,
      erpState: "unknown" as const,
    };
    const search = filtersToSearch(filters);
    expect(search.toString()).toBe(
      `store=${CAIRO_STORE}&from=2026-10-01&to=2026-10-07&number=R-0042&sync=failed-needs-repair&voided=true&returns=partial&erp=unknown`,
    );
    expect(filtersFromSearch(search)).toEqual(filters);
  });

  test("blank filters are left out of the URL", () => {
    expect(filtersToSearch(base).toString()).toBe(
      `store=${CAIRO_STORE}&from=2026-10-01&to=2026-10-07`,
    );
  });

  test("unknown enum values in a hand-edited URL are dropped, never sent", () => {
    const filters = filtersFromSearch(
      new URLSearchParams("sync=lost&voided=maybe&returns=most&erp=fiscal"),
    );
    expect(filters).toMatchObject({ syncStatus: "", voided: "", returnState: "", erpState: "" });
  });
});

describe("sale filters: readiness and the 31-day cap (FR-004, AC-2)", () => {
  test("nothing is ready until a store, a from date and a to date are set", () => {
    expect(isQueryReady(emptyFilters())).toBe(false);
    expect(isQueryReady({ ...base, storeId: "" })).toBe(false);
    expect(isQueryReady({ ...base, fromDate: "" })).toBe(false);
    expect(isQueryReady({ ...base, toDate: "" })).toBe(false);
    expect(isQueryReady(base)).toBe(true);
  });

  test("the span is counted in calendar days, both ends inclusive", () => {
    expect(spanDays("2026-10-01", "2026-10-01")).toBe(0);
    expect(spanDays("2026-10-01", "2026-10-31")).toBe(30);
    // Across the end of DST in Cairo and a month boundary: still calendar days.
    expect(spanDays("2026-10-25", "2026-11-03")).toBe(9);
    expect(MAX_SPAN_DAYS).toBe(30);
  });

  test("31 business days is accepted; 32 is refused before any request", () => {
    expect(validateFilters({ ...base, fromDate: "2026-10-01", toDate: "2026-10-31" })).toEqual({});
    expect(validateFilters({ ...base, fromDate: "2026-10-01", toDate: "2026-11-01" })).toEqual({
      range: "sales.filter.spanTooWide",
    });
  });

  test("a reversed range and an unreal date are errors", () => {
    expect(validateFilters({ ...base, fromDate: "2026-10-07", toDate: "2026-10-01" })).toEqual({
      range: "sales.filter.rangeReversed",
    });
    expect(validateFilters({ ...base, fromDate: "2026-02-30" })).toEqual({
      date: "sales.filter.dateInvalid",
    });
  });

  test("a sale number longer than the contract's 96 characters is refused", () => {
    expect(validateFilters({ ...base, saleNumber: "x".repeat(96) })).toEqual({});
    expect(validateFilters({ ...base, saleNumber: "x".repeat(97) })).toEqual({
      saleNumber: "sales.filter.saleNumberTooLong",
    });
  });
});

describe("sale filters: the list request", () => {
  test("only the contract's keys are sent, with the page size", () => {
    expect(buildListQuery(base)).toEqual({
      store_id: CAIRO_STORE,
      from: "2026-10-01",
      to: "2026-10-07",
      page_size: PAGE_SIZE,
    });
  });

  test("status filters map to the contract keys; voided is the boolean literal", () => {
    expect(
      buildListQuery({
        ...base,
        saleNumber: " R-0042 ",
        syncStatus: "synced",
        voided: "false",
        returnState: "none",
        erpState: "pending",
      }),
    ).toEqual({
      store_id: CAIRO_STORE,
      from: "2026-10-01",
      to: "2026-10-07",
      page_size: PAGE_SIZE,
      sale_number: "R-0042",
      sync_status: "synced",
      voided: false,
      return_state: "none",
      erp_posting_state: "pending",
    });
  });
});

describe("today in the store's zone (J1 default proposal)", () => {
  test("a 23:30 UTC instant is already the next day in Cairo", () => {
    const now = new Date("2026-10-07T23:30:00Z");
    expect(todayIn("Africa/Cairo", now)).toBe("2026-10-08");
    expect(todayIn("UTC", now)).toBe("2026-10-07");
  });

  test("an unknown zone falls back to UTC", () => {
    expect(todayIn("Not/AZone", new Date("2026-10-07T23:30:00Z"))).toBe("2026-10-07");
  });
});

describe("keyset paging: only nextCursor null ends the walk (FR-006, AC-1)", () => {
  test("an empty page with a cursor keeps the walk going", () => {
    expect(nextSaleCursor({ nextCursor: "abc" })).toBe("abc");
    expect(nextSaleCursor({ nextCursor: null })).toBeUndefined();
  });

  test("the list has ended only when the last loaded page's cursor is null", () => {
    expect(listEnded([])).toBe(false);
    expect(listEnded([{ nextCursor: "abc" }])).toBe(false);
    expect(listEnded([{ nextCursor: "abc" }, { nextCursor: null }])).toBe(true);
  });
});

describe("labels and gates", () => {
  test("nav mirrors the API's read roles; store_staff is not one", () => {
    expect(canReadSales("owner")).toBe(true);
    expect(canReadSales("tenant_admin")).toBe(true);
    expect(canReadSales("store_manager")).toBe(true);
    expect(canReadSales("store_staff")).toBe(false);
    expect(canReadSales(null)).toBe(false);
  });

  test("a route id that is not a UUID is never sent", () => {
    expect(isSaleRef(CAIRO_STORE)).toBe(true);
    expect(isSaleRef("R-0042")).toBe(false);
    expect(isSaleRef(undefined)).toBe(false);
  });

  test("machine codes map to catalog keys, with a fallback for unknown codes", () => {
    expect(syncStatusKey({ syncStatus: "failed-retryable" })).toBe("sales.sync.failedRetryable");
    expect(syncStatusKey({ syncStatus: "other" })).toBe("sales.sync.unknownCode");
    expect(returnStateKey({ returnState: "full" })).toBe("sales.returns.full");
    expect(erpStateKey({ erpPostingState: "unknown" })).toBe("sales.erp.unknown");
    expect(erpStateKey({ erpPostingState: "weird" })).toBe("sales.erp.unknown");
    expect(tenderMethodKey({ method: "card_external" })).toBe("sales.tender.card_external");
    expect(tenderMethodKey({ method: "voucher" })).toBe("sales.tender.unknownMethod");
  });

  test("the shift-close exception link names the store and the one business day", () => {
    expect(shiftClosesHref({ storeRef: CAIRO_STORE, businessDate: "2026-10-07" })).toBe(
      `/shift-closes?store=${CAIRO_STORE}&from=2026-10-07&to=2026-10-07`,
    );
  });
});
