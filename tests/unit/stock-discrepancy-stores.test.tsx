import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const listErpnextNegativeOnHandStores = vi.fn();
vi.mock("@/lib/stock-discrepancy-queries", () => ({
  listErpnextNegativeOnHandStores: (...a: unknown[]) => listErpnextNegativeOnHandStores(...a),
  listErpnextNegativeOnHand: vi.fn(),
  triggerReconciliationRun: vi.fn(),
}));
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { createQueryClient } from "@/lib/query";
import { StockDiscrepancyStores } from "@/stock-discrepancies/StockDiscrepancyStores";

const S1 = "0190f000-0000-7000-8000-0000000000a1";
const S2 = "0190f000-0000-7000-8000-0000000000a2";
const S3 = "0190f000-0000-7000-8000-0000000000a3";
const S4 = "0190f000-0000-7000-8000-0000000000a4";
const READ_AT = "2026-10-04T07:58:12.000Z";

function ctx(role: string, activeStoreId: string | null = null) {
  return {
    context: {
      active_tenant: { id: "t1", name: "Northstar Retail" },
      active_store: activeStoreId ? { id: activeStoreId, name: "Store" } : null,
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
    recordedAt: "2026-10-04T08:00:03.000Z",
    staleAfterSeconds: 86400,
    reportedEntryCount: 42,
    pendingRequest: null,
    ...over,
  };
}

const none = { runId: null, readAt: null, recordedAt: null, reportedEntryCount: null };

function summary(storeId: string, storeName: string, snap: unknown, negativeItemCount = 0) {
  return { storeId, storeName, snapshot: snap, negativeItemCount };
}

function renderStores(): void {
  const qc = createQueryClient();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <StockDiscrepancyStores />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function rowFor(name: string): HTMLElement {
  const link = screen.getByRole("link", { name });
  const row = link.closest("tr");
  if (!row) throw new Error(`no row for ${name}`);
  return row as HTMLElement;
}

describe("StockDiscrepancyStores (RT-178)", () => {
  beforeEach(() => {
    listErpnextNegativeOnHandStores.mockReset();
    activeContext.mockReset();
  });

  test("every state renders honestly: counts, as-of, unknown, pending", async () => {
    activeContext.mockReturnValue(ctx("tenant_admin"));
    listErpnextNegativeOnHandStores.mockResolvedValue({
      status: 200,
      data: {
        items: [
          summary(S1, "Cairo Festival City", snapshot(), 2),
          summary(S2, "Maadi", snapshot({ status: "stale" }), 5),
          summary(S3, "Zamalek", snapshot({ status: "no_snapshot", ...none }), 0),
          summary(
            S4,
            "Heliopolis",
            snapshot({ status: "no_warehouse_mapping", erpnextWarehouseRef: null, ...none }),
            0,
          ),
        ],
        nextCursor: null,
      },
    });
    renderStores();
    await screen.findByRole("link", { name: "Cairo Festival City" });

    const fresh = within(rowFor("Cairo Festival City"));
    expect(fresh.getByText("Fresh snapshot")).toBeDefined();
    expect(fresh.getByText(READ_AT)).toBeDefined();
    expect(fresh.getByText("2")).toBeDefined();

    const stale = within(rowFor("Maadi"));
    expect(stale.getByText("Stale snapshot")).toBeDefined();
    expect(stale.getByText("5")).toBeDefined();

    // AC2: no snapshot → "Unknown", never 0 / "no discrepancies".
    for (const name of ["Zamalek", "Heliopolis"]) {
      const row = rowFor(name);
      expect(within(row).getByText("Unknown")).toBeDefined();
      expect(row.textContent).toMatch(/no erpnext snapshot/i);
      expect(row.textContent).not.toMatch(/\b0\b/);
    }
    expect(rowFor("Heliopolis").textContent).toMatch(/no warehouse mapping/i);
    expect(rowFor("Zamalek").textContent).toMatch(/not recorded yet/i);
    expect(document.body.textContent ?? "").not.toMatch(/no discrepancies/i);
    // AC7: never "live" / "current".
    expect(document.body.textContent ?? "").not.toMatch(/\blive\b|\bcurrent/i);
  });

  test("AC4: a store with a pendingRequest reads 'Requested, awaiting Connector'", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    listErpnextNegativeOnHandStores.mockResolvedValue({
      status: 200,
      data: {
        items: [
          summary(
            S1,
            "Cairo Festival City",
            snapshot({
              pendingRequest: {
                runId: "0190f000-0000-7000-8000-0000000000r2",
                requestedAt: "2026-10-04T08:05:00.000Z",
              },
            }),
            1,
          ),
        ],
        nextCursor: null,
      },
    });
    renderStores();
    await screen.findByRole("link", { name: "Cairo Festival City" });
    expect(
      within(rowFor("Cairo Festival City")).getByText(/requested, awaiting connector/i),
    ).toBeDefined();
  });

  test("AC6: store_manager sees only the stores the API returns for it", async () => {
    activeContext.mockReturnValue(ctx("store_manager", S1));
    listErpnextNegativeOnHandStores.mockResolvedValue({
      status: 200,
      data: { items: [summary(S1, "Cairo Festival City", snapshot(), 1)], nextCursor: null },
    });
    renderStores();
    await screen.findByRole("link", { name: "Cairo Festival City" });
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText("Maadi")).toBeNull();
    // The summary list never offers the refresh action (per-store, owner/admin only).
    expect(screen.queryByRole("button", { name: /request fresh snapshot/i })).toBeNull();
    // Store rows link to the per-store view.
    expect(screen.getByRole("link", { name: "Cairo Festival City" }).getAttribute("href")).toBe(
      `/stock-discrepancies/${S1}`,
    );
  });

  test("AC6: a 404 from the API renders as not-found", async () => {
    activeContext.mockReturnValue(ctx("cashier"));
    listErpnextNegativeOnHandStores.mockResolvedValue({
      status: 404,
      error: { error: { code: "not_found", message: "Not found", request_id: "req-404" } },
    });
    renderStores();
    expect(await screen.findByText(/^not found\./i)).toBeDefined();
    expect(screen.getByText(/req-404/)).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("generic error -> banner with retry", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    listErpnextNegativeOnHandStores.mockResolvedValue({ status: 500, error: undefined });
    renderStores();
    expect(await screen.findByText(/could not be loaded/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /retry/i })).toBeDefined();
  });

  test("no active tenant -> scope prompt, API not called", async () => {
    activeContext.mockReturnValue({ context: { active_tenant: null } });
    renderStores();
    expect(await screen.findByText(/select a tenant/i)).toBeDefined();
    expect(listErpnextNegativeOnHandStores).not.toHaveBeenCalled();
  });

  test("P3-2: a failed 'Load more stores' keeps the rows and offers Retry inline", async () => {
    activeContext.mockReturnValue(ctx("owner"));
    listErpnextNegativeOnHandStores
      .mockResolvedValueOnce({
        status: 200,
        data: { items: [summary(S1, "Cairo Festival City", snapshot(), 1)], nextCursor: "c2" },
      })
      .mockResolvedValueOnce({ status: 500, error: { error: { request_id: "req-500" } } })
      .mockResolvedValueOnce({
        status: 200,
        data: { items: [summary(S2, "Maadi", snapshot(), 2)], nextCursor: null },
      });
    renderStores();
    fireEvent.click(await screen.findByRole("button", { name: /load more stores/i }));
    expect(await screen.findByText(/some rows could not be loaded/i)).toBeDefined();
    expect(screen.getByRole("link", { name: "Cairo Festival City" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByRole("link", { name: "Maadi" })).toBeDefined();
    expect(listErpnextNegativeOnHandStores).toHaveBeenLastCalledWith({ cursor: "c2" });
  });
});
