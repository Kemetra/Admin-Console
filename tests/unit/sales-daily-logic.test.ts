import { describe, expect, test } from "vitest";
import { ZERO_KPIS } from "./metric-claim-fixtures";
import {
  CAIRO,
  EGP_USD_DAY,
  NEW_YORK,
  RANGE_TOTALS,
  scopeSummary,
  storeSummary,
  zeroDays,
} from "./sales-daily-fixtures";

import {
  buildSummaryQuery,
  defaultRange,
  rangeFromSearch,
  rangeToSearch,
  reportModel,
  validateRange,
} from "@/sales-daily/dailyLogic";

/**
 * RT-821 (VIZ-3) pure rules of the daily received-sales report: the range
 * bounds, the default range, which day is partial, unknown ≠ zero, mixed zones
 * and totals that come from the server only.
 */

describe("range bounds (inclusive, at most 31 business days)", () => {
  test("a 31-day inclusive range is accepted; 32 days is refused at the To field", () => {
    expect(validateRange({ from: "2026-10-01", to: "2026-10-31" })).toEqual({});
    expect(validateRange({ from: "2026-10-01", to: "2026-11-01" })).toEqual({
      to: "sales.filter.spanTooWide",
    });
  });

  test("one day is a valid range; To before From is refused at the To field", () => {
    expect(validateRange({ from: "2026-10-05", to: "2026-10-05" })).toEqual({});
    expect(validateRange({ from: "2026-10-05", to: "2026-10-04" })).toEqual({
      to: "sales.filter.rangeReversed",
    });
  });

  test("a value that is not a calendar day is refused at its own field", () => {
    expect(validateRange({ from: "2026-02-30", to: "2026-03-01" })).toEqual({
      from: "sales.filter.dateInvalid",
    });
    expect(validateRange({ from: "2026-03-01", to: "nope" })).toEqual({
      to: "sales.filter.dateInvalid",
    });
  });

  test("the URL carries both dates or neither", () => {
    expect(rangeFromSearch(new URLSearchParams("from=2026-10-01&to=2026-10-07"))).toEqual({
      from: "2026-10-01",
      to: "2026-10-07",
    });
    expect(rangeFromSearch(new URLSearchParams("from=2026-10-01"))).toBeNull();
    expect(rangeToSearch({ from: "2026-10-01", to: "2026-10-07" }).toString()).toBe(
      "from=2026-10-01&to=2026-10-07",
    );
  });
});

describe("default range: the last 7 completed days plus today", () => {
  test("today is the store's own calendar day, never the viewer's", () => {
    // 23:30 UTC is already the 24th in Cairo.
    const now = new Date("2026-10-23T23:30:00Z");
    expect(defaultRange(["Africa/Cairo"], now)).toEqual({ from: "2026-10-17", to: "2026-10-24" });
    expect(defaultRange(["America/New_York"], now)).toEqual({
      from: "2026-10-16",
      to: "2026-10-23",
    });
  });

  test("mixed zones end on the latest today, so every store's today is in range", () => {
    const now = new Date("2026-10-23T23:30:00Z");
    expect(defaultRange(["America/New_York", "Africa/Cairo"], now).to).toBe("2026-10-24");
  });

  test("no zone known yet falls back to UTC", () => {
    expect(defaultRange([], new Date("2026-10-23T10:00:00Z"))).toEqual({
      from: "2026-10-16",
      to: "2026-10-23",
    });
  });
});

describe("the request", () => {
  test("a store scope sends store_id; a whole scope asks for one 50-store page", () => {
    const range = { from: "2026-10-16", to: "2026-10-23" };
    expect(buildSummaryQuery(range, CAIRO)).toEqual({ ...range, store_id: CAIRO });
    expect(buildSummaryQuery(range, null)).toEqual({ ...range, page_size: 50 });
  });
});

describe("rows and the partial day", () => {
  test("one row per business date; today is 'so far' and earlier days are complete", () => {
    const model = reportModel(
      storeSummary({ ref: CAIRO, timeZone: "Africa/Cairo", currentBusinessDate: "2026-10-23" }),
    );
    expect(model.rows.map((r) => r.date)).toEqual([
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
    ]);
    expect(model.rows.at(-1)?.state).toBe("so-far");
    expect(model.rows.slice(0, -1).every((r) => r.state === "complete")).toBe(true);
    expect(model.partial).toBe(true);
  });

  test("a day after the store's current business day has not begun (never a plain 0)", () => {
    const model = reportModel(
      storeSummary({ ref: CAIRO, timeZone: "Africa/Cairo", currentBusinessDate: "2026-10-22" }),
    );
    expect(model.rows.at(-2)?.state).toBe("so-far");
    expect(model.rows.at(-1)?.state).toBe("not-begun");
  });

  test("a fully past range is complete", () => {
    const model = reportModel(
      storeSummary(
        { ref: CAIRO, timeZone: "Africa/Cairo", currentBusinessDate: "2026-10-23" },
        { from: "2026-10-01", to: "2026-10-07" },
      ),
    );
    expect(model.partial).toBe(false);
  });
});

