import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const listErpnextNegativeOnHand = vi.fn();
const triggerReconciliationRun = vi.fn();
const listErpnextNegativeOnHandStores = vi.fn();
vi.mock("@/lib/stock-discrepancy-queries", () => ({
  listErpnextNegativeOnHand: (...a: unknown[]) => listErpnextNegativeOnHand(...a),
  listErpnextNegativeOnHandStores: (...a: unknown[]) => listErpnextNegativeOnHandStores(...a),
  triggerReconciliationRun: (...a: unknown[]) => triggerReconciliationRun(...a),
}));
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { createQueryClient } from "@/lib/query";
import { StockDiscrepancyStore } from "@/stock-discrepancies/StockDiscrepancyStore";

const STORE = "0190f000-0000-7000-8000-0000000000a1";
const READ_AT = "2026-10-04T07:58:12.000Z";
const RECORDED_AT = "2026-10-04T08:00:03.000Z";

function ctx(role: string) {
  return {
    context: {
      active_tenant: { id: "t1", name: "Northstar Retail" },
      active_store: null,
      active_role_code: role,
    },
  };
}

function snapshot(over: Record<string, unknown> = {}) {
  return {
    status: "fresh",
    erpnextWarehouseRef: "Stores - NSR",
    runId: "0190f000-0000-7000-8000-0000000000r1",
    readAt: READ_AT,
    recordedAt: RECORDED_AT,
    staleAfterSeconds: 86400,
    reportedEntryCount: 42,
    pendingRequest: null,
    ...over,
  };
}

function item(over: Record<string, unknown> = {}) {
  return {
    discrepancyKind: "erpnext_negative_on_hand",
    erpnextItemRef: { doctype: "Item", name: "ITM-0001" },
    mappingStatus: "mapped",
    tenantProduct: { id: "0190f000-0000-7000-8000-0000000000p1", name: "Panadol 500mg" },
    erpnextWarehouseRef: "Stores - NSR",
    quantity: "-3.000000",
    stockUom: "Nos",
    ...over,
  };
}

function page(snap: Record<string, unknown>, items: unknown[] = [], nextCursor = null) {
  return { status: 200, data: { storeId: STORE, snapshot: snap, items, nextCursor } };
}

