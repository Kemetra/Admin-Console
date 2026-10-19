import { formatDateTime } from "@/i18n/format";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  CAIRO_STORE,
  LINE_1,
  LINE_2,
  RETURN_1,
  SALE_1,
  ctx,
  detail,
  failure,
  item,
  line,
  stores,
} from "./sale-fixtures";

const consoleListSales = vi.fn();
const consoleGetSale = vi.fn();
vi.mock("@/lib/sale-queries", () => ({
  consoleListSales: (...a: unknown[]) => consoleListSales(...a),
  consoleGetSale: (...a: unknown[]) => consoleGetSale(...a),
}));
// RT-726: the sync sections on this page read their own wrappers; hermetic here.
vi.mock("@/lib/sale-sync-ops-queries", () => ({
  consoleGetSaleSyncStatus: () => new Promise(() => {}),
  consoleGetSaleAuditTimeline: () => new Promise(() => {}),
  consoleRepairSaleSync: vi.fn(),
}));
const readStore = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, readStore: (...a: unknown[]) => readStore(...a) };
});
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { createQueryClient } from "@/lib/query";
import { SaleDetail } from "@/sales/SaleDetail";

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderDetail(saleRef: string = SALE_1, listSearch?: string): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter
        initialEntries={[{ pathname: `/sales/${saleRef}`, state: { list: listSearch } }]}
      >
        <Routes>
          <Route path="/sales/:saleRef" element={<SaleDetail />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cairo = (iso: string) => formatDateTime(iso, { timeZone: "Africa/Cairo", locale: "en" });

/** The value cell of a field row, by its label. */
function field(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: "dt" });
  return term.nextElementSibling as HTMLElement;
}

