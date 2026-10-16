import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * RT-559 Overview panels (spec 009 §8). Every panel reads through the existing
 * typed wrappers, mocked here; the store roster (zones for the P-2 window) is
 * the shared store-list hook.
 */
const listErpnextNegativeOnHandStores = vi.fn();
vi.mock("@/lib/stock-discrepancy-queries", () => ({
  listErpnextNegativeOnHandStores: (...a: unknown[]) => listErpnextNegativeOnHandStores(...a),
}));
const consoleListShiftCloses = vi.fn();
vi.mock("@/lib/shift-close-queries", () => ({
  consoleListShiftCloses: (...a: unknown[]) => consoleListShiftCloses(...a),
}));
const listUnknownItems = vi.fn();
vi.mock("@/lib/unknown-items-queries", () => ({
  listUnknownItems: (...a: unknown[]) => listUnknownItems(...a),
}));
const consoleListReceivables = vi.fn();
const listAuditEvents = vi.fn();
vi.mock("@/lib/client", () => ({
  consoleListReceivables: (...a: unknown[]) => consoleListReceivables(...a),
  listAuditEvents: (...a: unknown[]) => listAuditEvents(...a),
}));
const storeRows = vi.fn();
vi.mock("@/stores/useStoreQueries", () => ({
  useStoreList: () => ({ result: { kind: "rows", rows: storeRows() }, isLoading: false }),
  useStoreDetail: () => ({ result: undefined, isLoading: false }),
}));
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { createQueryClient } from "@/lib/query";
import { Overview } from "@/shell/Overview";

const A = "0190f000-0000-7000-8000-0000000000a1";
const B = "0190f000-0000-7000-8000-0000000000a2";
const NOW = "2026-10-15T22:30:00Z"; // Oct 16 in Cairo, Oct 15 in UTC
const READ_AT = "2026-10-15T07:58:12.000Z";

function ctx(role: string, store: { id: string; name: string } | null = null) {
  return {
    context: {
      active_tenant: { id: "t1", name: "Northstar Retail" },
      active_store: store,
      active_role_code: role,
    },
  };
}

function snapshot(status: string, over: Record<string, unknown> = {}) {
  const has = status === "fresh" || status === "stale";
  return {
    status,
    erpnextWarehouseRef: has ? "Stores - NSR" : null,
    runId: has ? "0190f000-0000-7000-8000-0000000000r1" : null,
    readAt: has ? READ_AT : null,
    recordedAt: has ? READ_AT : null,
    staleAfterSeconds: 86400,
    reportedEntryCount: has ? 42 : null,
    pendingRequest: null,
    ...over,
  };
}

function summary(storeId: string, storeName: string, status = "fresh", negativeItemCount = 0) {
  return { storeId, storeName, snapshot: snapshot(status), negativeItemCount };
}

const ok = (data: unknown) => Promise.resolve({ status: 200, data });
const fail = (status: number) =>
  Promise.resolve({ status, error: { error: { code: "x", request_id: "req-1" } } });

function event(i: number, action = "auth.signin") {
  return {
    id: `0190f000-0000-7000-8000-00000000e${String(i).padStart(3, "0")}`,
    occurred_at: `2026-10-15T09:${String(i).padStart(2, "0")}:00Z`,
    actor_label: `Actor ${i}`,
    action,
    metadata: {},
  };
}

/** Every panel answers with one quiet page unless a test overrides it. */
function answerAll(): void {
  listErpnextNegativeOnHandStores.mockImplementation(() =>
    ok({ items: [summary(A, "Cairo Festival City", "fresh", 3)], nextCursor: null }),
  );
  consoleListShiftCloses.mockImplementation(() => ok({ items: [{}, {}], nextCursor: null }));
  listUnknownItems.mockImplementation(() => ok({ items: [{}], next_cursor: null }));
  consoleListReceivables.mockImplementation(() => ok({ items: [], nextCursor: null }));
  listAuditEvents.mockImplementation(() => ok({ items: [event(1)], next_cursor: null }));
}