function renderStore(): void {
  const qc = createQueryClient();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/stock-discrepancies/${STORE}`]}>
        <Routes>
          <Route path="/stock-discrepancies/:storeId" element={<StockDiscrepancyStore />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** AC7: no rendered copy ever calls the snapshot live or current. */
function expectNoLiveOrCurrent(): void {
  expect(document.body.textContent ?? "").not.toMatch(/\blive\b|\bcurrent/i);
}

describe("StockDiscrepancyStore (RT-178)", () => {
  beforeEach(() => {
    listErpnextNegativeOnHand.mockReset();
    triggerReconciliationRun.mockReset();
    activeContext.mockReset();
  });

  test("AC1: quantity is rendered exactly as the API string, sign and trailing zeros kept", async () => {
    activeContext.mockReturnValue(ctx("tenant_admin"));
    const quantities = ["-3.000000", "-1.5", "-0.000001", "-123456789012345.123456", "-7"];
    listErpnextNegativeOnHand.mockResolvedValue(
      page(
        snapshot(),
        quantities.map((q, i) =>
          item({ quantity: q, erpnextItemRef: { doctype: "Item", name: `I${i}` } }),
        ),
      ),
    );
    renderStore();
    await screen.findByText("I0");
    const cells = screen.getAllByTestId("negative-quantity").map((c) => c.textContent);
    expect(cells).toEqual(quantities);
    expect(listErpnextNegativeOnHand).toHaveBeenCalledWith(STORE, { cursor: undefined });
  });

  test("table row: product name, ERPNext Item ref, warehouse, stock UOM", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    listErpnextNegativeOnHand.mockResolvedValue(page(snapshot(), [item()]));
    renderStore();
    expect(await screen.findByText("Panadol 500mg")).toBeDefined();
    expect(screen.getByText("ITM-0001")).toBeDefined();
    expect(screen.getAllByText("Stores - NSR").length).toBeGreaterThan(0);
    expect(screen.getByText("Nos")).toBeDefined();
  });

  test("AC7: 'ERPNext snapshot as of {readAt}' header shown when a snapshot exists", async () => {
    activeContext.mockReturnValue(ctx("tenant_admin"));
    listErpnextNegativeOnHand.mockResolvedValue(page(snapshot(), [item()]));
    renderStore();
    const heading = await screen.findByRole("heading", { name: /erpnext snapshot as of/i });
    expect(heading.textContent).toBe(`ERPNext snapshot as of ${READ_AT}`);
    expect(heading.querySelector("time")?.getAttribute("dateTime")).toBe(READ_AT);
    expectNoLiveOrCurrent();
  });

  test("AC3: stale shows a warning AND still lists the items", async () => {
    activeContext.mockReturnValue(ctx("tenant_admin"));
    listErpnextNegativeOnHand.mockResolvedValue(
      page(snapshot({ status: "stale" }), [
        item(),
        item({ erpnextItemRef: { doctype: "Item", name: "ITM-0002" }, quantity: "-1.500000" }),
      ]),
    );
    renderStore();
    expect(await screen.findByText(/older than 24 hours/i)).toBeDefined();
    expect(screen.getByText("Stale snapshot")).toBeDefined();
    expect(screen.getByText("ITM-0001")).toBeDefined();
    expect(screen.getByText("ITM-0002")).toBeDefined();
    expect(screen.getByRole("heading", { name: /erpnext snapshot as of/i })).toBeDefined();
    expectNoLiveOrCurrent();
  });

  test("AC2: no_snapshot is an explicit 'No ERPNext snapshot' state, never 'no discrepancies'", async () => {
    activeContext.mockReturnValue(ctx("tenant_admin"));
    listErpnextNegativeOnHand.mockResolvedValue(
      page(
        snapshot({
          status: "no_snapshot",
          runId: null,
          readAt: null,
          recordedAt: null,
          reportedEntryCount: null,
        }),
      ),
    );
    renderStore();
    expect(await screen.findByRole("heading", { name: "No ERPNext snapshot" })).toBeDefined();
    expect(screen.getByText(/no erpnext snapshot has been recorded/i)).toBeDefined();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/no items below zero/i);
    expect(text).not.toMatch(/as of/i);
    expect(screen.queryByRole("table")).toBeNull();
    expectNoLiveOrCurrent();
  });

  test("AC2: no_warehouse_mapping is an explicit 'No ERPNext snapshot' state", async () => {
    activeContext.mockReturnValue(ctx("tenant_admin"));
    listErpnextNegativeOnHand.mockResolvedValue(
      page(
        snapshot({
          status: "no_warehouse_mapping",
          erpnextWarehouseRef: null,
          runId: null,
          readAt: null,
          recordedAt: null,
          reportedEntryCount: null,
        }),
      ),
    );
    renderStore();
    expect(await screen.findByRole("heading", { name: "No ERPNext snapshot" })).toBeDefined();
    expect(screen.getByText(/no erpnext stock warehouse mapping/i)).toBeDefined();
    expect(document.body.textContent ?? "").not.toMatch(/no items below zero/i);
    // Refresh cannot produce a snapshot without a mapping: disabled, with the reason.
    const button = screen.getByRole("button", { name: /request fresh snapshot/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expectNoLiveOrCurrent();
  });

  test("fresh snapshot with zero items -> 'No items below zero in this ERPNext snapshot'", async () => {
    activeContext.mockReturnValue(ctx("tenant_admin"));
    listErpnextNegativeOnHand.mockResolvedValue(page(snapshot(), []));
    renderStore();
    expect(await screen.findByText(/no items below zero in this erpnext snapshot/i)).toBeDefined();
    expect(screen.getByRole("heading", { name: /erpnext snapshot as of/i })).toBeDefined();
  });

  test("AC4: pendingRequest shows 'requested, awaiting Connector' (previous snapshot kept)", async () => {
    activeContext.mockReturnValue(ctx("tenant_admin"));
    listErpnextNegativeOnHand.mockResolvedValue(
      page(
        snapshot({
          pendingRequest: {
            runId: "0190f000-0000-7000-8000-0000000000r2",
            requestedAt: new Date().toISOString(),
          },
        }),
        [item()],
      ),
    );
    renderStore();
    expect(await screen.findByText(/requested, awaiting connector/i)).toBeDefined();
    expect(screen.getByText("ITM-0001")).toBeDefined();
    expect(screen.queryByText(/not yet reported/i)).toBeNull();
  });

  test("AC4: a pendingRequest older than 15 min names the likely causes", async () => {
    activeContext.mockReturnValue(ctx("tenant_admin"));
    listErpnextNegativeOnHand.mockResolvedValue(
      page(
        snapshot({
          status: "no_snapshot",
          runId: null,
          readAt: null,
          recordedAt: null,
          reportedEntryCount: null,
          pendingRequest: {
            runId: "0190f000-0000-7000-8000-0000000000r2",
            requestedAt: "2020-01-01T00:00:00.000Z",
          },
        }),
      ),
    );
    renderStore();
    expect(await screen.findByText(/requested, awaiting connector/i)).toBeDefined();
    expect(screen.getByText(/requested but not yet reported/i)).toBeDefined();
    expect(screen.getByText(/connector may be offline/i)).toBeDefined();
    expect(screen.getByText(/more than 500 items/i)).toBeDefined();
  });

  test("AC5: unmapped item shows a 'Not mapped' badge and its ERPNext Item ref", async () => {
    activeContext.mockReturnValue(ctx("tenant_admin"));
    listErpnextNegativeOnHand.mockResolvedValue(
      page(snapshot(), [
        item({
          mappingStatus: "unmapped",
          tenantProduct: null,
          erpnextItemRef: { doctype: "Item", name: "ERP-ONLY-77" },
          quantity: "-1.500000",
        }),
      ]),
    );
    renderStore();
    const badge = await screen.findByText("Not mapped");
    expect(badge.classList.contains("badge")).toBe(true);
    const row = badge.closest("tr");
    expect(row?.textContent).toContain("ERP-ONLY-77");
    expect(row?.textContent).toContain("-1.500000");
  });

  test("static ERPNext Desk guidance is shown", async () => {
    activeContext.mockReturnValue(ctx("store_manager"));
    listErpnextNegativeOnHand.mockResolvedValue(page(snapshot(), [item()]));
    renderStore();
    const guidance = await screen.findByRole("complementary", { name: /erpnext desk/i });
    expect(guidance.textContent).toMatch(/purchase receipt/i);
    expect(guidance.textContent).toMatch(/stock entry/i);
    expect(guidance.textContent).toMatch(/stock reconciliation/i);
    expect(guidance.textContent).toMatch(/do not post a balancing entry blindly/i);
  });

  test("AC6: refresh button hidden for store_manager", async () => {
    activeContext.mockReturnValue(ctx("store_manager"));
    listErpnextNegativeOnHand.mockResolvedValue(page(snapshot(), [item()]));
    renderStore();
    await screen.findByText("ITM-0001");
    expect(screen.queryByRole("button", { name: /request fresh snapshot/i })).toBeNull();
  });

  test.each(["owner", "tenant_admin"])(
    "AC6: %s sees refresh; click calls triggerReconciliationRun with storeId + Idempotency-Key",
    async (role) => {
      activeContext.mockReturnValue(ctx(role));
      listErpnextNegativeOnHand.mockResolvedValue(page(snapshot(), [item()]));
      triggerReconciliationRun.mockResolvedValue({ status: 201, data: {}, headers: new Headers() });
      renderStore();
      const button = await screen.findByRole("button", { name: /request fresh snapshot/i });
      fireEvent.click(button);
      await waitFor(() => expect(triggerReconciliationRun).toHaveBeenCalledTimes(1));
      const [storeId, key] = triggerReconciliationRun.mock.calls[0] as [string, string];
      expect(storeId).toBe(STORE);
      expect(key).toMatch(/^[\x21-\x7E]{16,128}$/);
      // The store page re-reads so the API's pendingRequest can appear.
      await waitFor(() => expect(listErpnextNegativeOnHand).toHaveBeenCalledTimes(2));
    },
  );

  test("refresh: each click sends a new Idempotency-Key", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    listErpnextNegativeOnHand.mockResolvedValue(page(snapshot(), [item()]));
    triggerReconciliationRun.mockResolvedValue({ status: 201, data: {}, headers: new Headers() });
    renderStore();
    const button = await screen.findByRole("button", { name: /request fresh snapshot/i });
    fireEvent.click(button);
    await waitFor(() => expect(triggerReconciliationRun).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: /request fresh snapshot/i }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: /request fresh snapshot/i }));
    await waitFor(() => expect(triggerReconciliationRun).toHaveBeenCalledTimes(2));
    const keys = triggerReconciliationRun.mock.calls.map((c) => c[1]);
    expect(keys[0]).not.toBe(keys[1]);
  });

  test("refresh 404 -> not-found banner", async () => {
    activeContext.mockReturnValue(ctx("tenant_admin"));
    listErpnextNegativeOnHand.mockResolvedValue(page(snapshot(), [item()]));
    triggerReconciliationRun.mockResolvedValue({
      status: 404,
      error: { error: { code: "not_found", message: "x", request_id: "req-t404" } },
      headers: new Headers(),
    });
    renderStore();
    fireEvent.click(await screen.findByRole("button", { name: /request fresh snapshot/i }));
    expect(await screen.findByText(/cannot be requested for this store/i)).toBeDefined();
    expect(screen.getByText(/req-t404/)).toBeDefined();
  });

  test("AC6: a 404 from the API renders as not-found", async () => {
    activeContext.mockReturnValue(ctx("store_manager"));
    listErpnextNegativeOnHand.mockResolvedValue({
      status: 404,
      error: { error: { code: "not_found", message: "Not found", request_id: "req-404" } },
    });
    renderStore();
    expect(await screen.findByRole("heading", { name: /store not found/i })).toBeDefined();
    expect(screen.getByText(/req-404/)).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: /request fresh snapshot/i })).toBeNull();
  });

  test("no active tenant -> scope prompt, API not called", async () => {
    activeContext.mockReturnValue({ context: { active_tenant: null } });
    renderStore();
    expect(await screen.findByText(/select a tenant/i)).toBeDefined();
    expect(listErpnextNegativeOnHand).not.toHaveBeenCalled();
  });

  test("pagination: 'Load more items' fetches the next page with the API cursor", async () => {
    activeContext.mockReturnValue(ctx("tenant_admin"));
    listErpnextNegativeOnHand
      .mockResolvedValueOnce({
        status: 200,
        data: { storeId: STORE, snapshot: snapshot(), items: [item()], nextCursor: "abc_DEF-1" },
      })
      .mockResolvedValueOnce(
        page(snapshot(), [item({ erpnextItemRef: { doctype: "Item", name: "ITM-0009" } })]),
      );
    renderStore();
    fireEvent.click(await screen.findByRole("button", { name: /load more items/i }));
    expect(await screen.findByText("ITM-0009")).toBeDefined();
    expect(listErpnextNegativeOnHand).toHaveBeenLastCalledWith(STORE, { cursor: "abc_DEF-1" });
    expect(screen.getByText("ITM-0001")).toBeDefined();
  });
});
