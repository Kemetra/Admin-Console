import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  DUBAI_STORE,
  SHIFT_1,
  USER_A,
  USER_B,
  USER_C,
  ctx,
  detail,
  failure,
  stores,
} from "./shift-close-fixtures";

const consoleListShiftCloses = vi.fn();
const consoleGetShiftClose = vi.fn();
vi.mock("@/lib/shift-close-queries", () => ({
  consoleListShiftCloses: (...a: unknown[]) => consoleListShiftCloses(...a),
  consoleGetShiftClose: (...a: unknown[]) => consoleGetShiftClose(...a),
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
import { ShiftCloseDetail } from "@/shift-closes/ShiftCloseDetail";

function renderDetail(shiftId: string = SHIFT_1, state?: unknown): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: `/shift-closes/${shiftId}`, state }]}>
        <Routes>
          <Route path="/shift-closes/:shiftId" element={<ShiftCloseDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function field(label: string): HTMLElement {
  const dt = screen.getByText(label, { selector: "dt" });
  return dt.nextElementSibling as HTMLElement;
}

describe("ShiftCloseDetail (RT-18)", () => {
  beforeEach(() => {
    consoleGetShiftClose.mockReset();
    readStore.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx());
    readStore.mockResolvedValue({ status: 200, data: stores[0] });
    consoleGetShiftClose.mockResolvedValue({ status: 200, data: detail() });
  });

  test("reads the close by the route's shift id", async () => {
    renderDetail();
    await screen.findByText("Shift summary");
    expect(consoleGetShiftClose).toHaveBeenCalledWith(SHIFT_1);
    expect(readStore).toHaveBeenCalledWith(DUBAI_STORE);
  });

  test("times are in the store's zone, the server's receipt time is exact UTC evidence", async () => {
    renderDetail();
    await screen.findByText("Shift summary");
    // Opened 08:05Z and closed 20:30Z, in Dubai (+4), once the store's zone is read.
    expect(await within(field("Opened at")).findByText("Oct 7, 2026, 12:05")).toBeDefined();
    expect(within(field("Closed at")).getByText("Oct 8, 2026, 00:30")).toBeDefined();
    expect(field("Recorded by the server at").textContent).toContain("2026-10-07 20:31:12 UTC");
    expect(
      screen.getByText(
        (_, el) => el?.tagName === "P" && el.textContent === "Times are in Asia/Dubai.",
      ),
    ).toBeDefined();
  });

  test("no UTC flash: times wait for the store's zone before they render", async () => {
    let release: (value: unknown) => void = () => {};
    readStore.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    renderDetail();
    await waitFor(() => expect(readStore).toHaveBeenCalled());
    expect(screen.queryByText("Shift summary")).toBeNull();
    expect(document.body.textContent).not.toMatch(/UTC/);
    release({ status: 200, data: stores[0] });
    await screen.findByText("Shift summary");
    expect(within(field("Closed at")).getByText("Oct 8, 2026, 00:30")).toBeDefined();
  });

  test("free text is isolated for bidirectional display", async () => {
    consoleGetShiftClose.mockResolvedValue({
      status: 200,
      data: detail({ closeKind: "forced", forcedReason: "نسي الكاشير الإقفال" }),
    });
    renderDetail();
    await screen.findByText("Shift summary");
    expect(screen.getByText("نسي الكاشير الإقفال").getAttribute("dir")).toBe("auto");
    expect(screen.getByText("Cleaning supplies").getAttribute("dir")).toBe("auto");
  });

  test("falls back to UTC when the store's zone cannot be read", async () => {
    readStore.mockResolvedValue(failure(404));
    renderDetail();
    await screen.findByText("Shift summary");
    await waitFor(() => expect(readStore).toHaveBeenCalled());
    expect(within(field("Closed at")).getByText("Oct 7, 2026, 20:30 UTC")).toBeDefined();
  });

  test("the cash reconciliation shows each figure as received, in the close's currency", async () => {
    consoleGetShiftClose.mockResolvedValue({
      status: 200,
      data: detail({ currencyCode: "USD" }),
    });
    renderDetail();
    await screen.findByText("Cash reconciliation");
    expect(within(field("Opening float")).getByText("500.00 USD")).toBeDefined();
    expect(within(field("Cash sales")).getByText("2,500.00 USD")).toBeDefined();
    expect(within(field("Cash refunds")).getByText("100.00 USD")).toBeDefined();
    expect(within(field("Pay-ins")).getByText("0.00 USD")).toBeDefined();
    expect(within(field("Pay-outs")).getByText("50.00 USD")).toBeDefined();
    expect(within(field("Expected cash")).getByText("2,850.00 USD")).toBeDefined();
    expect(within(field("Counted cash")).getByText("2,875.00 USD")).toBeDefined();
    const variance = field("Variance (counted − expected)");
    expect(within(variance).getByText("+25.00 USD")).toBeDefined();
    expect(within(variance).getByText("Over")).toBeDefined();
  });

  test("a shortage is signed negative and labelled short, with no colour class", async () => {
    consoleGetShiftClose.mockResolvedValue({
      status: 200,
      data: detail({ variance: "-40.0000", countedCash: "2810.0000" }),
    });
    renderDetail();
    await screen.findByText("Cash reconciliation");
    const variance = field("Variance (counted − expected)");
    expect(within(variance).getByText("-40.00 EGP")).toBeDefined();
    expect(within(variance).getByText("Short")).toBeDefined();
    expect(variance.querySelector("[class*='danger'], [class*='success']")).toBeNull();
  });

  test("a recorded approver is attribution: shown as recorded, never verified, and the variance is untouched", async () => {
    consoleGetShiftClose.mockResolvedValue({
      status: 200,
      data: detail({ variance: "-40.0000", varianceApprovedByUserId: USER_A }),
    });
    renderDetail();
    await screen.findByText("Variance approval");
    expect(within(field("Recorded approver")).getByText(USER_A)).toBeDefined();
    expect(screen.getByText(/has not been verified/i)).toBeDefined();
    expect(within(field("Variance (counted − expected)")).getByText("-40.00 EGP")).toBeDefined();
    expect(document.body.textContent).not.toMatch(/\bverified by\b|\bmatched\b|\bresolved\b/i);
  });

  test("no recorded approver is stated plainly", async () => {
    renderDetail();
    expect(await screen.findByText("No approver was recorded for this variance.")).toBeDefined();
  });

  test("actors are bare ids, isolated LTR machine data, with no name lookup", async () => {
    renderDetail();
    await screen.findByText("Shift summary");
    for (const [label, id] of [
      ["Opened by", USER_B],
      ["Closed by", USER_A],
      ["Close recorded by", USER_C],
    ] as const) {
      const bdi = within(field(label)).getByText(id);
      expect(bdi.tagName).toBe("BDI");
      expect(bdi.getAttribute("dir")).toBe("ltr");
    }
  });

  test("a forced close shows its reason", async () => {
    consoleGetShiftClose.mockResolvedValue({
      status: 200,
      data: detail({ closeKind: "forced", forcedReason: "Cashier left the shift open" }),
    });
    renderDetail();
    await screen.findByText("Shift summary");
    expect(within(field("Close kind")).getByText("Forced close")).toBeDefined();
    expect(
      within(field("Forced-close reason")).getByText("Cashier left the shift open"),
    ).toBeDefined();
  });

  test("cash movements: kind, reason, amount, note and time in the store's zone", async () => {
    renderDetail();
    await screen.findByText("Cash movements");
    const row = screen.getByRole("row", { name: /Petty expense/ });
    expect(within(row).getByText("Pay-out")).toBeDefined();
    expect(within(row).getByText("50.00 EGP")).toBeDefined();
    expect(within(row).getByText("Cleaning supplies")).toBeDefined();
    expect(await within(row).findByText("Oct 7, 2026, 16:00")).toBeDefined();
  });

  test("an unrecognised movement or reason gets a localized fallback, never the raw code", async () => {
    consoleGetShiftClose.mockResolvedValue({
      status: 200,
      data: detail({
        cashMovements: [
          {
            ...detail().cashMovements[0],
            kind: "transfer",
            reasonCode: "mystery",
            note: null,
          },
        ],
      }),
    });
    renderDetail();
    await screen.findByText("Cash movements");
    expect(screen.getByText("Unknown movement")).toBeDefined();
    expect(screen.getByText("Unknown reason")).toBeDefined();
    expect(screen.queryByText("mystery")).toBeNull();
  });

  test("no movements and no returns say so", async () => {
    consoleGetShiftClose.mockResolvedValue({
      status: 200,
      data: detail({ cashMovements: [], cashRefundReturnRefs: [] }),
    });
    renderDetail();
    expect(await screen.findByText("No cash movements in this shift.")).toBeDefined();
    expect(screen.getByText("No returns were refunded in cash from this drawer.")).toBeDefined();
  });

  test("cash-refund return refs are listed as machine data", async () => {
    renderDetail();
    await screen.findByText("Returns refunded in cash");
    expect(screen.getByText("RET-0001").tagName).toBe("BDI");
    expect(screen.getByText("RET-0002")).toBeDefined();
  });

  test("a zero variance reads as no variance, not as matched", async () => {
    consoleGetShiftClose.mockResolvedValue({
      status: 200,
      data: detail({ variance: "0.0000", countedCash: "2850.0000" }),
    });
    renderDetail();
    await screen.findByText("Cash reconciliation");
    const variance = field("Variance (counted − expected)");
    expect(within(variance).getByText("0.00 EGP")).toBeDefined();
    expect(within(variance).getByText("No variance")).toBeDefined();
  });

  test("the uniform 404 renders as not available, with a way back", async () => {
    consoleGetShiftClose.mockResolvedValue(failure(404));
    renderDetail();
    expect(await screen.findByText("This shift close is not available.")).toBeDefined();
    expect(screen.getByRole("link", { name: /Back to shift closes/ })).toBeDefined();
  });

  test("a route id that is not a UUID is not-found and never reaches the API", async () => {
    renderDetail("not-a-uuid");
    expect(await screen.findByText("This shift close is not available.")).toBeDefined();
    expect(consoleGetShiftClose).not.toHaveBeenCalled();
  });

  test("a server failure shows an error with retry, not the not-found copy", async () => {
    consoleGetShiftClose
      .mockResolvedValueOnce(failure(500, "req-9"))
      .mockResolvedValueOnce({ status: 200, data: detail() });
    renderDetail();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("could not be loaded");
    expect(alert.textContent).toContain("req-9");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Shift summary")).toBeDefined();
  });

  test("back returns to the list with its filters", async () => {
    renderDetail(SHIFT_1, { list: "?kind=forced" });
    await screen.findByText("Shift summary");
    const back = screen.getByRole("link", { name: /Back to shift closes/ });
    expect(back.getAttribute("href")).toBe("/shift-closes?kind=forced");
  });

  test("no active tenant: no request is issued", async () => {
    activeContext.mockReturnValue(ctx("owner", null));
    renderDetail();
    expect(await screen.findByText(/select a tenant to view shift closes/i)).toBeDefined();
    expect(consoleGetShiftClose).not.toHaveBeenCalled();
  });
});
