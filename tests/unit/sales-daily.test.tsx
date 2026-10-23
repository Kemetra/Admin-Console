import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ctx, stores } from "./sale-fixtures";
import {
  CAIRO,
  EGP_USD_DAY,
  NEW_YORK,
  scopeSummary,
  storeSummary,
  zeroDays,
} from "./sales-daily-fixtures";

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
const consoleListSales = vi.fn();
vi.mock("@/lib/sale-queries", () => ({
  consoleListSales: (...a: unknown[]) => consoleListSales(...a),
  consoleGetSale: vi.fn(),
}));
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { createQueryClient } from "@/lib/query";
import { SalesDaily } from "@/sales-daily/SalesDaily";
import { SaleList } from "@/sales/SaleList";

/**
 * RT-821 (VIZ-3) the daily received-sales report: one read per range, rows
 * as the server returned them, totals from `rangeTotals`, the partial day in
 * words, unknown never shown as zero, and mixed zones named.
 */

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderReport(entry = "/sales-daily"): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/sales" element={<SaleList />} />
          <Route path="/sales-daily" element={<SalesDaily />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ok = (data: unknown) => ({ status: 200, data });
const failure = (status: number, code: string) => ({
  status,
  error: { error: { code, message: "x", request_id: "0190f000-0000-7000-8000-00000000e821" } },
});

const cairoStore = (over: Partial<Parameters<typeof storeSummary>[0]> = {}) => ({
  ref: CAIRO,
  timeZone: "Africa/Cairo",
  currentBusinessDate: "2026-10-23",
  ...over,
});

async function moneyTable(): Promise<HTMLElement> {
  return screen.findByRole("table", { name: /received sales, voids, returns/i });
}

function rowOf(table: HTMLElement, date: string): HTMLElement {
  const row = table.querySelector<HTMLElement>(`tr[data-business-date="${date}"]`);
  if (!row) throw new Error(`no row for ${date}`);
  return row;
}

describe("SalesDaily (RT-821, VIZ-3)", () => {
  beforeEach(() => {
    consoleGetSalesSummary.mockReset();
    listStores.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx("owner", "t1", CAIRO));
    listStores.mockResolvedValue({ status: 200, data: stores });
    consoleGetSalesSummary.mockResolvedValue(ok(storeSummary(cairoStore())));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T09:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("no active tenant: the scope prompt, and nothing is read", async () => {
    activeContext.mockReturnValue(ctx("owner", null));
    renderReport();
    expect(await screen.findByText(/select a tenant to view sales/i)).toBeDefined();
    expect(consoleGetSalesSummary).not.toHaveBeenCalled();
  });

  test("a role the API refuses gets the non-disclosing state and no read", async () => {
    activeContext.mockReturnValue(ctx("store_staff", "t1", CAIRO));
    renderReport();
    expect(await screen.findByText(/not available to you/i)).toBeDefined();
    expect(consoleGetSalesSummary).not.toHaveBeenCalled();
  });

  test("default: the last 7 completed days plus today in the store's zone, read once", async () => {
    renderReport();
    await moneyTable();
    expect(consoleGetSalesSummary).toHaveBeenCalledTimes(1);
    expect(consoleGetSalesSummary).toHaveBeenCalledWith({
      from: "2026-10-16",
      to: "2026-10-23",
      store_id: CAIRO,
    });
    expect((screen.getByLabelText("From business date") as HTMLInputElement).value).toBe(
      "2026-10-16",
    );
  });

  describe("the partial day", () => {
    test("today's row says 'so far' in words; earlier rows do not", async () => {
      renderReport();
      const table = await moneyTable();
      expect(rowOf(table, "2026-10-23").textContent).toMatch(/so far/i);
      expect(rowOf(table, "2026-10-22").textContent).not.toMatch(/so far/i);
    });

    test("the range total says it includes a day still running", async () => {
      renderReport();
      const table = await moneyTable();
      const foot = table.querySelector("tfoot") as HTMLElement;
      expect(foot.textContent).toMatch(/includes days so far/i);
    });

    test("a day after the store's current day reads 'not yet begun', not a plain 0", async () => {
      consoleGetSalesSummary.mockResolvedValue(
        ok(storeSummary(cairoStore({ currentBusinessDate: "2026-10-22" }))),
      );
      renderReport();
      const table = await moneyTable();
      expect(rowOf(table, "2026-10-23").textContent).toMatch(/not yet begun/i);
    });
  });

  test("multi-currency: one line per currency, never added together, in days and totals", async () => {
    consoleGetSalesSummary.mockResolvedValue(
      ok(storeSummary(cairoStore(), undefined, { "2026-10-20": EGP_USD_DAY })),
    );
    renderReport();
    const table = await moneyTable();
    const day = rowOf(table, "2026-10-20");
    expect(day.textContent).toContain("1,250.50 EGP");
    expect(day.textContent).toContain("40.00 USD");
    expect(day.textContent).not.toContain("1,290.50");
    const foot = table.querySelector("tfoot") as HTMLElement;
    // Totals are the server's rangeTotals, figures no day adds up to.
    expect(foot.textContent).toContain("9,999.25 EGP");
    expect(foot.textContent).toContain("321.00 USD");
    expect(within(foot).getByText("77")).toBeDefined();
  });

  describe("unknown ≠ zero", () => {
    test("a date missing from the read is Unknown, a returned zero day is 0", async () => {
      consoleGetSalesSummary.mockResolvedValue(
        ok(
          storeSummary(
            cairoStore({
              days: zeroDays("2026-10-16", "2026-10-23").filter(
                (d) => d.businessDate !== "2026-10-19",
              ),
            }),
          ),
        ),
      );
      renderReport();
      const table = await moneyTable();
      const missing = rowOf(table, "2026-10-19");
      expect(within(missing).getAllByText("Unknown").length).toBeGreaterThan(0);
      expect(within(missing).queryByText("0")).toBeNull();
      const zero = rowOf(table, "2026-10-18");
      expect(within(zero).getAllByText("0")).toHaveLength(4);
      expect(within(zero).queryByText("Unknown")).toBeNull();
    });

    test("ERP 'unknown' and approval 'unknown' are named, never folded into a zero", async () => {
      consoleGetSalesSummary.mockResolvedValue(
        ok(storeSummary(cairoStore(), undefined, { "2026-10-20": EGP_USD_DAY })),
      );
      renderReport();
      const table = await screen.findByRole("table", { name: /sync state, erpnext posting/i });
      const day = rowOf(table, "2026-10-20");
      expect(day.textContent).toContain("Unknown: 2");
      expect(day.textContent).toContain("Approval missing, unknown: 1");
    });
  });

  describe("mixed zones (all in scope)", () => {
    beforeEach(() => {
      activeContext.mockReturnValue(ctx("owner", "t1"));
      vi.setSystemTime(new Date("2026-10-23T23:30:00Z"));
      consoleGetSalesSummary.mockResolvedValue(
        ok(
          scopeSummary(
            [
              { ref: CAIRO, timeZone: "Africa/Cairo", currentBusinessDate: "2026-10-24" },
              { ref: NEW_YORK, timeZone: "America/New_York", currentBusinessDate: "2026-10-23" },
            ],
            { range: { from: "2026-10-17", to: "2026-10-24" } },
          ),
        ),
      );
    });

    test("one scope read ending on the latest store's today, with the zones and the calendar named", async () => {
      renderReport();
      await moneyTable();
      expect(consoleGetSalesSummary).toHaveBeenCalledWith({
        from: "2026-10-17",
        to: "2026-10-24",
        page_size: 50,
      });
      const context = screen.getByTestId("sales-daily-context");
      expect(context.textContent).toContain(
        "All 2 stores in scope, by each store's local business day",
      );
      expect(context.textContent).toContain("Time zones: Africa/Cairo, America/New_York");
    });

    test("'so far' starts at the earliest store's current day", async () => {
      renderReport();
      const table = await moneyTable();
      expect(rowOf(table, "2026-10-22").textContent).not.toMatch(/so far/i);
      expect(rowOf(table, "2026-10-23").textContent).toMatch(/so far/i);
      expect(rowOf(table, "2026-10-24").textContent).toMatch(/so far/i);
    });

    test("more stores than one page: the count is the server's and the zone list says it is partial", async () => {
      consoleGetSalesSummary.mockResolvedValue(
        ok(
          scopeSummary(
            [{ ref: CAIRO, timeZone: "Africa/Cairo", currentBusinessDate: "2026-10-24" }],
            { range: { from: "2026-10-17", to: "2026-10-24" }, storeCount: 60, nextCursor: "c2" },
          ),
        ),
      );
      renderReport();
      await moneyTable();
      const context = screen.getByTestId("sales-daily-context");
      expect(context.textContent).toContain("All 60 stores in scope");
      expect(context.textContent).toMatch(/zones of the first 1 store/i);
      expect(consoleGetSalesSummary).toHaveBeenCalledTimes(1);
    });
  });

  describe("range bounds", () => {
    test("a range over 31 business days in the URL is refused at the To field; nothing is read", async () => {
      renderReport("/sales-daily?from=2026-10-01&to=2026-11-01");
      const to = await screen.findByLabelText("To business date");
      await waitFor(() => expect(to.getAttribute("aria-invalid")).toBe("true"));
      expect(screen.getByText(/narrow the range/i)).toBeDefined();
      expect(consoleGetSalesSummary).not.toHaveBeenCalled();
    });

    test("a 31-day inclusive range is read; applying a range writes it to the URL", async () => {
      renderReport("/sales-daily?from=2026-10-01&to=2026-10-31");
      await waitFor(() =>
        expect(consoleGetSalesSummary).toHaveBeenCalledWith({
          from: "2026-10-01",
          to: "2026-10-31",
          store_id: CAIRO,
        }),
      );
      fireEvent.change(screen.getByLabelText("From business date"), {
        target: { value: "2026-10-10" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Show" }));
      expect(screen.getByTestId("location").textContent).toBe(
        "/sales-daily?from=2026-10-10&to=2026-10-31",
      );
    });

    test("To before From is refused on Show, at the To field, with no read", async () => {
      renderReport("/sales-daily?from=2026-10-01&to=2026-10-07");
      await moneyTable();
      fireEvent.change(screen.getByLabelText("From business date"), {
        target: { value: "2026-10-09" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Show" }));
      expect(screen.getByLabelText("To business date").getAttribute("aria-invalid")).toBe("true");
      expect(consoleGetSalesSummary).toHaveBeenCalledTimes(1);
    });

    test("a server 400 shows at the To field, with no Retry", async () => {
      consoleGetSalesSummary.mockResolvedValue(failure(400, "validation_error"));
      renderReport("/sales-daily?from=2026-10-01&to=2026-10-07");
      const to = await screen.findByLabelText("To business date");
      await waitFor(() => expect(to.getAttribute("aria-invalid")).toBe("true"));
      expect(screen.getByText(/the server rejected this range/i)).toBeDefined();
      expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    });
  });

  test("404 is the non-disclosing state", async () => {
    consoleGetSalesSummary.mockResolvedValue(failure(404, "not_found"));
    renderReport();
    expect(await screen.findByText(/not available to you/i)).toBeDefined();
  });

  test("500 shows the reference and a Retry that reads again", async () => {
    consoleGetSalesSummary.mockResolvedValueOnce(failure(500, "system_failure"));
    renderReport();
    expect(await screen.findByText(/0190f000-0000-7000-8000-00000000e821/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await moneyTable();
    expect(consoleGetSalesSummary).toHaveBeenCalledTimes(2);
  });

  test("the Sales screen links to the report, and the report links back", async () => {
    renderReport("/sales");
    const link = await screen.findByRole("link", { name: "Daily received sales" });
    fireEvent.click(link);
    expect(screen.getByTestId("location").textContent).toBe("/sales-daily");
    await moneyTable();
    expect(screen.getByRole("link", { name: "Sales" }).getAttribute("href")).toBe("/sales");
  });
});
