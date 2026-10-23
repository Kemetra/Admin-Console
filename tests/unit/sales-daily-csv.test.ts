import { CSV_BOM, buildCsv, csvText } from "@/sales-daily/csvExport";
import { reportModel } from "@/sales-daily/dailyLogic";
import { describe, expect, test } from "vitest";
import { ZERO_KPIS } from "./metric-claim-fixtures";
import {
  CAIRO,
  EGP_USD_DAY,
  RANGE_TOTALS,
  scopeSummary,
  storeSummary,
} from "./sales-daily-fixtures";

/**
 * RT-824 (VIZ-6) the CSV of the daily report: exactly the report rows, server
 * decimal strings as given, a context header, formula-injection guard on text
 * cells, UTF-8 with a BOM.
 */

const TOKEN = /("(?:[^"]|"")*"|[^,\r\n]*)(,|\r\n|$)/g;
const unquote = (cell: string) =>
  cell.startsWith('"') ? cell.slice(1, -1).replaceAll('""', '"') : cell;

/** A small RFC 4180 reader, to test what a spreadsheet would see. */
function parse(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  for (const [whole, cell, separator] of csv.replace(/^\uFEFF/, "").matchAll(TOKEN)) {
    if (whole === "") break;
    row.push(unquote(cell));
    if (separator !== ",") {
      rows.push(row);
      row = [];
    }
  }
  return rows;
}

const cairo = {
  ref: CAIRO,
  timeZone: "Africa/Cairo",
  currentBusinessDate: "2026-10-23",
};

function csvOf(
  summary = storeSummary(cairo, undefined, { "2026-10-20": EGP_USD_DAY }),
  storeName: string | null = "Cairo Festival",
  locale: "en" | "ar" = "en",
): string[][] {
  return parse(buildCsv(reportModel(summary, "2026-10-23"), { locale, storeName }));
}

const find = (rows: string[][], first: string) => rows.find((r) => r[0] === first);

describe("csvText: formula-injection guard", () => {
  test.each(["=1+1", "+1", "-1", "@SUM(A1)", "\tcmd", "\rcmd"])("%j is prefixed", (text) => {
    expect(csvText(text).replace(/^"|"$/g, "").startsWith("'")).toBe(true);
  });

  test("a hostile store name cannot run as a formula and stays readable", () => {
    expect(csvText('=HYPERLINK("http://x","go")')).toBe(`"'=HYPERLINK(""http://x"",""go"")"`);
  });

  test("ordinary and Arabic text is untouched", () => {
    expect(csvText("Cairo Festival")).toBe("Cairo Festival");
    expect(csvText("متجر القاهرة")).toBe("متجر القاهرة");
  });

  test("commas, quotes and line breaks are quoted", () => {
    expect(csvText("a,b")).toBe('"a,b"');
    expect(csvText('say "hi"')).toBe('"say ""hi"""');
    expect(csvText("a\nb")).toBe('"a\nb"');
  });
});

