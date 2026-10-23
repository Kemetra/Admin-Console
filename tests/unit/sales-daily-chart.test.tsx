import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ZERO_KPIS } from "./metric-claim-fixtures";
import { ctx, stores } from "./sale-fixtures";
import { CAIRO, EGP_USD_DAY, storeSummary, zeroDays } from "./sales-daily-fixtures";

const consoleGetSalesSummary = vi.fn();
vi.mock("@/lib/sales-summary-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sales-summary-queries")>();
  return {
    ...actual,
    consoleGetSalesSummary: (...a: unknown[]) => consoleGetSalesSummary(...a),
  };
});
const listStores = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, listStores: (...a: unknown[]) => listStores(...a) };
});
vi.mock("@/lib/sale-queries", () => ({
  consoleListSales: vi.fn(),
  consoleGetSale: vi.fn(),
}));
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { SalesDaily } from "@/sales-daily/SalesDaily";

/**
 * RT-823 (VIZ-5) the first chart: daily received-sales bars. The table stays
 * the source of truth: every bar links to its row, every figure is the
 * server's string, a partial day is a pattern plus words, unknown is never a
 * bar, and no state hides information in a tooltip.
 */

const ok = (data: unknown) => ({ status: 200, data });

const cairoStore = (over: Partial<Parameters<typeof storeSummary>[0]> = {}) => ({
  ref: CAIRO,
  timeZone: "Africa/Cairo",
  currentBusinessDate: "2026-10-23",
  ...over,
});

/** The fixture's range totals carry a USD figure no day has; a one-currency read has none. */
function inEgpOnly(summary: ReturnType<typeof storeSummary>) {
  const totals = { ...ZERO_KPIS, receivedSales: { count: 0, byCurrency: [] } };
  return {
    ...summary,
    stores: summary.stores.map((s) => ({ ...s, rangeTotals: totals })),
    scopeTotals: { ...summary.scopeTotals, rangeTotals: totals },
  };
}

const egp = (total: string) => ({
  ...ZERO_KPIS,
  receivedSales: { count: 1, byCurrency: [{ currencyCode: "EGP", count: 1, total }] },
});

