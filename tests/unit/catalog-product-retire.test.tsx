import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { PRODUCT_1, ctx, detail, one, writeFailure } from "./catalog-fixtures";

const consoleGetCatalogProduct = vi.fn();
const consoleRetireCatalogProduct = vi.fn();
vi.mock("@/lib/catalog-queries", () => ({
  consoleGetCatalogProduct: (...a: unknown[]) => consoleGetCatalogProduct(...a),
  consoleRetireCatalogProduct: (...a: unknown[]) => consoleRetireCatalogProduct(...a),
  consoleUpdateCatalogProduct: vi.fn(),
  consoleListCatalogProducts: vi.fn(),
  consoleListCatalogCategories: vi.fn(),
}));
const listStores = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rf2-queries")>()),
  listStores: (...a: unknown[]) => listStores(...a),
}));
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { CatalogProductDetail } from "@/catalog/CatalogProductDetail";
import { createQueryClient } from "@/lib/query";

const LOADED_AT = "2026-10-07T10:30:00Z";
const RETIRED = detail({}, { status: "retired", updatedAt: "2026-10-08T09:00:00Z" });

function renderDetail(client = createQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/catalog/products/${PRODUCT_1}`]}>
        <Routes>
          <Route path="/catalog/products/:productId" element={<CatalogProductDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function loaded(): Promise<void> {
  await screen.findByRole("heading", { level: 1, name: "Mineral water 1.5L" });
}

const start = () => screen.getByRole("button", { name: "Retire item" });
const confirmButton = () => screen.getByRole("button", { name: "Yes, retire item" });

describe("product Edit and Retire controls (RT-768, CAT-C2a)", () => {
  beforeEach(() => {
    consoleGetCatalogProduct.mockReset();
    consoleRetireCatalogProduct.mockReset();
    listStores.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx());
    consoleGetCatalogProduct.mockResolvedValue(one(detail()));
    consoleRetireCatalogProduct.mockResolvedValue(one(RETIRED));
    listStores.mockResolvedValue({ status: 200, data: [] });
  });

  // --- Who sees what ------------------------------------------------------------------------

  test.each(["owner", "tenant_admin"])(
    "%s sees Edit and Retire on an active item",
    async (role) => {
      activeContext.mockReturnValue(ctx(role));
      renderDetail();
      await loaded();
      expect(screen.getByRole("link", { name: "Edit item" }).getAttribute("href")).toBe(
        `/catalog/products/${PRODUCT_1}/edit`,
      );
      expect(start()).toBeDefined();
    },
  );

  test("an inactive item can still be edited and retired", async () => {
    consoleGetCatalogProduct.mockResolvedValue(one(detail({}, { status: "inactive" })));
    renderDetail();
    await loaded();
    expect(screen.getByRole("link", { name: "Edit item" })).toBeDefined();
    expect(start()).toBeDefined();
  });

  test("store_manager sees the item read-only: no Edit, no Retire, no form", async () => {
    activeContext.mockReturnValue(ctx("store_manager"));
    renderDetail();
    await loaded();
    expect(screen.queryByRole("link", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /retire/i })).toBeNull();
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(document.querySelector("form, input, textarea, select")).toBeNull();
    expect(screen.getByText(/Read-only/)).toBeDefined();
  });

  test("a retired item is read-only for everyone, and says why", async () => {
    consoleGetCatalogProduct.mockResolvedValue(one(detail({}, { status: "retired" })));
    renderDetail();
    await loaded();
    expect(screen.queryByRole("link", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /retire/i })).toBeNull();
    expect(
      screen.getByText(
        "This item is retired, so it is read-only. Its identifiers stay bound to it.",
      ),
    ).toBeDefined();
  });

  test("loading the page writes nothing", async () => {
    renderDetail();
    await loaded();
    expect(consoleRetireCatalogProduct).not.toHaveBeenCalled();
  });

  // --- The confirmation ------------------------------------------------------------------------

  test("Retire asks first: it names the item, says it cannot be undone and that identifiers stay bound", async () => {
    renderDetail();
    await loaded();
    fireEvent.click(start());
    const region = screen.getByRole("region", { name: "Confirm: retire this item" });
    expect(within(region).getByText("Mineral water 1.5L")).toBeDefined();
    expect(within(region).getByText(/cannot be undone here/)).toBeDefined();
    expect(within(region).getByText(/barcodes and other identifiers stay bound/)).toBeDefined();
    expect(consoleRetireCatalogProduct).not.toHaveBeenCalled();
  });

  test("the safe choice has focus: Cancel", async () => {
    renderDetail();
    await loaded();
    fireEvent.click(start());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  test("Cancel closes the confirmation, returns focus to Retire, and writes nothing", async () => {
    renderDetail();
    await loaded();
    fireEvent.click(start());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("region", { name: "Confirm: retire this item" })).toBeNull();
    expect(document.activeElement).toBe(start());
    expect(consoleRetireCatalogProduct).not.toHaveBeenCalled();
  });

  // --- The write ----------------------------------------------------------------------------------

  test("confirming retires with the loaded updatedAt, then the item reads retired and read-only", async () => {
    renderDetail();
    await loaded();
    fireEvent.click(start());
    fireEvent.click(confirmButton());
    await waitFor(() => expect(consoleRetireCatalogProduct).toHaveBeenCalledTimes(1));
    expect(consoleRetireCatalogProduct).toHaveBeenCalledWith(PRODUCT_1, LOADED_AT);
    expect(
      await screen.findByText("Mineral water 1.5L is retired. It is read-only now."),
    ).toBeDefined();
    expect(screen.getAllByText("Retired").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /retire/i })).toBeNull();
  });

  test("a retire marks the item lists and the product picker stale for the tenant", async () => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    renderDetail(client);
    await loaded();
    fireEvent.click(start());
    fireEvent.click(confirmButton());
    await screen.findByText(/is retired/);
    const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(keys).toContain(JSON.stringify(["catalog", "products", "t1"]));
    expect(keys).toContain(JSON.stringify(["catalog", "picker", "t1"]));
  });

  test("a Reload that fails keeps the item and the retire section on screen, and says so", async () => {
    consoleRetireCatalogProduct.mockResolvedValue(writeFailure(409, "stale_write"));
    renderDetail();
    await loaded();
    fireEvent.click(start());
    fireEvent.click(confirmButton());
    await screen.findByText(/changed since you opened it/);
    consoleGetCatalogProduct.mockResolvedValue({
      status: 500,
      error: { error: { code: "x", message: "y", request_id: "r" } },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(await screen.findByText("Could not load this item.")).toBeDefined();
    expect(screen.getByRole("heading", { level: 1, name: "Mineral water 1.5L" })).toBeDefined();
    // The conflict banner and its Reload stay, so the reload can be retried.
    expect(screen.getByText(/changed since you opened it/)).toBeDefined();
    consoleGetCatalogProduct.mockResolvedValue(one(detail()));
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(await screen.findByText(/The latest version is loaded. Retire again/)).toBeDefined();
    expect(screen.queryByText("Could not load this item.")).toBeNull();
    expect(start()).toBeDefined();
  });

  test("the confirm button is disabled in flight: one request only", async () => {
    let finish: (v: unknown) => void = () => undefined;
    consoleRetireCatalogProduct.mockReturnValue(
      new Promise((r) => {
        finish = r;
      }),
    );
    renderDetail();
    await loaded();
    fireEvent.click(start());
    fireEvent.click(confirmButton());
    await waitFor(() => expect((confirmButton() as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(confirmButton());
    expect(consoleRetireCatalogProduct).toHaveBeenCalledTimes(1);
    finish(one(RETIRED));
    await screen.findByText(/is retired/);
  });

  // --- Every failure of the retire contract -------------------------------------------------------------

  test.each([
    [400, "validation_error", /The server rejected these values/],
    [401, "unauthorized", /Your session has expired/],
    [403, "origin_rejected", /did not come from this console/],
    [403, "forbidden", /do not have permission/],
    [404, "not_found", /no longer available to you/],
    [409, "something_else", /does not allow this change/],
    [429, "rate_limited", /Too many requests/],
    [500, "internal_error", /nothing was saved/],
  ] as const)(
    "%i %s: a banner with the request id, the item stays active",
    async (status, code, message) => {
      consoleRetireCatalogProduct.mockResolvedValue(writeFailure(status, code, "req-xyz"));
      renderDetail();
      await loaded();
      fireEvent.click(start());
      fireEvent.click(confirmButton());
      const alert = await screen.findByText(message);
      expect(alert.closest("[role='alert']")?.textContent).toContain("req-xyz");
      expect(screen.getByRole("link", { name: "Edit item" })).toBeDefined();
      expect(screen.queryByText(/is retired\. It is read-only now/)).toBeNull();
    },
  );

  test("a request that never completed is a banner too", async () => {
    consoleRetireCatalogProduct.mockRejectedValue(new TypeError("Failed to fetch"));
    renderDetail();
    await loaded();
    fireEvent.click(start());
    fireEvent.click(confirmButton());
    expect(await screen.findByText(/nothing was saved/)).toBeDefined();
  });

  test("409 stale_write: a conflict banner with Reload; Reload reads the item again", async () => {
    consoleRetireCatalogProduct.mockResolvedValue(writeFailure(409, "stale_write", "req-st"));
    renderDetail();
    await loaded();
    fireEvent.click(start());
    fireEvent.click(confirmButton());
    await screen.findByText(/changed since you opened it/);
    consoleGetCatalogProduct.mockResolvedValue(
      one(detail({}, { updatedAt: "2026-10-09T09:00:00Z", name: "Mineral water 1.5L" })),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(await screen.findByText(/The latest version is loaded. Retire again/)).toBeDefined();
    expect(consoleGetCatalogProduct).toHaveBeenCalledTimes(2);
    // The next retire carries the new precondition.
    fireEvent.click(start());
    fireEvent.click(confirmButton());
    await waitFor(() => expect(consoleRetireCatalogProduct).toHaveBeenCalledTimes(2));
    expect(consoleRetireCatalogProduct.mock.calls[1]).toEqual([PRODUCT_1, "2026-10-09T09:00:00Z"]);
  });

  test("409 product_retired: says it is already retired, and the page reads it again", async () => {
    consoleRetireCatalogProduct.mockResolvedValue(writeFailure(409, "product_retired"));
    renderDetail();
    await loaded();
    consoleGetCatalogProduct.mockResolvedValue(one(RETIRED));
    fireEvent.click(start());
    fireEvent.click(confirmButton());
    expect(await screen.findAllByText(/retired/i)).toBeDefined();
    await waitFor(() => expect(screen.queryByRole("button", { name: /retire/i })).toBeNull());
  });
});