function section(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

async function loaded(): Promise<void> {
  await screen.findByRole("heading", { level: 1 });
}

describe("SaleDetail (RT-587, spec 012 J2)", () => {
  beforeEach(() => {
    consoleGetSale.mockReset();
    readStore.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx());
    readStore.mockResolvedValue({ status: 200, data: stores[0] });
    consoleGetSale.mockResolvedValue({ status: 200, data: detail() });
  });

  test("a ref that is not a UUID is not-found with no request", async () => {
    renderDetail("R-0042");
    expect(await screen.findByText(/not found or is not available to you/i)).toBeDefined();
    expect(consoleGetSale).not.toHaveBeenCalled();
  });

  test("a 404 is the one non-disclosing state (AC-5, AC-6)", async () => {
    consoleGetSale.mockResolvedValue(failure(404));
    renderDetail();
    expect(
      await screen.findByText("This sale was not found or is not available to you."),
    ).toBeDefined();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  test("a 500 offers Retry, which reads the sale again", async () => {
    consoleGetSale.mockResolvedValueOnce(failure(500)).mockResolvedValueOnce({
      status: 200,
      data: detail(),
    });
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await loaded();
    expect(consoleGetSale).toHaveBeenCalledTimes(2);
  });

  test("the header renders the recorded facts in the store's zone", async () => {
    renderDetail();
    await loaded();
    expect(consoleGetSale).toHaveBeenCalledWith(SALE_1);
    const heading = screen.getByRole("heading", { level: 1, name: "Sale R-0042" });
    // The number is machine data, isolated LTR, so RTL never renders it as "0042-R".
    const number = heading.querySelector("bdi");
    expect(number?.getAttribute("dir")).toBe("ltr");
    expect(number?.textContent).toBe("R-0042");
    expect(field("Receipt number").textContent).toBe("R-0042");
    expect(field("Business date").textContent).toBe("Oct 7, 2026");
    expect(field("Occurred").textContent).toBe(cairo("2026-10-07T10:30:00Z"));
    expect(field("Received by the server").textContent).toBe(cairo("2026-10-07T10:30:04Z"));
    expect(field("Terminal").textContent).toBe("Till 1");
    expect(field("Cashier").textContent).toBe("Mona Adel");
    await waitFor(() => expect(field("Store").textContent).toBe("Cairo Festival"));
    expect(field("Tax registration ID").textContent).toBe("TRN-123-456");
    expect(screen.getByText(/times are in/i).textContent).toContain("Africa/Cairo");
  });

  test("facts that were never recorded are labelled, never guessed (FR-008)", async () => {
    consoleGetSale.mockResolvedValue({
      status: 200,
      data: detail({
        summary: item({
          saleNumber: null,
          device: { deviceRef: null, label: null, labelSource: "unavailable" },
          operator: { userRef: null, displayName: null, nameSource: "unavailable" },
        }),
        receiptNumber: null,
        settledAt: null,
        receiptHeader: null,
        changeGiven: null,
      }),
    });
    renderDetail();
    await loaded();
    expect(
      screen.getByRole("heading", { level: 1, name: "Sale with no sale number" }),
    ).toBeDefined();
    expect(field("Receipt number").textContent).toBe("Not recorded");
    expect(field("Time on the receipt").textContent).toBe("Not recorded");
    expect(field("Terminal").textContent).toBe("No device recorded");
    expect(field("Cashier").textContent).toBe("Not recorded");
    expect(
      within(section("Receipt header")).getByText("Not recorded for this sale."),
    ).toBeDefined();
    expect(within(section("Payments")).queryByText("Change given")).toBeNull();
  });

  test("a current name is labelled as the current name (AC-12)", async () => {
    consoleGetSale.mockResolvedValue({
      status: 200,
      data: detail({
        summary: item({
          operator: { userRef: null, displayName: "Omar Fathy", nameSource: "current" },
        }),
      }),
    });
    renderDetail();
    await loaded();
    expect(field("Cashier").textContent).toBe("Omar Fathy (current name)");
  });

  test("lines render in the server's order with each recorded fact (AC-7)", async () => {
    renderDetail();
    await loaded();
    const rows = within(section("Lines")).getAllByRole("row");
    expect(within(rows[1]).getByText("Mineral water 1.5L")).toBeDefined();
    expect(within(rows[1]).getByText("bottle")).toBeDefined();
    expect(within(rows[2]).getByText("Dates 500g")).toBeDefined();
    // A null tax is not recorded, never zero.
    expect(within(rows[2]).getByText("Not recorded")).toBeDefined();
    expect(
      within(section("Lines")).queryByText(/original receipt order was not recorded/i),
    ).toBeNull();
  });

  test("a not_recorded line order is said, and the lines are not re-sorted (AC-7)", async () => {
    consoleGetSale.mockResolvedValue({
      status: 200,
      data: detail({
        lineOrder: "not_recorded",
        lines: [
          line({ lineRef: LINE_2, sequence: null, lineName: "Second" }),
          line({ lineRef: LINE_1, sequence: null, lineName: "First" }),
        ],
      }),
    });
    renderDetail();
    await loaded();
    const lines = section("Lines");
    expect(within(lines).getByText(/original receipt order was not recorded/i)).toBeDefined();
    const rows = within(lines).getAllByRole("row");
    expect(within(rows[1]).getByText("Second")).toBeDefined();
    expect(within(rows[2]).getByText("First")).toBeDefined();
  });

  test("recorded tenders show method, amount and reference; change when recorded", async () => {
    renderDetail();
    await loaded();
    const payments = section("Payments");
    expect(within(payments).getByText("Cash")).toBeDefined();
    expect(within(payments).getByText("Card (external terminal)")).toBeDefined();
    expect(within(payments).getByText("AUTH-7781")).toBeDefined();
    expect(within(payments).getByText("Change given")).toBeDefined();
  });

  test("a tender-unknown sale says so and invents no tender (AC-8)", async () => {
    consoleGetSale.mockResolvedValue({
      status: 200,
      data: detail({ tenderState: "unknown", tenders: [] }),
    });
    renderDetail();
    await loaded();
    const payments = section("Payments");
    expect(
      within(payments).getByText("Payment details were not recorded for this sale."),
    ).toBeDefined();
    expect(within(payments).queryByRole("table")).toBeNull();
  });

  test("a voided sale shows its void summary and the reversal's ERP state (AC-9)", async () => {
    consoleGetSale.mockResolvedValue({
      status: 200,
      data: detail({
        summary: item({ voided: true }),
        void: {
          voidedAt: "2026-10-07T11:00:00Z",
          voidBusinessDate: "2026-10-07",
          approved: false,
          approverRole: "store_manager",
        },
        erpPosting: {
          sale: "posted",
          saleDocumentRef: "ACC-SINV-2026-00042",
          reversal: "pending",
          reversalDocumentRef: null,
        },
      }),
    });
    renderDetail();
    await loaded();
    const voidSection = section("Void");
    expect(within(voidSection).getByText(cairo("2026-10-07T11:00:00Z"))).toBeDefined();
    expect(within(voidSection).getByText("No (legacy void)")).toBeDefined();
    expect(within(voidSection).getByText("Approver role")).toBeDefined();
    expect(within(voidSection).getByText("Store manager")).toBeDefined();
    const erp = section("ERPNext posting");
    expect(within(erp).getByText("Void reversal posting")).toBeDefined();
    expect(within(erp).getByText("ERPNext posting pending")).toBeDefined();
    expect(within(erp).queryByText("ERPNext reversal document")).toBeNull();
  });

  test("an unvoided sale shows no reversal row", async () => {
    renderDetail();
    await loaded();
    expect(within(section("Void")).getByText("This sale is not voided.")).toBeDefined();
    expect(within(section("ERPNext posting")).queryByText("Void reversal posting")).toBeNull();
  });

  test("a partially returned sale shows each return and the returned quantity per line (AC-10)", async () => {
    consoleGetSale.mockResolvedValue({
      status: 200,
      data: detail({
        summary: item({ returnState: "partial" }),
        lines: [line({ returnedQuantity: "1" }), line({ lineRef: LINE_2, lineName: "Dates 500g" })],
        returns: [
          {
            returnRef: RETURN_1,
            recordedAt: "2026-10-08T09:00:00Z",
            businessDate: "2026-10-08",
            returnTotal: "10.0000",
            lines: [{ lineRef: LINE_1, quantity: "1", lineAmount: "10.0000" }],
          },
        ],
      }),
    });
    renderDetail();
    await loaded();
    const lineRows = within(section("Lines")).getAllByRole("row");
    // The item is the row header; cells: position, quantity, unit, unit price, amount, tax, returned.
    expect(within(lineRows[1]).getByRole("rowheader").textContent).toBe("Mineral water 1.5L");
    expect(within(lineRows[1]).getAllByRole("cell")[6].textContent).toBe("1");
    const returns = section("Returns");
    expect(within(returns).getByText(cairo("2026-10-08T09:00:00Z"))).toBeDefined();
    expect(within(returns).getByText("Oct 8, 2026")).toBeDefined();
    expect(within(returns).getByText("Mineral water 1.5L")).toBeDefined();
  });

  test("ERP unknown reads as unknown; a document id appears only for posted (AC-11)", async () => {
    consoleGetSale.mockResolvedValue({
      status: 200,
      data: detail({
        summary: item({ erpPostingState: "unknown" }),
        erpPosting: {
          sale: "unknown",
          saleDocumentRef: "SHOULD-NOT-SHOW",
          reversal: null,
          reversalDocumentRef: null,
        },
      }),
    });
    renderDetail();
    await loaded();
    const erp = section("ERPNext posting");
    expect(within(erp).getByText("ERPNext posting state unknown")).toBeDefined();
    expect(within(erp).queryByText("SHOULD-NOT-SHOW")).toBeNull();
    expect(within(erp).queryByText(/not posted/i)).toBeNull();
  });

  test("a posted sale shows its ERPNext document id", async () => {
    renderDetail();
    await loaded();
    expect(within(section("ERPNext posting")).getByText("ACC-SINV-2026-00042")).toBeDefined();
  });

  test("the shift-close link opens that store and business day (AC-14)", async () => {
    renderDetail();
    await loaded();
    const link = screen.getByRole("link", {
      name: "Shift-close exceptions (non-zero variance) that day",
    });
    expect(link.getAttribute("href")).toBe(
      `/shift-closes?store=${CAIRO_STORE}&from=2026-10-07&to=2026-10-07`,
    );
  });

  test("no write action is offered (FR-010)", async () => {
    renderDetail();
    await loaded();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  test("Back returns to the list with its query", async () => {
    renderDetail(SALE_1, "?store=abc&from=2026-10-01&to=2026-10-07");
    await loaded();
    fireEvent.click(screen.getByRole("link", { name: /back to sales/i }));
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        "/sales?store=abc&from=2026-10-01&to=2026-10-07",
      ),
    );
  });
});
