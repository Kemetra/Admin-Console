import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const api = {
  listStoreMovements: vi.fn(),
  listStockLocations: vi.fn(),
  getOnHand: vi.fn(),
  listTrackingIdentities: vi.fn(),
};
vi.mock("@/lib/inventory-queries", () => ({
  listStoreMovements: (...a: unknown[]) => api.listStoreMovements(...a),
  listStockLocations: (...a: unknown[]) => api.listStockLocations(...a),
  getOnHand: (...a: unknown[]) => api.getOnHand(...a),
  listTrackingIdentities: (...a: unknown[]) => api.listTrackingIdentities(...a),
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

import { InventoryProduct } from "@/inventory/InventoryProduct";
import { InventoryStore } from "@/inventory/InventoryStore";
import { InventoryStores } from "@/inventory/InventoryStores";
import { createQueryClient } from "@/lib/query";
import { resetRateLimit } from "@/lib/rate-limit";

const STORE = "0190f000-0000-7000-8000-0000000007a1";
const OTHER_STORE = "0190f000-0000-7000-8000-0000000007a2";
const PRODUCT = "0190f000-0000-7000-8000-0000000007c1";
const LOCATION = "0190f000-0000-7000-8000-0000000007d1";
const REQUEST_ID = "0190f000-0000-7000-8000-0000000007e1";

function ctx(
  role: string | null = "owner",
  opts: { tenant?: boolean; activeStore?: { id: string; name: string } | null } = {},
) {
  const { tenant = true, activeStore = null } = opts;
  return {
    context: {
      user: { id: "u1", display_name: "Amal Saleh" },
      active_tenant: tenant ? { id: "t1", name: "Northstar Retail" } : null,
      active_store: activeStore,
      active_role_code: role,
      memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: role }],
    },
    switchTenant: () => {},
    switchStore: () => {},
    clearStore: () => {},
  };
}

const ok = <T,>(data: T) => ({ status: 200, data });
const failure = (status: number, retryAfter?: number) => ({
  status,
  error: { error: { code: "x", message: "x", request_id: REQUEST_ID } },
  retryAfter,
});
const page = (items: unknown[], nextCursor: string | null = null) => ok({ items, nextCursor });

function movement(overrides: Record<string, unknown> = {}) {
  return {
    id: "0190f000-0000-7000-8000-000000000f01",
    storeId: STORE,
    movementType: "outbound",
    quantity: "-2.5000",
    stockingUnit: "kg",
    tenantProductRef: PRODUCT,
    reason: null,
    occurredAt: "2026-10-18T09:00:00Z",
    receivedAt: "2026-10-18T09:00:01Z",
    createdBy: "0190f000-0000-7000-8000-000000000a01",
    origin: "retail",
    integrationState: "pending",
    erpConfirmedAt: null,
    stockLocationId: LOCATION,
    inventoryStatus: "sellable",
    positionInterpreted: false,
    trackingIdentityId: null,
    ...overrides,
  };
}

const locations = {
  items: [
    {
      id: LOCATION,
      storeId: STORE,
      code: "MAIN",
      name: "Main floor",
      kind: "primary",
      isActive: true,
    },
  ],
};

const onHand = {
  storeId: STORE,
  productId: PRODUCT,
  quantity: "-1.2500",
  stockingUnit: "kg",
  negativeBalance: true,
  sellableQuantity: "-1.2500",
  statusQuantities: [
    { inventoryStatus: "sellable", quantity: "-1.2500" },
    { inventoryStatus: "damaged", quantity: "0.0000" },
  ],
};

const stores = [
  { id: STORE, code: "CAI", name: "Cairo Festival", timezone: "Africa/Cairo", is_active: true },
  { id: OTHER_STORE, code: "ALX", name: "Alexandria", timezone: "Africa/Cairo", is_active: true },
];

function renderAt(entry: string): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/inventory" element={<InventoryStores />} />
          <Route path="/inventory/stores/:storeId" element={<InventoryStore />} />
          <Route
            path="/inventory/stores/:storeId/products/:productId"
            element={<InventoryProduct />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  listStores.mockReset();
  activeContext.mockReset();
  resetRateLimit();
  activeContext.mockReturnValue(ctx("owner"));
  listStores.mockResolvedValue({ status: 200, data: stores });
  api.listStockLocations.mockResolvedValue(ok(locations));
  api.listStoreMovements.mockResolvedValue(page([movement()]));
  api.getOnHand.mockResolvedValue(ok(onHand));
  api.listTrackingIdentities.mockResolvedValue(page([]));
});
afterEach(cleanup);