function renderOverview(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <Overview />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function row(label: string): HTMLElement {
  const el = screen.getByText(label).closest("li");
  if (!el) throw new Error(`no ledger row for ${label}`);
  return el as HTMLElement;
}

async function findRow(label: string): Promise<HTMLElement> {
  await screen.findByText(label);
  return row(label);
}

const SHIFT = "Shift-close variances with no recorded approver (last 7 days)";
const UNKNOWN = "Unknown items pending review";
const RECEIVABLES = "Receivables needing review";
const stockLabel = (store: string) => `Stock discrepancies · ${store}`;

describe("Overview panels (RT-559, spec 009)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
    for (const fn of [
      listErpnextNegativeOnHandStores,
      consoleListShiftCloses,
      listUnknownItems,
      consoleListReceivables,
      listAuditEvents,
      activeContext,
    ]) {
      fn.mockReset();
    }
    storeRows.mockReturnValue([
      { id: A, name: "Cairo Festival City", timezone: "Africa/Cairo" },
      { id: B, name: "Alexandria Corniche", timezone: "Africa/Cairo" },
    ]);
    answerAll();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("AC-1/AC-2: with no active tenant only the title renders and no panel is read", () => {
    activeContext.mockReturnValue({
      context: { active_tenant: null, active_store: null, active_role_code: null },
    });
    renderOverview();
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeTruthy();
    expect(screen.queryByText("Needs your attention")).toBeNull();
    for (const fn of [
      listErpnextNegativeOnHandStores,
      consoleListShiftCloses,
      listUnknownItems,
      consoleListReceivables,
      listAuditEvents,
    ]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  test("AC-1/AC-3: scope comes first, then one ledger row per panel with a link", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    renderOverview();
    const main = screen.getByRole("heading", { level: 1 }).parentElement as HTMLElement;
    expect(main.textContent).toContain("Northstar Retail");

    const stock = await findRow(stockLabel("Cairo Festival City"));
    expect(within(stock).getByText("Negative items: 3")).toBeTruthy();
    expect(
      within(stock).getByRole("link", { name: "View store discrepancies" }).getAttribute("href"),
    ).toBe(`/stock-discrepancies/${A}`);

    const shift = await findRow(SHIFT);
    await within(shift).findByText("Closes: 2");
    expect(within(shift).getByRole("link", { name: "Review closes" }).getAttribute("href")).toBe(
      "/shift-closes?from=2026-10-09&min=0.0001&approval=not_approved",
    );

    const unknown = await findRow(UNKNOWN);
    await within(unknown).findByText("Items: 1");
    expect(within(unknown).getByRole("link", { name: "Review items" }).getAttribute("href")).toBe(
      "/unknown-items",
    );

    const receivables = await findRow(RECEIVABLES);
    await within(receivables).findByText("None");
    const link = within(receivables).getByRole("link", {
      name: "Open receivables and filter by the “Flagged” state",
    });
    expect(link.getAttribute("href")).toBe("/receivables");
  });

  test("§6.3: one page per panel with the panel's own filter, never walked", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    consoleListShiftCloses.mockImplementation(() => ok({ items: [{}], nextCursor: "c2" }));
    renderOverview();
    await screen.findByText("Closes: 1 or more");
    expect(consoleListShiftCloses).toHaveBeenCalledTimes(1);
    expect(consoleListShiftCloses).toHaveBeenCalledWith({
      approval: "not_approved",
      min_abs_variance: "0.0001",
      closed_from: "2026-10-09T00:00:00.000Z",
    });
    expect(listUnknownItems).toHaveBeenCalledWith({ status: "pending" });
    expect(consoleListReceivables).toHaveBeenCalledWith({ state: "flagged" });
    expect(listAuditEvents).toHaveBeenCalledWith({ limit: 10 });
  });

  test("AC-9: a list with a further page shows 'at least N' of the rows returned", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    listUnknownItems.mockImplementation(() =>
      ok({ items: Array.from({ length: 12 }, () => ({})), next_cursor: "c2" }),
    );
    renderOverview();
    const unknown = await findRow(UNKNOWN);
    await within(unknown).findByText("Items: 12 or more");
    expect(listUnknownItems).toHaveBeenCalledTimes(1);
  });

  test("§6.3: an empty page with a cursor is not 'none'", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    consoleListReceivables.mockImplementation(() => ok({ items: [], nextCursor: "c2" }));
    renderOverview();
    const receivables = await findRow(RECEIVABLES);
    await within(receivables).findByText("The list has more to check");
    expect(within(receivables).queryByText("None")).toBeNull();
  });

  test("AC-4: a store with no snapshot or no warehouse mapping is Unknown, never 0", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    listErpnextNegativeOnHandStores.mockImplementation(() =>
      ok({
        items: [
          summary(A, "Cairo Festival City", "no_snapshot", 0),
          summary(B, "Alexandria Corniche", "no_warehouse_mapping", 0),
        ],
        nextCursor: null,
      }),
    );
    renderOverview();
    for (const name of ["Cairo Festival City", "Alexandria Corniche"]) {
      const stock = await findRow(stockLabel(name));
      expect(within(stock).getByText("Negative items: Unknown")).toBeTruthy();
      expect(within(stock).getByText("No ERPNext snapshot")).toBeTruthy();
      expect(within(stock).queryByText(/: 0$/)).toBeNull();
      expect(within(stock).queryByText("None")).toBeNull();
    }
  });

  test("a stale snapshot shows its count, the stale state and its as-of time", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    listErpnextNegativeOnHandStores.mockImplementation(() =>
      ok({ items: [summary(A, "Cairo Festival City", "stale", 5)], nextCursor: null }),
    );
    renderOverview();
    const stock = await findRow(stockLabel("Cairo Festival City"));
    expect(within(stock).getByText("Negative items: 5")).toBeTruthy();
    expect(within(stock).getByText("Stale snapshot")).toBeTruthy();
    expect(within(stock).getByText(/as of/).textContent).toContain("Oct 15, 2026");
  });

  test("loading: each row shows its own indicator while its read is in flight", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    consoleListReceivables.mockImplementation(() => new Promise(() => {}));
    renderOverview();
    const receivables = await findRow(RECEIVABLES);
    expect(within(receivables).getByText("Loading…")).toBeTruthy();
    await within(await findRow(UNKNOWN)).findByText("Items: 1");
  });

  test("AC-5: a failed panel shows an inline error with retry; the others still render", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    consoleListReceivables.mockImplementationOnce(() => fail(500));
    renderOverview();
    const receivables = await findRow(RECEIVABLES);
    await within(receivables).findByText("Couldn't load.");
    expect(within(receivables).queryByText("None")).toBeNull();
    expect(within(receivables).queryByText(/: 0/)).toBeNull();
    await within(await findRow(UNKNOWN)).findByText("Items: 1");

    fireEvent.click(within(receivables).getByRole("button", { name: "Retry" }));
    await within(row(RECEIVABLES)).findByText("None");
    expect(consoleListReceivables).toHaveBeenCalledTimes(2);
  });

  test("a malformed answer is an error, not an empty list", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    listUnknownItems.mockImplementation(() => ok({}));
    renderOverview();
    const unknown = await findRow(UNKNOWN);
    await within(unknown).findByText("Couldn't load.");
  });

  test("a store summary with a snapshot status outside the contract is an error, not a row", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    listErpnextNegativeOnHandStores.mockImplementation(() =>
      ok({ items: [summary(A, "Cairo Festival City", "toString", 0)], nextCursor: null }),
    );
    renderOverview();
    const stock = await findRow("Stock discrepancies");
    await within(stock).findByText("Couldn't load.");
    expect(screen.queryByText(/Cairo Festival City/)).toBeNull();
  });

  test("AC-6: a store manager's 403 panels are omitted, not shown as empty", async () => {
    activeContext.mockReturnValue(ctx("store_manager"));
    consoleListReceivables.mockImplementation(() => fail(403));
    listAuditEvents.mockImplementation(() => fail(403));
    renderOverview();
    await findRow(SHIFT);
    await within(row(UNKNOWN)).findByText("Items: 1");
    await waitFor(() => expect(screen.queryByText(RECEIVABLES)).toBeNull());
    await waitFor(() => expect(screen.queryByText("Recent activity")).toBeNull());
  });

  test("AC-6: store staff see no P-1, P-2, P-4 or P-5; the API is not asked for P-1/P-2", async () => {
    activeContext.mockReturnValue(ctx("store_staff"));
    consoleListReceivables.mockImplementation(() => fail(403));
    listAuditEvents.mockImplementation(() => fail(404));
    renderOverview();
    await within(await findRow(UNKNOWN)).findByText("Items: 1");
    expect(screen.queryByText(SHIFT)).toBeNull();
    expect(screen.queryByText(/Stock discrepancies/)).toBeNull();
    expect(listErpnextNegativeOnHandStores).not.toHaveBeenCalled();
    expect(consoleListShiftCloses).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(RECEIVABLES)).toBeNull());
    await waitFor(() => expect(screen.queryByText("Recent activity")).toBeNull());
  });

  test("a 404 on a role-allowed panel omits it too (the backend wins)", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    listErpnextNegativeOnHandStores.mockImplementation(() => fail(404));
    renderOverview();
    await within(await findRow(UNKNOWN)).findByText("Items: 1");
    await waitFor(() => expect(screen.queryByText(/Stock discrepancies/)).toBeNull());
  });

  test("with every attention panel refused, the ledger says so instead of rendering empty", async () => {
    activeContext.mockReturnValue(ctx("store_staff"));
    listUnknownItems.mockImplementation(() => fail(403));
    consoleListReceivables.mockImplementation(() => fail(403));
    listAuditEvents.mockImplementation(() => fail(403));
    renderOverview();
    await screen.findByText("No attention items are available to your role here.");
  });

  test("AC-7: an active store narrows every panel, for an owner too", async () => {
    activeContext.mockReturnValue(ctx("owner", { id: A, name: "Cairo Festival City" }));
    listErpnextNegativeOnHandStores.mockImplementation(() =>
      ok({
        items: [
          summary(A, "Cairo Festival City", "fresh", 3),
          summary(B, "Alexandria Corniche", "fresh", 9),
        ],
        nextCursor: null,
      }),
    );
    renderOverview();
    await findRow(stockLabel("Cairo Festival City"));
    await within(row(SHIFT)).findByText("Closes: 2");
    // Oct 10 00:00 in Cairo (the store's zone) is Oct 9 21:00Z.
    expect(consoleListShiftCloses).toHaveBeenCalledWith({
      approval: "not_approved",
      min_abs_variance: "0.0001",
      store_id: A,
      closed_from: "2026-10-09T21:00:00.000Z",
    });
    expect(listUnknownItems).toHaveBeenCalledWith({ status: "pending", store_id: A });
    expect(consoleListReceivables).toHaveBeenCalledWith({ state: "flagged", store_id: A });
    expect(listAuditEvents).toHaveBeenCalledWith({ limit: 10, store_id: A });
    expect(within(row(SHIFT)).getByRole("link").getAttribute("href")).toBe(
      `/shift-closes?store=${A}&from=2026-10-10&min=0.0001&approval=not_approved`,
    );
    expect(screen.queryByText(/Alexandria Corniche/)).toBeNull();
    expect(screen.queryByText("Negative items: 9")).toBeNull();
  });

  test("AC-7: the active store's stock row is found on a later page", async () => {
    activeContext.mockReturnValue(ctx("owner", { id: B, name: "Alexandria Corniche" }));
    listErpnextNegativeOnHandStores.mockImplementation((q: { cursor?: string }) =>
      q.cursor === "p2"
        ? ok({ items: [summary(B, "Alexandria Corniche", "fresh", 4)], nextCursor: null })
        : ok({ items: [summary(A, "Cairo Festival City", "fresh", 3)], nextCursor: "p2" }),
    );
    renderOverview();
    const stock = await findRow(stockLabel("Alexandria Corniche"));
    expect(within(stock).getByText("Negative items: 4")).toBeTruthy();
    expect(screen.queryByText(/Cairo Festival City/)).toBeNull();
  });

  test("tenant-wide, the stock rows list every store the API returns across pages", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    listErpnextNegativeOnHandStores.mockImplementation((q: { cursor?: string }) =>
      q.cursor === "p2"
        ? ok({ items: [summary(B, "Alexandria Corniche", "fresh", 4)], nextCursor: null })
        : ok({ items: [summary(A, "Cairo Festival City", "fresh", 3)], nextCursor: "p2" }),
    );
    renderOverview();
    await findRow(stockLabel("Cairo Festival City"));
    await findRow(stockLabel("Alexandria Corniche"));
  });

  test("AC-8: a store-scoped user sees only their granted store, never another's name", async () => {
    // Two-store tenant; the manager is granted A only, and the API answers for A.
    activeContext.mockReturnValue(ctx("store_manager", { id: A, name: "Cairo Festival City" }));
    listErpnextNegativeOnHandStores.mockImplementation(() =>
      ok({ items: [summary(A, "Cairo Festival City", "fresh", 3)], nextCursor: null }),
    );
    listAuditEvents.mockImplementation(() => fail(403));
    consoleListReceivables.mockImplementation(() => fail(403));
    renderOverview();
    await findRow(stockLabel("Cairo Festival City"));
    await within(row(UNKNOWN)).findByText("Items: 1");
    expect(screen.queryByText(/Alexandria Corniche/)).toBeNull();
    for (const call of [...consoleListShiftCloses.mock.calls, ...listUnknownItems.mock.calls]) {
      expect(call[0]).toMatchObject({ store_id: A });
    }
  });

  test("AC-10: recent activity shows up to 10 events with exact time, actor and catalog copy", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    listAuditEvents.mockImplementation(() =>
      ok({
        items: [event(1, "shift.opened"), event(2, "brand.new.code")],
        next_cursor: "more",
      }),
    );
    renderOverview();
    const table = await screen.findByRole("table", {
      name: "Latest recorded events in the current scope",
    });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("2026-10-15 09:01:00 UTC")).toBeTruthy();
    expect(within(rows[0]).getByText("Actor 1")).toBeTruthy();
    expect(within(rows[0]).getByText("Shift activity")).toBeTruthy();
    expect(within(rows[1]).getByText("Other recorded activity")).toBeTruthy();
    expect(screen.queryByText("shift.opened")).toBeNull();
    expect(screen.queryByText("brand.new.code")).toBeNull();
    expect(screen.getByRole("link", { name: "See all recorded events" }).getAttribute("href")).toBe(
      "/audit",
    );
  });

  test("recent activity: an empty scope says so; a failure has its own retry", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    listAuditEvents.mockImplementationOnce(() => fail(500));
    listAuditEvents.mockImplementation(() => ok({ items: [], next_cursor: null }));
    renderOverview();
    await screen.findByText("Couldn't load recent activity.");
    const section = screen.getByRole("region", { name: "Recent activity" });
    fireEvent.click(within(section).getByRole("button", { name: "Retry" }));
    await screen.findByText("No recorded activity in this scope.");
  });

  test("NG-7: one refresh control re-reads every panel", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    renderOverview();
    await within(await findRow(UNKNOWN)).findByText("Items: 1");
    await within(row(SHIFT)).findByText("Closes: 2");
    await screen.findByText("Actor 1");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => {
      for (const fn of [
        listErpnextNegativeOnHandStores,
        consoleListShiftCloses,
        listUnknownItems,
        consoleListReceivables,
        listAuditEvents,
      ]) {
        expect(fn).toHaveBeenCalledTimes(2);
      }
    });
  });

  test("AC-12: a tenant change re-reads every panel; no row from the old tenant stays", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    const qc = createQueryClient();
    // A fresh element per render: the mocked context is not reactive.
    const tree = () => (
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Overview />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const { rerender } = render(tree());
    await within(await findRow(UNKNOWN)).findByText("Items: 1");
    await findRow(stockLabel("Cairo Festival City"));

    listUnknownItems.mockImplementation(() => ok({ items: [{}, {}, {}, {}], next_cursor: null }));
    listErpnextNegativeOnHandStores.mockImplementation(() =>
      ok({ items: [summary(B, "Alexandria Corniche", "fresh", 6)], nextCursor: null }),
    );
    activeContext.mockReturnValue({
      context: {
        active_tenant: { id: "t2", name: "Helios Markets" },
        active_store: null,
        active_role_code: "owner",
      },
    });
    rerender(tree());
    await within(row(UNKNOWN)).findByText("Items: 4");
    await findRow(stockLabel("Alexandria Corniche"));
    expect(screen.queryByText(stockLabel("Cairo Festival City"))).toBeNull();
    expect(screen.queryByText("Items: 1")).toBeNull();
    for (const fn of [
      listErpnextNegativeOnHandStores,
      consoleListShiftCloses,
      listUnknownItems,
      consoleListReceivables,
      listAuditEvents,
    ]) {
      expect(fn).toHaveBeenCalledTimes(2);
    }
  });

  test("a malformed store roster does not break the page; the window falls back to UTC", async () => {
    activeContext.mockReturnValue(ctx("owner", { id: A, name: "Cairo Festival City" }));
    storeRows.mockReturnValue({});
    renderOverview();
    await within(await findRow(SHIFT)).findByText("Closes: 2");
    expect(consoleListShiftCloses).toHaveBeenCalledWith(
      expect.objectContaining({ store_id: A, closed_from: "2026-10-09T00:00:00.000Z" }),
    );
  });

  test("AC-11: no sales or KPI element renders", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    renderOverview();
    await within(await findRow(UNKNOWN)).findByText("Items: 1");
    expect(screen.queryByText(/sales/i)).toBeNull();
  });
});