describe("unknown ≠ zero", () => {
  test("a business date missing from days[] is an unknown row, not a zero row", () => {
    const summary = storeSummary({
      ref: CAIRO,
      timeZone: "Africa/Cairo",
      currentBusinessDate: "2026-10-23",
      days: zeroDays("2026-10-16", "2026-10-23").filter((d) => d.businessDate !== "2026-10-19"),
    });
    const row = reportModel(summary).rows.find((r) => r.date === "2026-10-19");
    expect(row?.kpis).toBeNull();
  });

  test("a returned zero day keeps its real zeros", () => {
    const model = reportModel(
      storeSummary({ ref: CAIRO, timeZone: "Africa/Cairo", currentBusinessDate: "2026-10-23" }),
    );
    expect(model.rows[0].kpis).toEqual(ZERO_KPIS);
  });

  test("a store read with no store row has unknown rows and unknown totals", () => {
    const summary = {
      ...storeSummary({ ref: CAIRO, timeZone: "Africa/Cairo", currentBusinessDate: "2026-10-23" }),
      stores: [],
    };
    const model = reportModel(summary);
    expect(model.rows.every((r) => r.kpis === null)).toBe(true);
    expect(model.totals).toBeNull();
  });
});

describe("range totals come from the server only", () => {
  test("store scope: the store's rangeTotals, as returned", () => {
    const model = reportModel(
      storeSummary(
        { ref: CAIRO, timeZone: "Africa/Cairo", currentBusinessDate: "2026-10-23" },
        undefined,
        { "2026-10-20": EGP_USD_DAY },
      ),
    );
    expect(model.totals).toBe(RANGE_TOTALS);
  });

  test("all in scope: scopeTotals days and rangeTotals", () => {
    const model = reportModel(
      scopeSummary([{ ref: CAIRO, timeZone: "Africa/Cairo", currentBusinessDate: "2026-10-23" }], {
        days: { "2026-10-20": EGP_USD_DAY },
      }),
    );
    expect(model.rows.find((r) => r.date === "2026-10-20")?.kpis).toBe(EGP_USD_DAY);
    expect(model.totals).toBe(RANGE_TOTALS);
  });
});

describe("mixed zones (all in scope)", () => {
  const mixed = [
    { ref: CAIRO, timeZone: "Africa/Cairo", currentBusinessDate: "2026-10-24" },
    { ref: NEW_YORK, timeZone: "America/New_York", currentBusinessDate: "2026-10-23" },
  ];

  test("every zone is listed once, and the store count is the server's", () => {
    const model = reportModel(
      scopeSummary(mixed, { range: { from: "2026-10-17", to: "2026-10-24" }, storeCount: 2 }),
    );
    expect(model.zones).toEqual(["Africa/Cairo", "America/New_York"]);
    expect(model.storeCount).toBe(2);
    expect(model.zonesComplete).toBe(true);
  });

  test("'so far' starts at the earliest store's current day", () => {
    const model = reportModel(
      scopeSummary(mixed, { range: { from: "2026-10-17", to: "2026-10-24" } }),
    );
    const state = (d: string) => model.rows.find((r) => r.date === d)?.state;
    expect(state("2026-10-22")).toBe("complete");
    expect(state("2026-10-23")).toBe("so-far");
    expect(state("2026-10-24")).toBe("so-far");
  });

  test("a later page of stores is never walked: zones are marked incomplete, so-far stays conservative", () => {
    const model = reportModel(
      scopeSummary([mixed[0]], {
        range: { from: "2026-10-17", to: "2026-10-24" },
        storeCount: 60,
        nextCursor: "c2",
      }),
      "2026-10-24",
    );
    expect(model.storeCount).toBe(60);
    expect(model.zonesComplete).toBe(false);
    // A store on a later page can be as far west as UTC-12: the UTC day before is not over there.
    const state = (d: string) => model.rows.find((r) => r.date === d)?.state;
    expect(state("2026-10-22")).toBe("complete");
    expect(state("2026-10-23")).toBe("so-far");
  });

  test("a scope with no store marks no day partial", () => {
    const model = reportModel(scopeSummary([], { storeCount: 0 }));
    expect(model.partial).toBe(false);
    expect(model.zones).toEqual([]);
  });
});
