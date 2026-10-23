import type { SalesSummary } from "@/lib/sales-summary-queries";
import {
  asSalesSummary,
  readWindow,
  salesDrillDown,
  scopeToday,
  storeToday,
} from "@/overview/salesTodayLogic";
import { describe, expect, test } from "vitest";
import { KPIS, ZERO_KPIS } from "./metric-claim-fixtures";

/** RT-820: P-6 selection rules. The server's figures are picked, never summed. */
type Store = SalesSummary["stores"][number];

const S1 = "0190f000-0000-7000-8000-0000000000a1";
const S2 = "0190f000-0000-7000-8000-0000000000a2";

function store(ref: string, date: string, dates: string[], zone = "Africa/Cairo"): Store {
  return {
    storeRef: ref,
    storeTimezone: zone,
    currentBusinessDate: date,
    days: dates.map((businessDate) => ({ businessDate, kpis: KPIS })),
    rangeTotals: KPIS,
  };
}

function summary(stores: Store[], over: Partial<SalesSummary> = {}): SalesSummary {
  return {
    scope: "all_in_scope",
    storeRef: null,
    from: "2026-10-15",
    to: "2026-10-17",
    asOf: "2026-10-15T22:30:00Z",
    completeness: "received_only",
    stores,
    nextCursor: null,
    scopeTotals: {
      storeCount: stores.length,
      days: [
        { businessDate: "2026-10-15", kpis: ZERO_KPIS },
        { businessDate: "2026-10-16", kpis: KPIS },
      ],
      rangeTotals: KPIS,
    },
    ...over,
  };
}

const ALL = ["2026-10-15", "2026-10-16", "2026-10-17"];

describe("readWindow (D4)", () => {
  test("is the UTC date minus one to plus one", () => {
    expect(readWindow(Date.parse("2026-10-15T22:30:00Z"))).toEqual({
      from: "2026-10-14",
      to: "2026-10-16",
    });
  });
  test("crosses a month boundary", () => {
    expect(readWindow(Date.parse("2026-10-31T23:59:00Z"))).toEqual({
      from: "2026-10-30",
      to: "2026-11-01",
    });
  });
});

describe("storeToday", () => {
  test("takes the day at the store's own currentBusinessDate", () => {
    const today = storeToday(store(S1, "2026-10-16", ALL));
    expect(today).toMatchObject({ state: "ready", date: "2026-10-16", kpis: KPIS });
  });

  test("a real zero stays ready, an absent date is unknown", () => {
    const zero: Store = {
      ...store(S1, "2026-10-16", []),
      days: [{ businessDate: "2026-10-16", kpis: ZERO_KPIS }],
    };
    expect(storeToday(zero)).toMatchObject({ state: "ready", kpis: ZERO_KPIS });
    const missing = storeToday(store(S2, "2026-10-17", ["2026-10-15", "2026-10-16"]));
    expect(missing).toEqual({
      state: "unknown",
      storeRef: S2,
      date: "2026-10-17",
      timeZone: "Africa/Cairo",
    });
  });
});

describe("scopeToday", () => {
  test("is the server's scope day when every store shares one date", () => {
    const total = scopeToday(
      summary([store(S1, "2026-10-16", ALL), store(S2, "2026-10-16", ALL, "Asia/Dubai")]),
    );
    expect(total).toMatchObject({ date: "2026-10-16", kpis: KPIS, storeCount: 2 });
    expect(total?.timeZones).toEqual(["Africa/Cairo", "Asia/Dubai"]);
  });

  test("is null for mixed dates", () => {
    expect(
      scopeToday(summary([store(S1, "2026-10-16", ALL), store(S2, "2026-10-15", ALL)])),
    ).toBeNull();
  });

  test("is null when more stores exist than this page holds", () => {
    const stores = [store(S1, "2026-10-16", ALL), store(S2, "2026-10-16", ALL)];
    expect(scopeToday(summary(stores, { nextCursor: "c1" }))).toBeNull();
    const s = summary(stores);
    expect(scopeToday({ ...s, scopeTotals: { ...s.scopeTotals, storeCount: 3 } })).toBeNull();
  });

  test("is null when the server has no such day, and for one store", () => {
    const stores = [store(S1, "2026-10-17", ALL), store(S2, "2026-10-17", ALL)];
    expect(scopeToday(summary(stores))).toBeNull();
    expect(scopeToday(summary([store(S1, "2026-10-16", ALL)], { scope: "store" }))).toBeNull();
  });
});

describe("salesDrillDown", () => {
  test("carries the store and the one business date, in the keys /sales parses", () => {
    expect(salesDrillDown(S1, "2026-10-16")).toBe(
      `/sales?store=${S1}&from=2026-10-16&to=2026-10-16`,
    );
  });
});

describe("asSalesSummary", () => {
  test("accepts a summary and rejects a malformed body", () => {
    expect(asSalesSummary(summary([store(S1, "2026-10-16", ALL)]))).toBeDefined();
    expect(asSalesSummary({})).toBeUndefined();
    expect(
      asSalesSummary({ stores: [{}], scopeTotals: { days: [], storeCount: 1 } }),
    ).toBeUndefined();
    expect(asSalesSummary(null)).toBeUndefined();
  });
});