function renderReport(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={["/sales-daily"]}>
        <Routes>
          <Route path="/sales-daily" element={<SalesDaily />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const chart = async () => screen.findByRole("figure");
const bars = (figure: HTMLElement) => within(figure).getAllByRole("link");
const barOf = (figure: HTMLElement, date: string) =>
  bars(figure).find((b) => b.getAttribute("href") === `#sales-daily-day-${date}`);

describe("DailyChart (RT-823, VIZ-5)", () => {
  beforeEach(() => {
    setLocale("en");
    consoleGetSalesSummary.mockReset();
    listStores.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx("owner", "t1", CAIRO));
    listStores.mockResolvedValue({ status: 200, data: stores });
    consoleGetSalesSummary.mockResolvedValue(
      ok(
        inEgpOnly(
          storeSummary(cairoStore(), undefined, {
            "2026-10-20": egp("1250.5000"),
            "2026-10-21": egp("400.0000"),
            "2026-10-23": egp("75.2500"),
          }),
        ),
      ),
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T09:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    setLocale("en");
  });

  test("a figure labelled as a summary of the table, with one bar link per day", async () => {
    renderReport();
    const figure = await chart();
    expect(within(figure).getByText(/summary of the table below/i)).toBeDefined();
    expect(bars(figure)).toHaveLength(8);
    // The SVG is a group, not an image: a role="img" would hide the bars.
    expect(figure.querySelector("svg")?.getAttribute("role")).toBe("group");
  });

  test("direct labels are the server's figures, exact, without the currency", async () => {
    renderReport();
    const figure = await chart();
    expect(within(figure).getByText("1,250.50")).toBeDefined();
    expect(within(figure).getByText("400.00")).toBeDefined();
    expect(within(figure).getByText("75.25")).toBeDefined();
    expect(figure.textContent).not.toContain("1,250.5 ");
  });

  test("each bar names its date, exact value and currency, and points at its table row", async () => {
    renderReport();
    const figure = await chart();
    const bar = barOf(figure, "2026-10-20");
    expect(bar?.getAttribute("aria-label")).toMatch(/Oct 20, 2026.*1,250\.50 EGP/);
    expect(document.getElementById("sales-daily-day-2026-10-20")?.tagName).toBe("TR");
  });

  test("activating a bar moves focus to its table row, which is not a tab stop", async () => {
    renderReport();
    const figure = await chart();
    fireEvent.click(barOf(figure, "2026-10-20") as Element);
    const row = document.getElementById("sales-daily-day-2026-10-20");
    expect(document.activeElement).toBe(row);
    expect(row?.getAttribute("tabindex")).toBe("-1");
  });

  test("today is a partial day: patterned bar, and 'So far' in words", async () => {
    renderReport();
    const figure = await chart();
    const today = barOf(figure, "2026-10-23");
    expect(today?.getAttribute("aria-label")).toMatch(/so far/i);
    expect(today?.textContent).toMatch(/so far/i);
    expect(today?.querySelector(".daily-chart__bar--so-far")).not.toBeNull();
    const complete = barOf(figure, "2026-10-20");
    expect(complete?.querySelector(".daily-chart__bar--so-far")).toBeNull();
    expect(complete?.textContent).not.toMatch(/so far/i);
  });

  test("a date missing from the read is Unknown, drawn without a bar and never as 0", async () => {
    consoleGetSalesSummary.mockResolvedValue(
      ok(
        storeSummary(
          cairoStore({
            days: zeroDays("2026-10-16", "2026-10-23", {
              "2026-10-20": egp("1250.5000"),
            }).filter((d) => d.businessDate !== "2026-10-19"),
          }),
        ),
      ),
    );
    renderReport();
    const figure = await chart();
    const missing = barOf(figure, "2026-10-19");
    expect(missing?.getAttribute("aria-label")).toMatch(/unknown/i);
    expect(missing?.textContent).toMatch(/unknown/i);
    expect(missing?.querySelector("rect.daily-chart__bar")).toBeNull();
    expect(missing?.textContent).not.toMatch(/\b0\.00\b/);
  });

  test("a day after the store's current day is 'Not begun', not a zero bar", async () => {
    consoleGetSalesSummary.mockResolvedValue(
      ok(
        storeSummary(cairoStore({ currentBusinessDate: "2026-10-22" }), undefined, {
          "2026-10-20": egp("10.0000"),
        }),
      ),
    );
    renderReport();
    const figure = await chart();
    const later = barOf(figure, "2026-10-23");
    expect(later?.textContent).toMatch(/not begun/i);
    expect(later?.querySelector("rect.daily-chart__bar")).toBeNull();
  });

  test("one currency: no selector", async () => {
    renderReport();
    await chart();
    expect(screen.queryByLabelText(/^currency$/i)).toBeNull();
  });

  test("two currencies: the selector switches the series, never adding them", async () => {
    consoleGetSalesSummary.mockResolvedValue(
      ok(storeSummary(cairoStore(), undefined, { "2026-10-20": EGP_USD_DAY })),
    );
    renderReport();
    const figure = await chart();
    const select = screen.getByLabelText(/^currency$/i) as HTMLSelectElement;
    expect(select.value).toBe("EGP");
    expect(within(figure).getByText("1,250.50")).toBeDefined();
    fireEvent.change(select, { target: { value: "USD" } });
    expect(within(figure).getByText("40.00")).toBeDefined();
    expect(within(figure).queryByText("1,250.50")).toBeNull();
    expect(figure.textContent).not.toContain("1,290.50");
  });

  test("the axis is abbreviated; the table keeps the exact values", async () => {
    renderReport();
    const figure = await chart();
    const axis = figure.querySelectorAll(".daily-chart__tick");
    expect(axis.length).toBe(5);
    expect(axis[0].textContent).toBe("0");
    const table = screen.getByRole("table", { name: /received sales, voids, returns/i });
    expect(table.textContent).toContain("1,250.50 EGP");
  });

  test("no information lives only in a tooltip: no <title> inside the chart", async () => {
    renderReport();
    const figure = await chart();
    expect(figure.querySelector("title")).toBeNull();
  });

  test("no animation: nothing in the chart animates", async () => {
    renderReport();
    const figure = await chart();
    expect(figure.querySelector("animate, animateTransform, set")).toBeNull();
  });

  test("a range with no received sale shows a sentence, not empty axes", async () => {
    consoleGetSalesSummary.mockResolvedValue(ok(inEgpOnly(storeSummary(cairoStore()))));
    renderReport();
    expect(await screen.findByText(/no sales were received in this range/i)).toBeDefined();
    expect(screen.queryByRole("figure")).toBeNull();
  });

  test("while loading there is no chart", async () => {
    consoleGetSalesSummary.mockReturnValue(new Promise(() => undefined));
    renderReport();
    expect(await screen.findByText(/loading the report/i)).toBeDefined();
    expect(screen.queryByRole("figure")).toBeNull();
  });

  test("on an error there is no chart", async () => {
    consoleGetSalesSummary.mockResolvedValue({
      status: 500,
      error: {
        error: {
          code: "internal",
          message: "x",
          request_id: "0190f000-0000-7000-8000-00000000e823",
        },
      },
    });
    renderReport();
    expect(await screen.findByText(/could not be loaded/i)).toBeDefined();
    expect(screen.queryByRole("figure")).toBeNull();
  });

  test("RTL: Arabic mirrors the time axis, earliest day on the right", async () => {
    setLocale("ar");
    renderReport();
    const figure = await chart();
    const hits = Array.from(figure.querySelectorAll("a rect.daily-chart__hit"));
    const xs = hits.map((r) => Number(r.getAttribute("x")));
    expect(xs[0]).toBeGreaterThan(xs.at(-1) as number);
  });
});

/**
 * RT-824 (VIZ-6) the export button: one click hands the browser a Blob of
 * the report's CSV (UTF-8 BOM first) as a file named for the range, and
 * makes no request.
 */

/** jsdom's Blob has no arrayBuffer(); FileReader reads the same bytes. */
function bytesOf(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

const createObjectURL = vi.fn(() => "blob:test");
const revokeObjectURL = vi.fn();
let clicked: { download: string; href: string } | null = null;

describe("ExportButton (RT-824, VIZ-6)", () => {
  beforeEach(() => {
    setLocale("en");
    consoleGetSalesSummary.mockReset();
    listStores.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx("owner", "t1", CAIRO));
    listStores.mockResolvedValue({ status: 200, data: stores });
    consoleGetSalesSummary.mockResolvedValue(
      ok(
        storeSummary(
          { ref: CAIRO, timeZone: "Africa/Cairo", currentBusinessDate: "2026-10-23" },
          undefined,
          { "2026-10-20": EGP_USD_DAY },
        ),
      ),
    );
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    clicked = null;
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked = { download: this.download, href: this.href };
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T09:00:00Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setLocale("en");
  });

  test("a click downloads the CSV as a file named for the range, as a UTF-8 Blob with a BOM", async () => {
    renderReport();
    fireEvent.click(await screen.findByRole("button", { name: "Export CSV" }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe("text/csv;charset=utf-8");
    const bytes = new Uint8Array(await bytesOf(blob));
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(clicked).toEqual({
      download: "sales-daily_2026-10-16_2026-10-23.csv",
      href: "blob:test",
    });
  });

  test("the file holds the exact figures and names the store", async () => {
    renderReport();
    fireEvent.click(await screen.findByRole("button", { name: "Export CSV" }));
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    const text = new TextDecoder().decode(await bytesOf(blob));
    expect(text).toContain("1250.5000");
    expect(text).toContain("completeness,received_only");
    expect(text).toContain("Cairo Festival");
  });

  test("while loading or on an error there is nothing to export", async () => {
    consoleGetSalesSummary.mockReturnValue(new Promise(() => undefined));
    renderReport();
    expect(await screen.findByText(/loading the report/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Export CSV" })).toBeNull();
  });
});