describe("buildCsv", () => {
  test("starts with a UTF-8 BOM and uses CRLF line ends", () => {
    const csv = buildCsv(reportModel(storeSummary(cairo), "2026-10-23"), {
      locale: "en",
      storeName: null,
    });
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(CSV_BOM).toBe("\uFEFF");
    expect(csv.includes("\r\n")).toBe(true);
    expect(csv.replace(/\r\n/g, "").includes("\n")).toBe(false);
  });

  test("the context header: scope, store with zone, range, calendar, asOf, completeness", () => {
    const rows = csvOf();
    expect(find(rows, "scope")).toEqual(["scope", "store"]);
    expect(find(rows, "store")).toEqual(["store", CAIRO, "Africa/Cairo", "Cairo Festival"]);
    expect(find(rows, "range_from")).toEqual(["range_from", "2026-10-16"]);
    expect(find(rows, "range_to")).toEqual(["range_to", "2026-10-23"]);
    expect(find(rows, "as_of_utc")).toEqual(["as_of_utc", "2026-10-23T09:15:00Z"]);
    expect(find(rows, "completeness")).toEqual(["completeness", "received_only"]);
    expect(find(rows, "calendar")?.[1]).toMatch(/each store's local business day/i);
  });

  test("a range that includes a day still running says so", () => {
    expect(find(csvOf(), "includes_days_so_far")?.[1]).toMatch(/so far/i);
  });

  test("a whole scope lists every store read with its zone", () => {
    const rows = csvOf(
      scopeSummary([
        cairo,
        {
          ref: "0190f000-0000-7000-8000-0000000005a2",
          timeZone: "America/New_York",
          currentBusinessDate: "2026-10-23",
        },
      ]),
      null,
    );
    expect(find(rows, "scope")).toEqual(["scope", "all_in_scope"]);
    expect(rows.filter((r) => r[0] === "store")).toHaveLength(2);
    expect(rows.some((r) => r[2] === "America/New_York")).toBe(true);
  });

  test("a store name that is a formula is neutralised in the header", () => {
    const rows = csvOf(undefined, "=cmd|' /C calc'!A0");
    expect(find(rows, "store")?.[3]).toBe("'=cmd|' /C calc'!A0");
  });

  test("every metric is defined in the header, in the locale", () => {
    const defs = csvOf().filter((r) => r[0] === "definition");
    expect(defs).toHaveLength(7);
    expect(defs[0][1]).toBe("Received sales");
    const ar = csvOf(undefined, null, "ar").filter((r) => r[0] === "definition");
    expect(ar[0][1]).not.toBe("Received sales");
  });

  describe("the rows", () => {
    const rows = csvOf();
    const head = rows.find((r) => r[0] === "business_date") as string[];
    const col = (name: string) => head.indexOf(name);
    const dayRow = (date: string) => rows.find((r) => r[0] === date) as string[];

    test("one row per business day plus the range total, in order", () => {
      const days = rows.filter((r) => /^\d{4}-\d\d-\d\d$/.test(r[0]));
      expect(days.map((r) => r[0])).toEqual([
        "2026-10-16",
        "2026-10-17",
        "2026-10-18",
        "2026-10-19",
        "2026-10-20",
        "2026-10-21",
        "2026-10-22",
        "2026-10-23",
      ]);
      expect(find(rows, "range_total")).toBeDefined();
    });

    test("server decimal strings exactly as given, never re-rounded", () => {
      const r = dayRow("2026-10-20");
      expect(r[col("received_sales_EGP_total")]).toBe("1250.5000");
      expect(r[col("received_sales_USD_total")]).toBe("40.0000");
      expect(r[col("voids_EGP_total")]).toBe("30.0000");
    });

    test("counts are the server's counts, per metric and per currency", () => {
      const r = dayRow("2026-10-20");
      expect(r[col("received_sales_count")]).toBe("5");
      expect(r[col("received_sales_EGP_count")]).toBe("4");
      expect(r[col("erp_unknown")]).toBe("2");
      expect(r[col("shift_closes_approval_missing_unknown")]).toBe("1");
    });

    test("the range total is the server's rangeTotals, never a sum of the rows", () => {
      const total = find(rows, "range_total") as string[];
      expect(total[col("received_sales_EGP_total")]).toBe("9999.2500");
      expect(total[col("received_sales_count")]).toBe("77");
    });

    test("the day state is in the row: complete, so_far", () => {
      expect(dayRow("2026-10-20")[col("day_state")]).toBe("complete");
      expect(dayRow("2026-10-23")[col("day_state")]).toBe("so_far");
    });

    test("a day with no sale in a currency is a real zero, not unknown", () => {
      const r = dayRow("2026-10-19");
      expect(r[col("received_sales_count")]).toBe("0");
      expect(r[col("received_sales_EGP_total")]).toBe("0");
    });
  });

  test("a date missing from the read is 'unknown', never 0", () => {
    const summary = storeSummary(cairo);
    const store = summary.stores[0];
    const days = store.days.filter((d) => d.businessDate !== "2026-10-19");
    const rows = csvOf({
      ...summary,
      stores: [{ ...store, days }],
      scopeTotals: { ...summary.scopeTotals, days },
    });
    const head = rows.find((r) => r[0] === "business_date") as string[];
    const r = rows.find((x) => x[0] === "2026-10-19") as string[];
    expect(r[head.indexOf("day_state")]).toBe("unknown");
    expect(r[head.indexOf("received_sales_count")]).toBe("unknown");
  });

  test("every data row has the same number of cells as the header", () => {
    const rows = csvOf();
    const head = rows.find((r) => r[0] === "business_date") as string[];
    const start = rows.indexOf(head);
    for (const r of rows.slice(start)) expect(r).toHaveLength(head.length);
  });

  test("a negative server decimal is a number, not prefixed", () => {
    const summary = storeSummary(cairo, undefined, {
      "2026-10-20": {
        ...ZERO_KPIS,
        returns: { count: 1, byCurrency: [{ currencyCode: "EGP", count: 1, total: "-5.5000" }] },
      },
    });
    const rows = csvOf(summary);
    const head = rows.find((r) => r[0] === "business_date") as string[];
    const r = rows.find((x) => x[0] === "2026-10-20") as string[];
    expect(r[head.indexOf("returns_EGP_total")]).toBe("-5.5000");
  });

  test("RANGE_TOTALS carries currencies no day has: their columns exist", () => {
    const head = csvOf(storeSummary(cairo)).find((r) => r[0] === "business_date") as string[];
    expect(RANGE_TOTALS.receivedSales.byCurrency.map((c) => c.currencyCode)).toEqual([
      "EGP",
      "USD",
    ]);
    expect(head).toContain("received_sales_USD_total");
  });
});
