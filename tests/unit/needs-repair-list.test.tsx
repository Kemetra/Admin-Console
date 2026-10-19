import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  OTHER_STORE,
  REQUEST_ID,
  SALE,
  SALE_2,
  STORE,
  ctx,
  failure,
  ok,
  repairItem,
} from "./sale-sync-fixtures";

const api = {
  consoleGetSaleSyncStatus: vi.fn(),
  consoleGetSaleAuditTimeline: vi.fn(),
  consoleListNeedsRepair: vi.fn(),
  consoleRepairSaleSync: vi.fn(),
};
vi.mock("@/lib/sale-sync-ops-queries", () => ({
  consoleGetSaleSyncStatus: (...a: unknown[]) => api.consoleGetSaleSyncStatus(...a),
  consoleGetSaleAuditTimeline: (...a: unknown[]) => api.consoleGetSaleAuditTimeline(...a),
  consoleListNeedsRepair: (...a: unknown[]) => api.consoleListNeedsRepair(...a),
  consoleRepairSaleSync: (...a: unknown[]) => api.consoleRepairSaleSync(...a),
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
import { NeedsRepairList } from "@/sale-sync/NeedsRepairList";

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderList(entry = "/sales-needing-repair"): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/sales-needing-repair" element={<NeedsRepairList />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const page = (items: unknown[], nextCursor: string | null = null) => ok({ items, nextCursor });

const stores = [
  { id: STORE, code: "CAI", name: "Cairo Festival", timezone: "Africa/Cairo", is_active: true },
  { id: OTHER_STORE, code: "ALX", name: "Alexandria", timezone: "Africa/Cairo", is_active: true },
];

describe("NeedsRepairList (RT-726)", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    activeContext.mockReset();
    listStores.mockReset();
    activeContext.mockReturnValue(ctx("owner"));
    listStores.mockResolvedValue({ status: 200, data: stores });
    api.consoleListNeedsRepair.mockResolvedValue(page([repairItem()]));
  });

  test.each(["store_manager", "store_staff", "cashier", "auditor"])(
    "%s gets NoAccess and nothing is requested",
    async (role) => {
      activeContext.mockReturnValue(ctx(role));
      renderList();
      expect(await screen.findByRole("heading", { level: 1 })).toBeDefined();
      expect(screen.queryByText("Sales needing repair")).toBeNull();
      expect(api.consoleListNeedsRepair).not.toHaveBeenCalled();
    },
  );

  test("without a tenant it asks for one and requests nothing", () => {
    activeContext.mockReturnValue(ctx("owner", false));
    renderList();
    expect(screen.getByText("Select a tenant to view sales needing repair.")).toBeDefined();
    expect(api.consoleListNeedsRepair).not.toHaveBeenCalled();
  });

  test("rows link to the sale; machine data is LTR; no repair action on the list", async () => {
    renderList();
    await screen.findByRole("link", { name: "Open sale POS-CAI-0042" });
    const table = screen.getByRole("table", { name: "Sales needing repair, newest first" });
    expect(api.consoleListNeedsRepair).toHaveBeenCalledWith({});
    const row = within(table).getAllByRole("row")[1];
    const link = within(row).getByRole("link", { name: "Open sale POS-CAI-0042" });
    expect(link.getAttribute("href")).toBe(`/sales/${SALE}`);
    expect(link.querySelector("bdi")?.getAttribute("dir")).toBe("ltr");
    expect(row.textContent).toContain("validation_error");
    await waitFor(() => expect(row.textContent).toContain("Cairo Festival"));
    expect(screen.queryByRole("button", { name: /repair/i })).toBeNull();
    expect(screen.getByText(/missing from the list is not proof it was posted/)).toBeDefined();
  });

  test("a row without an attempt count says not recorded", async () => {
    api.consoleListNeedsRepair.mockResolvedValue(page([repairItem({ retryCount: undefined })]));
    renderList();
    await screen.findByRole("link", { name: "Open sale POS-CAI-0042" });
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")[1].textContent).toContain("Not recorded");
  });

  test("the store filter goes in the URL and the query", async () => {
    renderList();
    await screen.findByRole("link", { name: "Open sale POS-CAI-0042" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Alexandria" })).toBeDefined());
    fireEvent.change(screen.getByLabelText("Store"), { target: { value: OTHER_STORE } });
    await waitFor(() =>
      expect(api.consoleListNeedsRepair).toHaveBeenLastCalledWith({ store_id: OTHER_STORE }),
    );
    expect(screen.getByTestId("location").textContent).toBe(
      `/sales-needing-repair?store=${OTHER_STORE}`,
    );
  });

  test("a malformed store filter is never sent", async () => {
    renderList("/sales-needing-repair?store=CAI");
    expect(await screen.findByText("This store is not available to you.")).toBeDefined();
    expect(api.consoleListNeedsRepair).not.toHaveBeenCalled();
  });

  test("an out-of-scope store is the API's non-disclosing 404", async () => {
    api.consoleListNeedsRepair.mockResolvedValue(failure(404, "not_found"));
    renderList(`/sales-needing-repair?store=${OTHER_STORE}`);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This store is not available to you.");
    expect(alert.textContent).toContain(REQUEST_ID);
  });

  test("dataset-empty and filtered-empty are different states", async () => {
    api.consoleListNeedsRepair.mockResolvedValue(page([]));
    renderList();
    expect(await screen.findByText("No open sales need repair.")).toBeDefined();
    expect(screen.getByText(/does not mean every sale is posted to ERPNext/)).toBeDefined();
  });

  test("filtered-empty names the store filter", async () => {
    api.consoleListNeedsRepair.mockResolvedValue(page([]));
    renderList(`/sales-needing-repair?store=${STORE}`);
    expect(await screen.findByText("No open sales need repair in this store.")).toBeDefined();
  });

  test("Load more follows the server's cursor; a failed page keeps the rows", async () => {
    api.consoleListNeedsRepair
      .mockResolvedValueOnce(page([repairItem()], SALE))
      .mockResolvedValueOnce(failure(500))
      .mockResolvedValueOnce(page([repairItem({ saleRef: SALE_2, externalId: "POS-CAI-0041" })]));
    renderList();
    await screen.findByRole("link", { name: "Open sale POS-CAI-0042" });
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() =>
      expect(api.consoleListNeedsRepair).toHaveBeenLastCalledWith({ cursor: SALE }),
    );
    const stale = await screen.findByText(/could not be refreshed/);
    expect(screen.getByRole("link", { name: "Open sale POS-CAI-0042" })).toBeDefined();
    fireEvent.click(within(stale.closest("[role=alert]") as HTMLElement).getByRole("button"));
    expect(await screen.findByRole("link", { name: "Open sale POS-CAI-0041" })).toBeDefined();
    expect(api.consoleListNeedsRepair).toHaveBeenLastCalledWith({ cursor: SALE });
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  test("after a failed Load more, Refresh re-reads the queue, not the failed page", async () => {
    api.consoleListNeedsRepair
      .mockResolvedValueOnce(page([repairItem()], SALE))
      .mockResolvedValueOnce(failure(500))
      .mockResolvedValue(page([repairItem()], SALE));
    renderList();
    await screen.findByRole("link", { name: "Open sale POS-CAI-0042" });
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText(/could not be refreshed/);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(api.consoleListNeedsRepair).toHaveBeenCalledTimes(3));
    expect(api.consoleListNeedsRepair).toHaveBeenLastCalledWith({});
  });

  test.each([
    [400, "The server rejected this request.", false],
    [401, "Your session has ended. Sign in again.", false],
    [403, "This section is not available to your role.", false],
    [429, "Too many requests in a short time. Wait a moment, then retry.", true],
    [500, "Sales needing repair could not be loaded.", true],
  ])("a %i on the first page is its own state", async (status, message, retry) => {
    api.consoleListNeedsRepair.mockResolvedValue(failure(status));
    renderList();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(message);
    expect(within(alert).queryByRole("button", { name: "Retry" }) !== null).toBe(retry);
  });

  test("Refresh reads the queue again; nothing is sent on its own", async () => {
    renderList();
    await screen.findByRole("link", { name: "Open sale POS-CAI-0042" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(api.consoleListNeedsRepair).toHaveBeenCalledTimes(2));
    expect(api.consoleRepairSaleSync).not.toHaveBeenCalled();
  });
});
