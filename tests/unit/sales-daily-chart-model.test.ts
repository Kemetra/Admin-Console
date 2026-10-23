import { barPosition, chartModel, currenciesOf, niceMax, slotFor } from "@/sales-daily/chartModel";
import { type DayRow, type ReportModel, reportModel } from "@/sales-daily/dailyLogic";
import { describe, expect, test } from "vitest";
import { ZERO_KPIS } from "./metric-claim-fixtures";
import { CAIRO, EGP_USD_DAY, storeSummary } from "./sales-daily-fixtures";

/**
 * RT-823 (VIZ-5) the chart geometry: pure, built from the report model. A
 * value is the server's decimal string; numbers exist only for geometry.
 */

const egp = (total: string) => ({
  ...ZERO_KPIS,
  receivedSales: {
    count: 1,
    byCurrency: [{ currencyCode: "EGP", count: 1, total }],
  },
});

function model(rows: DayRow[]): ReportModel {
  return {
    scope: "store",
    storeRef: CAIRO,
    rows,
    totals: null,
    partial: false,
    storeCount: 1,
    stores: [],
    zones: ["Africa/Cairo"],
    zonesComplete: true,
    asOf: "2026-10-23T09:15:00Z",
  };
}

const row = (date: string, kpis: DayRow["kpis"], state: DayRow["state"] = "complete"): DayRow => ({
  date,
  state,
  kpis,
});

describe("currenciesOf", () => {
  test("the union over rows and totals, in first-seen order, never summed", () => {
    const m = reportModel(
      storeSummary(
        { ref: CAIRO, timeZone: "Africa/Cairo", currentBusinessDate: "2026-10-23" },
        undefined,
        {
          "2026-10-20": EGP_USD_DAY,
        },
      ),
    );
    expect(currenciesOf(m)).toEqual(["EGP", "USD"]);
  });

  test("no received sale in any currency: none", () => {
    expect(currenciesOf(model([row("2026-10-22", ZERO_KPIS)]))).toEqual([]);
  });
});

describe("chartModel", () => {
  const rows = [
    row("2026-10-21", egp("100.0000")),
    row("2026-10-22", null),
    row("2026-10-23", egp("250.5000"), "so-far"),
  ];

  test("a bar's label is the server figure, without re-rounding", () => {
    const c = chartModel(model(rows), "EGP", "ltr");
    expect(c.bars.map((b) => b.label)).toEqual(["100.00", null, "250.50"]);
  });

  test("a date missing from the read is unknown: no bar, never zero", () => {
    const c = chartModel(model(rows), "EGP", "ltr");
    const unknown = c.bars[1];
    expect(unknown.kind).toBe("unknown");
    expect(unknown.height).toBe(0);
    expect(unknown.label).toBeNull();
  });

  test("a present day with no sale in the currency is a real zero", () => {
    const c = chartModel(
      model([row("2026-10-21", ZERO_KPIS), row("2026-10-22", egp("5.0000"))]),
      "EGP",
      "ltr",
    );
    expect(c.bars[0].kind).toBe("value");
    expect(c.bars[0].label).toBe("0.00");
    expect(c.bars[0].height).toBe(0);
  });

  test("a day not yet begun has no bar and keeps its state", () => {
    const c = chartModel(model([row("2026-10-24", ZERO_KPIS, "not-begun")]), "EGP", "ltr");
    expect(c.bars[0].kind).toBe("not-begun");
    expect(c.bars[0].height).toBe(0);
  });

  test("the day state travels with the bar", () => {
    const c = chartModel(model(rows), "EGP", "ltr");
    expect(c.bars.map((b) => b.state)).toEqual(["complete", "complete", "so-far"]);
  });

  test("the baseline is zero: the tallest bar fills the nice maximum, a half bar half of it", () => {
    const c = chartModel(
      model([row("2026-10-21", egp("50.0000")), row("2026-10-22", egp("100.0000"))]),
      "EGP",
      "ltr",
    );
    expect(c.max).toBe(100);
    expect(c.bars[1].height).toBeCloseTo(c.plotHeight);
    expect(c.bars[0].height).toBeCloseTo(c.plotHeight / 2);
    expect(c.bars[1].y + c.bars[1].height).toBeCloseTo(c.baselineY);
  });

  test("all zero: a maximum of 1, no division by zero", () => {
    const c = chartModel(model([row("2026-10-21", ZERO_KPIS)]), "EGP", "ltr");
    expect(c.max).toBe(1);
    for (const b of c.bars) expect(Number.isFinite(b.height)).toBe(true);
  });

  test("ticks run from zero to the maximum", () => {
    const c = chartModel(model([row("2026-10-21", egp("1250.5000"))]), "EGP", "ltr");
    expect(c.ticks[0].value).toBe(0);
    expect(c.ticks.at(-1)?.value).toBe(c.max);
    expect(c.max).toBeGreaterThanOrEqual(1250.5);
  });

  test("LTR: the earliest day is leftmost", () => {
    const c = chartModel(model(rows), "EGP", "ltr");
    expect(c.bars[0].x).toBeLessThan(c.bars[2].x);
  });

  test("RTL: the time axis is mirrored, the earliest day is rightmost", () => {
    const c = chartModel(model(rows), "EGP", "rtl");
    expect(c.bars[0].x).toBeGreaterThan(c.bars[2].x);
  });

  test("the other currency is read on its own", () => {
    const m = model([row("2026-10-21", EGP_USD_DAY)]);
    expect(chartModel(m, "USD", "ltr").bars[0].label).toBe("40.00");
    expect(chartModel(m, "EGP", "ltr").bars[0].label).toBe("1,250.50");
  });
});

describe("niceMax / barPosition", () => {
  test("niceMax rounds up to 1, 2 or 5 times a power of ten", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(73)).toBe(100);
    expect(niceMax(250.5)).toBe(500);
    expect(niceMax(1250.5)).toBe(2000);
    expect(niceMax(100)).toBe(100);
  });

  test("barPosition mirrors in RTL and stays inside the plot", () => {
    const left = barPosition(0, 5, "ltr");
    const right = barPosition(0, 5, "rtl");
    expect(left).toBeLessThan(right);
  });
});

describe("slotFor", () => {
  test("a long exact figure widens the cell so labels never overlap", () => {
    expect(slotFor(["1.00", null])).toBe(52);
    expect(slotFor(["12,345,678.50"])).toBeGreaterThan(52);
  });
});