describe("inventory gate (RT-728)", () => {
  test.each(["cashier", "auditor", null])("%s gets NoAccess and nothing is requested", (role) => {
    activeContext.mockReturnValue(ctx(role));
    renderAt(`/inventory/stores/${STORE}`);
    expect(screen.queryByText("Stock movement ledger")).toBeNull();
    expect(api.listStoreMovements).not.toHaveBeenCalled();
    expect(api.listStockLocations).not.toHaveBeenCalled();
  });

  test("without a tenant it asks for one and requests nothing", () => {
    activeContext.mockReturnValue(ctx("owner", { tenant: false }));
    renderAt("/inventory");
    expect(screen.getByText(/Choose a tenant/)).toBeDefined();
    expect(listStores).not.toHaveBeenCalled();
  });
});

describe("InventoryStores (RT-728)", () => {
  test("lists the caller's stores, each linking to its ledger", async () => {
    renderAt("/inventory");
    const link = await screen.findByRole("link", { name: "Cairo Festival" });
    expect(link.getAttribute("href")).toBe(`/inventory/stores/${STORE}`);
    expect(screen.getByRole("link", { name: "Alexandria" })).toBeDefined();
  });

  test("with an active store, only that store is offered", async () => {
    activeContext.mockReturnValue(
      ctx("store_manager", { activeStore: { id: STORE, name: "Cairo Festival" } }),
    );
    renderAt("/inventory");
    expect(await screen.findByRole("link", { name: "Cairo Festival" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Alexandria" })).toBeNull();
  });

  test("an empty store list is an empty state, a failed one an error", async () => {
    listStores.mockResolvedValue({ status: 200, data: [] });
    renderAt("/inventory");
    expect(await screen.findByText("No stores are available to you in this tenant.")).toBeDefined();
    cleanup();
    listStores.mockResolvedValue({ status: 500, error: {} });
    renderAt("/inventory");
    expect(await screen.findByText("Stores could not be loaded.")).toBeDefined();
  });
});

describe("InventoryStore (RT-728)", () => {
  test("shows locations and the whole-store ledger with exact quantities", async () => {
    renderAt(`/inventory/stores/${STORE}`);
    expect(await screen.findByRole("heading", { name: "Cairo Festival" })).toBeDefined();
    await screen.findByTestId("movement-quantity");
    const ledger = screen.getByRole("table", { name: "Stock movements, newest first" });
    expect(within(ledger).getByTestId("movement-quantity").textContent).toBe("-2.5000 kg");
    expect(within(ledger).getByText("Outbound")).toBeDefined();
    expect(within(ledger).getByText("Posting pending")).toBeDefined();
    expect(within(ledger).getByText(/Main floor/)).toBeDefined();
    const open = within(ledger).getByRole("link", { name: `Open on-hand for product ${PRODUCT}` });
    expect(open.getAttribute("href")).toBe(`/inventory/stores/${STORE}/products/${PRODUCT}`);
    const locs = screen.getByRole("table", { name: /stock locations, primary first/i });
    expect(within(locs).getByText("Primary")).toBeDefined();
    expect(api.listStoreMovements).toHaveBeenCalledWith(STORE, {});
  });

  test("an ad-hoc movement has no product link; an unlisted location reads Unknown", async () => {
    api.listStoreMovements.mockResolvedValue(
      page([
        movement({ tenantProductRef: null, stockLocationId: OTHER_STORE, integrationState: null }),
      ]),
    );
    renderAt(`/inventory/stores/${STORE}`);
    await screen.findByTestId("movement-quantity");
    const ledger = screen.getByRole("table", { name: "Stock movements, newest first" });
    expect(within(ledger).getByText("No product")).toBeDefined();
    expect(within(ledger).queryByRole("link")).toBeNull();
    expect(within(ledger).getByText("Unknown")).toBeDefined();
    expect(within(ledger).getByText("Not recorded")).toBeDefined();
  });

  test("Load more follows nextCursor; a failed page keeps the loaded rows", async () => {
    api.listStoreMovements
      .mockResolvedValueOnce(page([movement()], "cursor-2"))
      .mockResolvedValueOnce(failure(500));
    renderAt(`/inventory/stores/${STORE}`);
    fireEvent.click(await screen.findByRole("button", { name: "Load older movements" }));
    expect(
      await screen.findByText(
        "This section could not be refreshed. Showing the last successful read.",
      ),
    ).toBeDefined();
    expect(api.listStoreMovements).toHaveBeenLastCalledWith(STORE, { cursor: "cursor-2" });
    expect(screen.getAllByTestId("movement-quantity")).toHaveLength(1);
  });

  test("an empty ledger is an empty state, not zero stock", async () => {
    api.listStoreMovements.mockResolvedValue(page([]));
    renderAt(`/inventory/stores/${STORE}`);
    expect(await screen.findByText("No stock movements at this store yet.")).toBeDefined();
  });

  test("a store outside scope (404) reads as not available", async () => {
    api.listStoreMovements.mockResolvedValue(failure(404));
    api.listStockLocations.mockResolvedValue(failure(404));
    renderAt(`/inventory/stores/${STORE}`);
    expect((await screen.findAllByText("This store is not available.")).length).toBeGreaterThan(0);
  });

  test("a rate-limited read says how long to wait", async () => {
    api.listStoreMovements.mockResolvedValue(failure(429, 12));
    renderAt(`/inventory/stores/${STORE}`);
    expect(
      await screen.findByText("Too many requests in a short time. Retry in 12 seconds."),
    ).toBeDefined();
  });

  test("a malformed store id is never sent", async () => {
    renderAt("/inventory/stores/not-a-uuid");
    expect(await screen.findByText("This store is not available.")).toBeDefined();
    expect(api.listStoreMovements).not.toHaveBeenCalled();
  });
});

describe("InventoryProduct (RT-728)", () => {
  test("shows the derived on-hand as sent, with the negative flag", async () => {
    renderAt(`/inventory/stores/${STORE}/products/${PRODUCT}`);
    const qty = await screen.findByTestId("on-hand-quantity");
    expect(qty.textContent).toBe("-1.2500 kg");
    expect(screen.getByTestId("on-hand-sellable").textContent).toBe("-1.2500 kg");
    expect(screen.getByText(/On-hand is below zero/)).toBeDefined();
    expect(screen.getByText("Damaged")).toBeDefined();
    expect(api.getOnHand).toHaveBeenCalledWith(STORE, PRODUCT);
  });

  test("a failed on-hand read is Unknown, never zero", async () => {
    api.getOnHand.mockResolvedValue(failure(500));
    renderAt(`/inventory/stores/${STORE}/products/${PRODUCT}`);
    expect(
      await screen.findByText("On-hand could not be loaded. The balance is unknown."),
    ).toBeDefined();
    const qty = screen.getByTestId("on-hand-quantity");
    expect(qty.textContent).toContain("Unknown");
    expect(qty.textContent).not.toMatch(/\d/);
  });

  test("a missing stocking unit reads Unknown", async () => {
    api.getOnHand.mockResolvedValue(ok({ ...onHand, stockingUnit: null, negativeBalance: false }));
    renderAt(`/inventory/stores/${STORE}/products/${PRODUCT}`);
    expect((await screen.findByTestId("on-hand-quantity")).textContent).toBe("-1.2500 Unknown");
    expect(screen.queryByText(/On-hand is below zero/)).toBeNull();
  });

  test("owner sees tracking identities (empty until identities exist)", async () => {
    renderAt(`/inventory/stores/${STORE}/products/${PRODUCT}`);
    expect(
      await screen.findByText("No batches or serials are recorded for this product."),
    ).toBeDefined();
    expect(api.listTrackingIdentities).toHaveBeenCalledWith(PRODUCT, {});
  });

  test("tracking rows render; a 404 omits the section", async () => {
    api.listTrackingIdentities.mockResolvedValue(
      page([
        {
          id: "0190f000-0000-7000-8000-000000000b01",
          productId: PRODUCT,
          kind: "batch",
          code: "LOT-42",
          expiryDate: "2027-01-31",
          manufacturedOn: null,
          origin: "erp_external",
        },
      ]),
    );
    renderAt(`/inventory/stores/${STORE}/products/${PRODUCT}`);
    expect(await screen.findByText("LOT-42")).toBeDefined();
    expect(screen.getByText("Batch")).toBeDefined();
    cleanup();
    api.listTrackingIdentities.mockResolvedValue(failure(404));
    renderAt(`/inventory/stores/${STORE}/products/${PRODUCT}`);
    await screen.findByTestId("on-hand-quantity");
    await waitFor(() => expect(api.listTrackingIdentities).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Batches and serials")).toBeNull());
  });

  test("store_manager never requests tracking identities", async () => {
    activeContext.mockReturnValue(ctx("store_manager"));
    renderAt(`/inventory/stores/${STORE}/products/${PRODUCT}`);
    await screen.findByTestId("on-hand-quantity");
    expect(screen.queryByText("Batches and serials")).toBeNull();
    expect(api.listTrackingIdentities).not.toHaveBeenCalled();
  });

  test("a malformed product id is never sent", async () => {
    renderAt(`/inventory/stores/${STORE}/products/abc`);
    expect(await screen.findByText("This product is not available at this store.")).toBeDefined();
    expect(api.getOnHand).not.toHaveBeenCalled();
  });
});
