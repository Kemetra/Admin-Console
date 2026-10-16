import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  DUBAI_STORE,
  NEW_YORK_STORE,
  SHIFT_1,
  SHIFT_2,
  SHIFT_3,
  USER_A,
  ctx,
  failure,
  page,
  stores,
  summary,
} from "./shift-close-fixtures";

const consoleListShiftCloses = vi.fn();
const consoleGetShiftClose = vi.fn();
vi.mock("@/lib/shift-close-queries", () => ({
  consoleListShiftCloses: (...a: unknown[]) => consoleListShiftCloses(...a),
  consoleGetShiftClose: (...a: unknown[]) => consoleGetShiftClose(...a),
}));
const listStores = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, listStores: (...a: unknown[]) => listStores(...a) };
});
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { createQueryClient } from "@/lib/query";
import { ShiftCloseList } from "@/shift-closes/ShiftCloseList";

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderList(entry = "/shift-closes"): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/shift-closes" element={<ShiftCloseList />} />
          <Route path="/shift-closes/:shiftId" element={<LocationProbe />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The loaded table: the loading skeleton is also a table, marked busy. */
async function tableReady(): Promise<void> {
  await waitFor(() => {
    const table = screen.getByRole("table");
    expect(table.getAttribute("aria-busy")).not.toBe("true");
  });
}

/** A paragraph by its full text: rich copy keeps machine data in its own element. */
function paragraph(text: string): HTMLElement {
  return screen.getByText((_, el) => el?.tagName === "P" && el.textContent === text);
}

function row(name: string | RegExp): HTMLElement {
  return screen.getByRole("row", { name });
}

describe("ShiftCloseList (RT-18)", () => {
  beforeEach(() => {
    consoleListShiftCloses.mockReset();
    consoleGetShiftClose.mockReset();
    listStores.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx());
    listStores.mockResolvedValue({ status: 200, data: stores });
    consoleListShiftCloses.mockResolvedValue(page([summary()]));
  });

  test("no active tenant: scope prompt and no request is issued", async () => {
    activeContext.mockReturnValue(ctx("owner", null));
    renderList();
    expect(await screen.findByText(/select a tenant to view shift closes/i)).toBeDefined();
    expect(consoleListShiftCloses).not.toHaveBeenCalled();
    expect(listStores).not.toHaveBeenCalled();
  });

  test("exception means non-zero variance: the first request carries the floor, never a client filter", async () => {
    renderList();
    await tableReady();
    expect(consoleListShiftCloses).toHaveBeenCalledTimes(1);
    const query = consoleListShiftCloses.mock.calls[0][0];
    expect(query).toMatchObject({ min_abs_variance: "0.0001", page_size: 25 });
    expect(query.cursor).toBeUndefined();
    expect(query.store_id).toBeUndefined();
  });

  test("rows render the server's set as received, with the row's own currency", async () => {
    consoleListShiftCloses.mockResolvedValue(
      page([
        summary({ variance: "25.0000", currencyCode: "EGP" }),
        summary({
          shiftId: SHIFT_2,
          storeId: NEW_YORK_STORE,
          currencyCode: "USD",
          expectedCash: "1000.0000",
          countedCash: "960.0000",
          variance: "-40.0000",
          closeKind: "forced",
        }),
      ]),
    );
    renderList();
    await tableReady();
    const over = row(/Dubai Mall/);
    expect(within(over).getByText("+25.00 EGP")).toBeDefined();
    expect(within(over).getByText("Over")).toBeDefined();
    expect(within(over).getByText("2,850.00 EGP")).toBeDefined();
    expect(within(over).getByText("2,875.00 EGP")).toBeDefined();
    expect(within(over).getByText("Normal")).toBeDefined();

    const short = row(/Fifth Avenue/);
    expect(within(short).getByText("-40.00 USD")).toBeDefined();
    expect(within(short).getByText("Short")).toBeDefined();
    expect(within(short).getByText("1,000.00 USD")).toBeDefined();
    expect(within(short).getByText("Forced close")).toBeDefined();
  });

  test("an approver is attribution only: the variance still shows in full, and no row is coloured red or green", async () => {
    consoleListShiftCloses.mockResolvedValue(
      page([
        summary({ variance: "-40.0000", varianceApprovedByUserId: USER_A }),
        summary({ shiftId: SHIFT_2, variance: "40.0000" }),
      ]),
    );
    renderList();
    await tableReady();
    const approved = screen.getAllByRole("row")[1];
    expect(within(approved).getByText("-40.00 EGP")).toBeDefined();
    expect(within(approved).getByText("Recorded")).toBeDefined();
    expect(within(approved).queryByText(/matched|reviewed|accepted|resolved/i)).toBeNull();
    // No automatic red/green for direction (UX-13): no status colour class in the table.
    const table = screen.getByRole("table");
    expect(
      table.querySelector("[class*='danger'], [class*='success'], [class*='warning']"),
    ).toBeNull();
  });

  test("times use each row's store time zone; an unknown store falls back to UTC", async () => {
    consoleListShiftCloses.mockResolvedValue(
      page([
        summary({ shiftId: SHIFT_1, storeId: DUBAI_STORE }),
        summary({ shiftId: SHIFT_2, storeId: NEW_YORK_STORE }),
        summary({ shiftId: SHIFT_3, storeId: "0190f000-0000-7000-8000-0000000000ff" }),
      ]),
    );
    renderList();
    await tableReady();
    // 2026-10-07T20:30Z is 00:30 the next day in Dubai (+4) and 16:30 in New York (-4).
    expect(within(row(/Dubai Mall/)).getByText("Oct 8, 2026, 00:30")).toBeDefined();
    expect(within(row(/Fifth Avenue/)).getByText("Oct 7, 2026, 16:30")).toBeDefined();
    const unknown = row(/Unknown store/);
    expect(within(unknown).getByText("Oct 7, 2026, 20:30 UTC")).toBeDefined();
  });

  test("the list still renders when the store roster cannot be read", async () => {
    listStores.mockResolvedValue({ status: 500, error: {} });
    renderList();
    await tableReady();
    const unknown = row(/Unknown store/);
    expect(within(unknown).getByText("Oct 7, 2026, 20:30 UTC")).toBeDefined();
  });

  test("keyset paging: Load more sends the server's cursor with the same filters and appends", async () => {
    consoleListShiftCloses
      .mockResolvedValueOnce(page([summary({ shiftId: SHIFT_1 })], "c2"))
      .mockResolvedValueOnce(page([summary({ shiftId: SHIFT_2, variance: "-5.0000" })], null));
    renderList("/shift-closes?kind=forced");
    await tableReady();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));
    expect(consoleListShiftCloses.mock.calls[1][0]).toMatchObject({
      cursor: "c2",
      close_kind: "forced",
      min_abs_variance: "0.0001",
    });
    // The last page has no cursor: no more Load more.
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(screen.getByText("Loaded: 2")).toBeDefined();
  });

  test("a continuation page that fails keeps the loaded rows and offers a retry that reuses the cursor", async () => {
    consoleListShiftCloses
      .mockResolvedValueOnce(page([summary({ shiftId: SHIFT_1 })], "c2"))
      .mockResolvedValueOnce(failure(500, "req-page-2"))
      .mockResolvedValueOnce(page([summary({ shiftId: SHIFT_2, variance: "-5.0000" })], null));
    renderList();
    await tableReady();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/rows shown are from the last successful load/i);
    expect(alert.textContent).toContain("req-page-2");
    // The proven row is still on screen, and the table was never replaced by an error view.
    expect(screen.getAllByRole("row")).toHaveLength(2);

    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));
    expect(consoleListShiftCloses.mock.calls[2][0]).toMatchObject({ cursor: "c2" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("a first page that fails shows an error with retry, never the empty state", async () => {
    consoleListShiftCloses
      .mockResolvedValueOnce(failure(500))
      .mockResolvedValueOnce(page([summary()]));
    renderList();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/could not be loaded/i);
    expect(screen.queryByText(/no shift closes/i)).toBeNull();
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await tableReady();
  });

  test("the uniform 404 renders as unavailable, not as an empty list", async () => {
    consoleListShiftCloses.mockResolvedValue(failure(404));
    renderList();
    expect(await screen.findByText("Shift closes are not available to you.")).toBeDefined();
    expect(screen.queryByText(/no shift closes/i)).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("a 401 reads as an expired session", async () => {
    consoleListShiftCloses.mockResolvedValue(failure(401));
    renderList();
    expect(await screen.findByText(/your session has expired/i)).toBeDefined();
  });

  test("a 400 is a filter problem, not a generic failure", async () => {
    consoleListShiftCloses.mockResolvedValue(failure(400));
    renderList();
    expect(await screen.findByText(/rejected these filters/i)).toBeDefined();
  });

  test("a hand-edited invalid URL explains itself and sends nothing, never a skeleton forever", async () => {
    renderList("/shift-closes?min=abc");
    expect(await screen.findByText("Enter a valid amount (for example 25.50).")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
    expect(consoleListShiftCloses).not.toHaveBeenCalled();
  });

  test("Clear also resets values typed but never applied", async () => {
    renderList();
    await tableReady();
    fireEvent.change(screen.getByLabelText("Minimum absolute variance"), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText("Enter a valid amount (for example 25.50).");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() =>
      expect(screen.queryByText("Enter a valid amount (for example 25.50).")).toBeNull(),
    );
    expect((screen.getByLabelText("Minimum absolute variance") as HTMLInputElement).value).toBe("");
  });

  test("Apply keeps the form mounted, so keyboard focus is not lost", async () => {
    renderList();
    await tableReady();
    const apply = screen.getByRole("button", { name: "Apply" });
    apply.focus();
    fireEvent.change(screen.getByLabelText("Close kind"), { target: { value: "forced" } });
    fireEvent.click(apply);
    await waitFor(() => expect(consoleListShiftCloses).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Apply" })).toBe(apply);
    expect(document.activeElement).toBe(apply);
  });

  test("dataset-empty and filtered-empty are different states", async () => {
    consoleListShiftCloses.mockResolvedValue(page([]));
    renderList();
    expect(await screen.findByText("No shift closes with a cash variance.")).toBeDefined();
  });

  test("filtered-empty says the filters matched nothing", async () => {
    consoleListShiftCloses.mockResolvedValue(page([]));
    renderList("/shift-closes?approval=approved");
    expect(await screen.findByText("No shift closes match these filters.")).toBeDefined();
  });

  test("Apply sends the filters on a fresh first page and keeps the floor", async () => {
    renderList();
    await tableReady();
    fireEvent.change(screen.getByLabelText("Close kind"), { target: { value: "forced" } });
    fireEvent.change(screen.getByLabelText("Recorded approver"), {
      target: { value: "not_approved" },
    });
    fireEvent.change(screen.getByLabelText("Minimum absolute variance"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "usd" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(consoleListShiftCloses).toHaveBeenCalledTimes(2));
    const query = consoleListShiftCloses.mock.calls[1][0];
    expect(query).toMatchObject({
      close_kind: "forced",
      approval: "not_approved",
      currency_code: "USD",
      min_abs_variance: "0.0001",
    });
    expect(query.cursor).toBeUndefined();
    expect(screen.getByTestId("location").textContent).toContain("kind=forced");
  });

  test("an invalid filter value is explained and nothing is sent", async () => {
    renderList();
    await tableReady();
    fireEvent.change(screen.getByLabelText("Minimum absolute variance"), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("Enter a valid amount (for example 25.50).")).toBeDefined();
    expect(consoleListShiftCloses).toHaveBeenCalledTimes(1);
  });

  test("an end date before the start date is explained and nothing is sent", async () => {
    renderList();
    await tableReady();
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-07" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("The end date can't be before the start date.")).toBeDefined();
    expect(consoleListShiftCloses).toHaveBeenCalledTimes(1);
  });

  test("dates are read in the selected store's zone, and the filter says so", async () => {
    renderList(`/shift-closes?store=${DUBAI_STORE}&from=2026-10-01&to=2026-10-07`);
    await tableReady();
    expect(consoleListShiftCloses.mock.calls[0][0]).toMatchObject({
      store_id: DUBAI_STORE,
      closed_from: "2026-09-30T20:00:00.000Z",
      closed_to: "2026-10-07T20:00:00.000Z",
    });
    expect(paragraph("Dates are in Asia/Dubai.")).toBeDefined();
  });

  test("with no store selected, dates are UTC and labelled so", async () => {
    renderList("/shift-closes?from=2026-10-01");
    await tableReady();
    expect(consoleListShiftCloses.mock.calls[0][0]).toMatchObject({
      closed_from: "2026-10-01T00:00:00.000Z",
    });
    expect(paragraph("Dates are in UTC.")).toBeDefined();
  });

  test("Clear drops every filter back to the default exception view", async () => {
    renderList("/shift-closes?kind=forced");
    await tableReady();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/shift-closes"));
    await waitFor(() => expect(consoleListShiftCloses).toHaveBeenCalledTimes(2));
    expect(consoleListShiftCloses.mock.calls[1][0].close_kind).toBeUndefined();
  });

  test("activating a row opens that shift's detail", async () => {
    renderList();
    await tableReady();
    fireEvent.click(screen.getAllByRole("row")[1]);
    await waitFor(() =>
      expect(
        screen.getAllByTestId("location").some((n) => n.textContent === `/shift-closes/${SHIFT_1}`),
      ).toBe(true),
    );
  });

  test("the surface is read-only: no write control anywhere", async () => {
    renderList();
    await tableReady();
    const names = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    expect(names.join("|")).not.toMatch(/approve|accept|resolve|edit|delete|save/i);
  });
});
