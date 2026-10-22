import type { ErpnextItemMapping } from "@/lib/erp-mapping-queries";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { PRODUCT_1, PRODUCT_2, failure as catalogFailure, page, product } from "./catalog-fixtures";

const api = vi.hoisted(() => ({
  tenantAdminListErpnextItemMappings: vi.fn(),
  tenantAdminSuggestErpnextItemMapping: vi.fn(),
  tenantAdminConfirmErpnextItemMapping: vi.fn(),
  tenantAdminRetireErpnextItemMapping: vi.fn(),
  tenantAdminListErpnextWarehouseMappings: vi.fn(),
  tenantAdminSetErpnextWarehouseMapping: vi.fn(),
  tenantAdminRetireErpnextWarehouseMapping: vi.fn(),
}));
vi.mock("@/lib/erp-mapping-queries", () =>
  Object.fromEntries(
    Object.keys(api).map((name) => [
      name,
      (...a: unknown[]) => api[name as keyof typeof api](...a),
    ]),
  ),
);
const consoleListCatalogProducts = vi.fn();
vi.mock("@/lib/catalog-queries", () => ({
  consoleListCatalogProducts: (...a: unknown[]) => consoleListCatalogProducts(...a),
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

import { ErpMappings } from "@/erp-mappings/ErpMappings";
import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { resetRateLimit } from "@/lib/rate-limit";

/**
 * RT-767: an ERPNext item mapping is suggested for a product picked from the
 * console catalog, not only for a product id already known from a retired row.
 * The product is never typed; the suggestion is sent once, after an explicit
 * confirm, and records an inert (suggested) mapping through Backend-Core only.
 */
const REQ = "11111111-2222-4333-8444-555555555555";
const WATER = product({ productId: PRODUCT_1, name: "Mineral water 1.5L" });
const COLA = product({ productId: PRODUCT_2, name: "Cola 330ml", primarySku: "SKU-0043" });

function mappingRow(over: Partial<ErpnextItemMapping> = {}): ErpnextItemMapping {
  return {
    id: "0190f000-0000-7000-8000-0000000000b1",
    tenant_product_id: PRODUCT_2,
    erpnext_item_ref: "ITEM-COLA-330",
    state: "suggested",
    suggestion_source: "manual",
    version: 3,
    suggested_by: null,
    suggested_at: "2026-10-18T09:00:00Z",
    confirmed_by: null,
    confirmed_at: null,
    retired_at: null,
    created_at: "2026-10-18T09:00:00Z",
    updated_at: "2026-10-18T09:00:00Z",
    ...over,
  };
}

const ok = <T,>(data: T, status = 200) => ({ status, data });
const failure = (status: number) => ({
  status,
  error: { error: { code: "x", message: "x", request_id: REQ } },
});

function ctx() {
  return {
    context: {
      user: { id: "u1", display_name: "Amal Saleh" },
      active_tenant: { id: "t1", name: "Northstar Retail" },
      active_store: null,
      active_role_code: "owner",
      memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "owner" }],
    },
    switchTenant: vi.fn(),
    switchStore: vi.fn(),
    clearStore: vi.fn(),
  };
}

function renderPage(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={["/erp-connection/mappings"]}>
        <Routes>
          <Route path="/erp-connection/mappings" element={<ErpMappings />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const itemsPanel = () => screen.getByRole("region", { name: "Item mappings" });

async function openPicker(): Promise<HTMLElement> {
  renderPage();
  fireEvent.click(await within(itemsPanel()).findByRole("button", { name: "Suggest a mapping" }));
  return within(itemsPanel()).findByRole("region", { name: "Suggest an item mapping" });
}

async function pickWater(step: HTMLElement): Promise<HTMLElement> {
  const options = await within(step).findAllByRole("option");
  fireEvent.click(options[0]);
  return within(itemsPanel()).findByRole("form", { name: "Suggest an item mapping" });
}

beforeEach(() => {
  setLocale("en");
  for (const fn of Object.values(api)) fn.mockReset();
  consoleListCatalogProducts.mockReset();
  listStores.mockReset();
  resetRateLimit();
  activeContext.mockReset();
  activeContext.mockReturnValue(ctx());
  listStores.mockResolvedValue({ status: 200, data: [] });
  api.tenantAdminListErpnextItemMappings.mockResolvedValue(ok({ items: [mappingRow()] }));
  api.tenantAdminListErpnextWarehouseMappings.mockResolvedValue(ok({ items: [] }));
  consoleListCatalogProducts.mockResolvedValue(page([WATER, COLA]));
});

describe("choosing the product", () => {
  test("the entry point opens the picker for active products; nothing is suggested", async () => {
    const step = await openPicker();
    expect(await within(step).findByRole("listbox", { name: "Active products" })).toBeDefined();
    expect(consoleListCatalogProducts).toHaveBeenCalledWith({ status: "active", limit: 25 });
    expect(api.tenantAdminSuggestErpnextItemMapping).not.toHaveBeenCalled();
  });

  test("choosing a product shows its name and id; the only text box is the ERPNext reference", async () => {
    const form = await pickWater(await openPicker());
    expect(form.textContent).toContain("Mineral water 1.5L");
    expect(form.textContent).toContain(PRODUCT_1);
    expect(within(form).getAllByRole("textbox")).toHaveLength(1);
    expect(document.activeElement).toBe(within(form).getByLabelText("ERPNext Item reference"));
    expect(api.tenantAdminSuggestErpnextItemMapping).not.toHaveBeenCalled();
  });

  test("Change product returns to the picker", async () => {
    const form = await pickWater(await openPicker());
    fireEvent.click(within(form).getByRole("button", { name: "Change product" }));
    expect(await screen.findByRole("listbox", { name: "Active products" })).toBeDefined();
  });

  test("Not now closes the flow without a request", async () => {
    const step = await openPicker();
    await within(step).findByRole("listbox");
    fireEvent.click(within(step).getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("region", { name: "Suggest an item mapping" })).toBeNull();
    expect(api.tenantAdminSuggestErpnextItemMapping).not.toHaveBeenCalled();
  });

  test("a catalog failure shows inside the flow with its request id; no suggestion is sent", async () => {
    consoleListCatalogProducts.mockResolvedValue(catalogFailure(500, "req-cat-1"));
    const step = await openPicker();
    expect((await within(step).findByRole("alert")).textContent).toContain("req-cat-1");
    expect(api.tenantAdminSuggestErpnextItemMapping).not.toHaveBeenCalled();
  });
});

describe("suggesting for the chosen product", () => {
  test("an empty reference is not sent; a trimmed one is, once, after the confirm, for the picked product", async () => {
    const form = await pickWater(await openPicker());
    fireEvent.click(within(form).getByRole("button", { name: "Review" }));
    expect(screen.getByText("Enter the ERPNext reference.")).toBeDefined();
    fireEvent.change(within(form).getByLabelText("ERPNext Item reference"), {
      target: { value: "  ITEM-WATER-15 " },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Review" }));
    const confirm = screen.getByRole("region", { name: "Suggest an item mapping" });
    expect(confirm.textContent).toContain("Mineral water 1.5L");
    expect(confirm.textContent).toContain("ITEM-WATER-15");
    expect(api.tenantAdminSuggestErpnextItemMapping).not.toHaveBeenCalled();
    api.tenantAdminSuggestErpnextItemMapping.mockResolvedValue(
      ok(mappingRow({ tenant_product_id: PRODUCT_1, erpnext_item_ref: "ITEM-WATER-15" }), 201),
    );
    const listReads = api.tenantAdminListErpnextItemMappings.mock.calls.length;
    fireEvent.click(within(confirm).getByRole("button", { name: "Record suggestion" }));
    expect(await screen.findByText(/Suggestion recorded/)).toBeDefined();
    expect(api.tenantAdminSuggestErpnextItemMapping).toHaveBeenCalledTimes(1);
    expect(api.tenantAdminSuggestErpnextItemMapping).toHaveBeenCalledWith({
      tenant_product_id: PRODUCT_1,
      erpnext_item_ref: "ITEM-WATER-15",
    });
    expect(screen.queryByRole("form", { name: "Suggest an item mapping" })).toBeNull();
    await waitFor(() =>
      expect(api.tenantAdminListErpnextItemMappings.mock.calls.length).toBeGreaterThan(listReads),
    );
  });

  test.each([
    [400, "The server rejected these values."],
    [403, "The server refused a change from this page."],
    [404, "This product isn't available to you. No suggestion was recorded."],
    [409, "This product already has an active mapping."],
    [429, "Too many requests."],
    [503, "Unknown result"],
  ])("suggest %i keeps the step open with its copy; never re-sent", async (status, copy) => {
    api.tenantAdminSuggestErpnextItemMapping.mockResolvedValue(failure(status));
    const form = await pickWater(await openPicker());
    fireEvent.change(within(form).getByLabelText("ERPNext Item reference"), {
      target: { value: "ITEM-X" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Review" }));
    const confirm = screen.getByRole("region", { name: "Suggest an item mapping" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Record suggestion" }));
    const alert = await within(confirm).findByRole("alert");
    expect(alert.textContent).toContain(copy);
    expect(alert.textContent).toContain(REQ);
    expect(api.tenantAdminSuggestErpnextItemMapping).toHaveBeenCalledTimes(1);
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect((screen.getByLabelText("ERPNext Item reference") as HTMLInputElement).value).toBe(
      "ITEM-X",
    );
  });
});

describe("when the surface is refused", () => {
  test("a 403 on the list offers no suggestion and reads no catalog", async () => {
    api.tenantAdminListErpnextItemMappings.mockResolvedValue(failure(403));
    renderPage();
    await within(itemsPanel()).findByRole("alert");
    expect(screen.queryByRole("button", { name: "Suggest a mapping" })).toBeNull();
    expect(consoleListCatalogProducts).not.toHaveBeenCalled();
  });
});

describe("with the replacement suggestion", () => {
  test("opening the picker replaces a replacement form; the retired-row flow still works", async () => {
    api.tenantAdminRetireErpnextItemMapping.mockResolvedValue(
      ok(mappingRow({ retired_at: "2026-10-19T09:00:00Z", version: 4 })),
    );
    renderPage();
    const row = await within(itemsPanel()).findByRole("row", { name: /ITEM-COLA-330/ });
    fireEvent.click(within(row).getByRole("button", { name: "Retire" }));
    const step = screen.getByRole("region", { name: "Retire item mapping" });
    fireEvent.click(within(step).getByRole("button", { name: "Retire" }));
    expect(await screen.findByRole("form", { name: "Suggest a replacement item" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Suggest a mapping" }));
    expect(screen.queryByRole("form", { name: "Suggest a replacement item" })).toBeNull();
    expect(await screen.findByRole("listbox", { name: "Active products" })).toBeDefined();
  });
});

describe("Arabic", () => {
  test("the picker flow renders in Arabic", async () => {
    setLocale("ar");
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "اقتراح ربط" }));
    const box = await screen.findByRole("listbox", { name: "الأصناف النشطة" });
    fireEvent.click(within(box).getAllByRole("option")[0]);
    expect(await screen.findByRole("form", { name: "اقتراح ربط صنف" })).toBeDefined();
  });
});
