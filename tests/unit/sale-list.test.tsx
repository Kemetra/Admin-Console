import { formatDateTime } from "@/i18n/format";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  AS_OF,
  CAIRO_STORE,
  NEW_YORK_STORE,
  SALE_1,
  SALE_2,
  ctx,
  failure,
  item,
  page,
  stores,
} from "./sale-fixtures";

const consoleListSales = vi.fn();
const consoleGetSale = vi.fn();
vi.mock("@/lib/sale-queries", () => ({
  consoleListSales: (...a: unknown[]) => consoleListSales(...a),
  consoleGetSale: (...a: unknown[]) => consoleGetSale(...a),
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
import { SaleList } from "@/sales/SaleList";

const RANGE = `store=${CAIRO_STORE}&from=2026-10-01&to=2026-10-07`;

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderList(entry = "/sales"): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/sales" element={<SaleList />} />
          <Route path="/sales/:saleRef" element={<p>detail</p>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const location = () => screen.getByTestId("location").textContent;

async function tableReady(): Promise<HTMLElement> {
  let table: HTMLElement | undefined;
  await waitFor(() => {
    table = screen.getByRole("table");
    expect(table.getAttribute("aria-busy")).not.toBe("true");
  });
  return table as HTMLElement;
}

/** Text that may be split across elements (rich copy keeps machine data apart). */
function byFullText(text: string): HTMLElement {
  return screen.getByText((_, el) => el?.tagName === "P" && el.textContent === text);
}

const asOfText = formatDateTime(AS_OF, { timeZone: "Africa/Cairo", locale: "en" });

describe("SaleList (RT-587, spec 012 J1)", () => {
  beforeEach(() => {
    consoleListSales.mockReset();
    consoleGetSale.mockReset();
    listStores.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx());
    listStores.mockResolvedValue({ status: 200, data: stores });
    consoleListSales.mockResolvedValue(page([item()]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("no active tenant: scope prompt and nothing is requested", async () => {
    activeContext.mockReturnValue(ctx("owner", null));
    renderList();
    expect(await screen.findByText(/select a tenant to view sales/i)).toBeDefined();
    expect(consoleListSales).not.toHaveBeenCalled();
  });

  test("nothing loads until a store and a business-date range are set (FR-004)", async () => {
    renderList();
    expect(await screen.findByText(/choose a store and a business-date range/i)).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
    expect(consoleListSales).not.toHaveBeenCalled();
    // Store picker lists the caller's stores and has no "All stores" option (OD-556-2).
    const picker = await screen.findByLabelText("Store");
    await waitFor(() => expect(within(picker).getByText("Cairo Festival")).toBeDefined());
    expect(within(picker).queryByText(/all stores/i)).toBeNull();
  });

  test("choosing a store proposes today in that store's zone; Search applies it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T23:30:00Z"));
    renderList();
    const picker = await screen.findByLabelText("Store");
    await waitFor(() => expect(within(picker).getByText("Cairo Festival")).toBeDefined());
    fireEvent.change(picker, { target: { value: CAIRO_STORE } });
    // 23:30 UTC is already the next calendar day in Cairo.
    expect((screen.getByLabelText("From business date") as HTMLInputElement).value).toBe(
      "2026-10-08",
    );
    expect((screen.getByLabelText("To business date") as HTMLInputElement).value).toBe(
      "2026-10-08",
    );
    expect(consoleListSales).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() =>
      expect(location()).toBe(`/sales?store=${CAIRO_STORE}&from=2026-10-08&to=2026-10-08`),
    );
    await waitFor(() => expect(consoleListSales).toHaveBeenCalledTimes(1));
    expect(consoleListSales.mock.calls[0][0]).toEqual({
      store_id: CAIRO_STORE,
      from: "2026-10-08",
      to: "2026-10-08",
      page_size: 50,
      cursor: undefined,
    });
  });

  test("the active store is proposed in the form, but nothing is read before Search", async () => {
    activeContext.mockReturnValue(ctx("store_manager", "t1", NEW_YORK_STORE));
    renderList();
    const picker = (await screen.findByLabelText("Store")) as HTMLSelectElement;
    await waitFor(() => expect(picker.value).toBe(NEW_YORK_STORE));
    expect(consoleListSales).not.toHaveBeenCalled();
  });

  test("a deep link reads its query, and rows render server truth in the store's zone", async () => {
    consoleListSales.mockResolvedValue(
      page([
        item(),
        item({
          saleRef: SALE_2,
          saleNumber: null,
          device: { deviceRef: null, label: null, labelSource: "unavailable" },
          operator: { userRef: null, displayName: "Omar Fathy", nameSource: "current" },
          voided: true,
          returnState: "partial",
          syncStatus: "failed-needs-repair",
          erpPostingState: "unknown",
          posTotal: "99.5000",
        }),
      ]),
    );
    renderList(`/sales?${RANGE}&sync=synced`);
    const table = await tableReady();
    expect(consoleListSales.mock.calls[0][0]).toMatchObject({
      store_id: CAIRO_STORE,
      from: "2026-10-01",
      to: "2026-10-07",
      sync_status: "synced",
    });
    const [, first, second] = within(table).getAllByRole("row");
    expect(within(first).getByText("R-0042")).toBeDefined();
    expect(within(first).getByText("Till 1")).toBeDefined();
    expect(within(first).getByText("Mona Adel")).toBeDefined();
    expect(within(first).getByText("Posted to ERPNext")).toBeDefined();
    expect(
      within(first).getByText(
        formatDateTime("2026-10-07T10:30:00Z", { timeZone: "Africa/Cairo", locale: "en" }),
      ),
    ).toBeDefined();
    // The missing number, the pre-RT-77 sale with no device and a current name are labelled.
    expect(within(second).getByText("Not recorded")).toBeDefined();
    expect(within(second).getByText("No device recorded")).toBeDefined();
    // The name is isolated from its label, so match the cell's whole text.
    expect(
      within(second).getByText(
        (_, el) => el?.tagName === "TD" && el.textContent === "Omar Fathy (current name)",
      ),
    ).toBeDefined();
    expect(within(second).getByText("Voided")).toBeDefined();
    expect(within(second).getByText("Partly returned")).toBeDefined();
    expect(within(second).getByText("Needs repair")).toBeDefined();
    expect(within(second).getByText("ERPNext posting state unknown")).toBeDefined();
    // Every page says how far the server's knowledge goes (AC-13).
    expect(
      byFullText(
        `Received by the server up to ${asOfText}. Sales still waiting to sync on a terminal are not included.`,
      ),
    ).toBeDefined();
  });

  test("a range wider than 31 business days is refused before the request (AC-2)", async () => {
    renderList(`/sales?store=${CAIRO_STORE}&from=2026-10-01&to=2026-11-01`);
    expect(await screen.findByText(/at most 31 business days\. narrow/i)).toBeDefined();
    expect(consoleListSales).not.toHaveBeenCalled();
    // 31 days exactly is allowed.
    fireEvent.change(screen.getByLabelText("To business date"), {
      target: { value: "2026-10-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(consoleListSales).toHaveBeenCalledTimes(1));
  });

  test("Search without a store or dates explains what is missing and reads nothing", async () => {
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "Search" }));
    expect(await screen.findByText("Choose a store.")).toBeDefined();
    expect(screen.getByText("Enter both dates.")).toBeDefined();
    expect(consoleListSales).not.toHaveBeenCalled();
  });

  test("the empty state appears only for items [] with nextCursor null (AC-13)", async () => {
    consoleListSales.mockResolvedValue(page([], null));
    renderList(`/sales?${RANGE}`);
    const message = `No sales received by the server for this store and range up to ${asOfText}.`;
    expect(
      await screen.findByText((_, el) => el?.tagName === "SPAN" && el.textContent === message),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  test("an empty page with a cursor is not 'no sales': Load more walks on (AC-1, AC-4)", async () => {
    consoleListSales
      .mockResolvedValueOnce(page([], "c1"))
      .mockResolvedValueOnce(page([], "c2"))
      .mockResolvedValueOnce(page([item()], null));
    renderList(`/sales?${RANGE}&returns=full`);
    const more = await screen.findByRole("button", { name: "Load more" });
    expect(screen.queryByText(/no sales received/i)).toBeNull();
    expect(screen.getByText(/in the part of the range checked so far/i)).toBeDefined();
    expect(screen.queryByText(/end of the received sales/i)).toBeNull();

    fireEvent.click(more);
    await waitFor(() => expect(consoleListSales).toHaveBeenCalledTimes(2));
    expect(consoleListSales.mock.calls[1][0]).toMatchObject({ cursor: "c1", return_state: "full" });
    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    await waitFor(() => expect(consoleListSales).toHaveBeenCalledTimes(3));
    expect(consoleListSales.mock.calls[2][0]).toMatchObject({ cursor: "c2" });

    const table = await tableReady();
    expect(within(table).getByText("R-0042")).toBeDefined();
    expect(await screen.findByText("End of the received sales for this range.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  test("a short page with a cursor keeps its rows and offers Load more", async () => {
    consoleListSales.mockResolvedValueOnce(page([item()], "c1"));
    renderList(`/sales?${RANGE}`);
    await tableReady();
    expect(screen.getByRole("button", { name: "Load more" })).toBeDefined();
    expect(screen.queryByText(/end of the received sales/i)).toBeNull();
  });

  test("a 404 is the one non-disclosing state, never an empty list (AC-6)", async () => {
    consoleListSales.mockResolvedValue(failure(404));
    renderList(`/sales?${RANGE}`);
    expect(await screen.findByText("These sales are not available to you.")).toBeDefined();
    expect(screen.queryByText(/no sales received/i)).toBeNull();
    expect(screen.queryByText(/cairo festival.*not/i)).toBeNull();
  });

  test("a server 400 reads as a validation message, never as an empty list (AC-2)", async () => {
    consoleListSales.mockResolvedValue(failure(400, "req-400"));
    renderList(`/sales?${RANGE}`);
    expect(await screen.findByText(/the server rejected this search/i)).toBeDefined();
    expect(screen.getByText("req-400")).toBeDefined();
    expect(screen.queryByText(/no sales received/i)).toBeNull();
    // Retrying the same rejected query cannot succeed: no Retry is offered.
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  test("a 400 on a continuation page restarts the walk from the first page", async () => {
    consoleListSales
      .mockResolvedValueOnce(page([item()], "c1"))
      .mockResolvedValueOnce(failure(400))
      .mockResolvedValueOnce(page([item({ saleRef: SALE_2, saleNumber: "R-0041" })], null));
    renderList(`/sales?${RANGE}`);
    await tableReady();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText(/did not accept the position of the next page/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start again" }));
    expect(await screen.findByText("R-0041")).toBeDefined();
    expect(consoleListSales.mock.calls[2][0]).toMatchObject({ cursor: undefined });
    expect(screen.queryByText("R-0042")).toBeNull();
  });

  test("a failed continuation keeps the loaded rows and retries the next page", async () => {
    consoleListSales
      .mockResolvedValueOnce(page([item()], "c1"))
      .mockResolvedValueOnce(failure(500))
      .mockResolvedValueOnce(page([item({ saleRef: SALE_2, saleNumber: "R-0041" })], null));
    renderList(`/sales?${RANGE}`);
    await tableReady();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText(/the rest of the rows could not be loaded/i)).toBeDefined();
    expect(screen.getByText("R-0042")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("R-0041")).toBeDefined();
    expect(consoleListSales.mock.calls[2][0]).toMatchObject({ cursor: "c1" });
  });

  test("a new filter restarts the walk without a cursor and drops the old rows (FR-006)", async () => {
    consoleListSales
      .mockResolvedValueOnce(page([item()], "c1"))
      .mockResolvedValueOnce(page([item({ saleRef: SALE_2, saleNumber: "R-0041" })], "c2"))
      .mockResolvedValueOnce(
        page([item({ saleRef: "0190f000-0000-7000-8000-0000000005b9", saleNumber: "R-0099" })]),
      );
    renderList(`/sales?${RANGE}`);
    await tableReady();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("R-0041")).toBeDefined();
    expect(consoleListSales.mock.calls[1][0]).toMatchObject({ cursor: "c1" });

    fireEvent.change(screen.getByLabelText("Void"), { target: { value: "true" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("R-0099")).toBeDefined();
    expect(consoleListSales).toHaveBeenCalledTimes(3);
    expect(consoleListSales.mock.calls[2][0]).toMatchObject({ voided: true, cursor: undefined });
    expect(screen.queryByText("R-0042")).toBeNull();
    expect(screen.queryByText("R-0041")).toBeNull();
    expect(location()).toBe(`/sales?${RANGE}&voided=true`);
  });

  test("store_staff on /sales sees the unavailable state, with no form and no read (AC-5)", async () => {
    activeContext.mockReturnValue(ctx("store_staff"));
    renderList(`/sales?${RANGE}`);
    expect(await screen.findByText("These sales are not available to you.")).toBeDefined();
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.queryByLabelText("Store")).toBeNull();
    expect(consoleListSales).not.toHaveBeenCalled();
    expect(listStores).not.toHaveBeenCalled();
  });

  test("the empty and not-available states are polite live regions", async () => {
    consoleListSales.mockResolvedValue(page([], null));
    renderList(`/sales?${RANGE}`);
    const empty = await screen.findByText(/no sales received by the server/i);
    expect(empty.closest("output")).not.toBeNull();
    // The time is isolated from the sentence around it.
    expect(empty.querySelector("time")?.getAttribute("dateTime")).toBe(AS_OF);
  });

  test("the loaded count is a status message, its number isolated", async () => {
    renderList(`/sales?${RANGE}`);
    await tableReady();
    const count = screen.getByText(
      (_, el) => el?.tagName === "OUTPUT" && el.textContent === "Loaded: 1",
    );
    expect(count.querySelector("bdi")?.textContent).toBe("1");
  });

  test("when the last page arrives, focus moves from Load more to the end of the list", async () => {
    consoleListSales
      .mockResolvedValueOnce(page([item()], "c1"))
      .mockResolvedValueOnce(page([item({ saleRef: SALE_2, saleNumber: "R-0041" })], null));
    renderList(`/sales?${RANGE}`);
    await tableReady();
    const more = screen.getByRole("button", { name: "Load more" });
    more.focus();
    fireEvent.click(more);
    const end = await screen.findByText("End of the received sales for this range.");
    await waitFor(() => expect(document.activeElement).toBe(end));
  });

  test("the sale-number field explains that pre-snapshot sales never match (AC-3)", async () => {
    renderList(`/sales?${RANGE}&number=R-0042`);
    await tableReady();
    expect(consoleListSales.mock.calls[0][0]).toMatchObject({ sale_number: "R-0042" });
    expect(screen.getByText(/have no number and never match/i)).toBeDefined();
  });

  test("activating a row opens its detail and keeps the list query for Back", async () => {
    renderList(`/sales?${RANGE}`);
    const table = await tableReady();
    fireEvent.click(within(table).getByText("R-0042"));
    await waitFor(() => expect(location()).toBe(`/sales/${SALE_1}`));
  });
});
