import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  CAIRO_STORE,
  CATEGORY_1,
  NEW_YORK_STORE,
  PRODUCT_1,
  ctx,
  detail,
  failure,
  identifier,
  one,
  override,
} from "./catalog-fixtures";

const consoleGetCatalogProduct = vi.fn();
vi.mock("@/lib/catalog-queries", () => ({
  consoleGetCatalogProduct: (...a: unknown[]) => consoleGetCatalogProduct(...a),
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

function renderDetail(productId = PRODUCT_1) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[`/catalog/products/${productId}`]}>
        <Routes>
          <Route path="/catalog/products/:productId" element={<CatalogProductDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Waits for the loaded page: the product name is its title. */
async function loaded(name = "Mineral water 1.5L"): Promise<void> {
  await screen.findByRole("heading", { level: 1, name });
}

function section(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

const UNAVAILABLE = "This item is not available to you.";

describe("CatalogProductDetail (RT-766, CAT-C1b)", () => {
  beforeEach(() => {
    consoleGetCatalogProduct.mockReset();
    listStores.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx());
    consoleGetCatalogProduct.mockResolvedValue(one(detail()));
    listStores.mockResolvedValue({ status: 200, data: [] });
  });

  // --- Gates: nothing is asked for what the API would refuse -------------------

  test("no active tenant: scope prompt and nothing is requested", async () => {
    activeContext.mockReturnValue(ctx("owner", null));
    renderDetail();
    expect(await screen.findByText("Select a tenant to view this item.")).toBeDefined();
    expect(consoleGetCatalogProduct).not.toHaveBeenCalled();
  });

  test("store_staff reads as not available, with no request", async () => {
    activeContext.mockReturnValue(ctx("store_staff"));
    renderDetail();
    expect(await screen.findByText(UNAVAILABLE)).toBeDefined();
    expect(consoleGetCatalogProduct).not.toHaveBeenCalled();
  });

  test("an id that is not a UUID reads as not available, with no request", async () => {
    renderDetail("new");
    expect(await screen.findByText(UNAVAILABLE)).toBeDefined();
    expect(consoleGetCatalogProduct).not.toHaveBeenCalled();
  });

  test("the product is read once, by the id in the URL", async () => {
    renderDetail();
    await loaded();
    expect(consoleGetCatalogProduct).toHaveBeenCalledTimes(1);
    expect(consoleGetCatalogProduct).toHaveBeenCalledWith(PRODUCT_1);
  });

  // --- Tenant values -------------------------------------------------------------

  test("tenant values come first: summary, description, category, tax, availability, tracking", async () => {
    renderDetail();
    await loaded();
    const tenant = section("Tenant values");
    expect(within(tenant).getByText("Active")).toBeDefined();
    expect(within(tenant).getByText("Still spring water, 1.5 litre bottle.")).toBeDefined();
    expect(within(tenant).getByText("Beverages")).toBeDefined();
    expect(within(tenant).getByText("standard")).toBeDefined();
    const availability = within(tenant).getByText("Tenant availability").nextElementSibling;
    expect(availability?.textContent).toBe("Available");
    expect(within(tenant).getByText("Tracking").nextElementSibling?.textContent).toBe("None");
    // Tenant values are the first section on the page, then identifiers, then overrides;
    // an owner (a writer, RT-768) then gets the Retire section last, away from the data.
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Tenant values",
      "Identifiers",
      "Store overrides",
      "Retire this item",
    ]);
  });

  test("a read-only role gets the three data sections and no Retire section", async () => {
    activeContext.mockReturnValue(ctx("store_manager"));
    renderDetail();
    await loaded();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Tenant values",
      "Identifiers",
      "Store overrides",
    ]);
  });

  test("an inactive product says it is not available; a retired one says retired", async () => {
    consoleGetCatalogProduct.mockResolvedValue(one(detail({}, { status: "inactive" })));
    const first = renderDetail();
    await loaded();
    expect(within(section("Tenant values")).getByText("Inactive")).toBeDefined();
    expect(
      within(section("Tenant values")).getByText("Tenant availability").nextElementSibling
        ?.textContent,
    ).toBe("Not available");
    first.unmount();
    consoleGetCatalogProduct.mockResolvedValue(one(detail({}, { status: "retired" })));
    renderDetail();
    await loaded();
    expect(within(section("Tenant values")).getByText("Retired")).toBeDefined();
  });

  test("no description and no category say so; the item name keeps its own direction", async () => {
    consoleGetCatalogProduct.mockResolvedValue(
      one(
        detail({ description: null }, { categoryId: null, categoryName: null, name: "شاي ليبتون" }),
      ),
    );
    renderDetail();
    await loaded("شاي ليبتون");
    const tenant = section("Tenant values");
    expect(within(tenant).getByText("No description")).toBeDefined();
    expect(within(tenant).getByText("No category")).toBeDefined();
    const title = screen.getByRole("heading", { level: 1 });
    expect(title.querySelector("bdi")?.getAttribute("dir")).toBe("auto");
  });

  test("a tax category is machine text: isolated LTR", async () => {
    consoleGetCatalogProduct.mockResolvedValue(one(detail({}, { taxCategory: "VAT-14" })));
    renderDetail();
    await loaded();
    const value = within(section("Tenant values")).getByText("VAT-14");
    expect(value.getAttribute("dir")).toBe("ltr");
  });

  // --- Price: read-only text, never rounded -----------------------------------------

  test("the price is plain text, not an input, and is never rounded", async () => {
    consoleGetCatalogProduct.mockResolvedValue(
      one(detail({}, { defaultPrice: { amount: "10.5050", currencyCode: "EGP" } })),
    );
    renderDetail();
    await loaded();
    const tenant = section("Tenant values");
    const price = within(tenant).getByText("Price").nextElementSibling as HTMLElement;
    // `formatMoney` keeps every significant fraction digit: 10.5050 is 10.505, not 10.51.
    expect(price.textContent).toBe("10.505 EGP");
    expect(price.querySelector("input, textarea, select")).toBeNull();
    expect(screen.queryAllByRole("textbox")).toEqual([]);
    expect(screen.queryByText(/will not sell/i)).toBeNull();
  });

  test("a product with no price says the POS will not sell it", async () => {
    consoleGetCatalogProduct.mockResolvedValue(one(detail({}, { defaultPrice: null })));
    renderDetail();
    await loaded();
    const price = within(section("Tenant values")).getByText("Price").nextElementSibling;
    expect(price?.textContent).toBe(
      "No price: the POS will not sell this item until a price is set.",
    );
  });

  test("a store price override does not soften the tenant's missing price", async () => {
    consoleGetCatalogProduct.mockResolvedValue(
      one(
        detail(
          { storeOverrides: [override({ price: { amount: "9.0000", currencyCode: "EGP" } })] },
          { defaultPrice: null },
        ),
      ),
    );
    renderDetail();
    await loaded();
    const price = within(section("Tenant values")).getByText("Price").nextElementSibling;
    expect(price?.textContent).toContain("will not sell");
  });

  // --- Identifiers -------------------------------------------------------------------

  test("identifiers are shown byte for byte, LTR, with type and scope", async () => {
    listStores.mockResolvedValue({
      status: 200,
      data: [{ id: CAIRO_STORE, code: "CAI", name: "Cairo Festival" }],
    });
    consoleGetCatalogProduct.mockResolvedValue(
      one(
        detail({
          identifiers: [
            identifier({ value: "0012345678905" }),
            identifier({ identifierType: "sku", value: "SKU  0042" }),
            identifier({ identifierType: "plu", value: "007", storeId: CAIRO_STORE }),
            identifier({
              identifierType: "external_pos_id",
              value: "EXT-9",
              sourceSystem: "legacy-pos",
            }),
          ],
        }),
      ),
    );
    renderDetail();
    await loaded();
    const ids = section("Identifiers");
    const rows = within(ids).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);
    const [barcode, sku, plu, external] = rows.map((r) => within(r).getAllByRole("cell"));
    expect(barcode[0].textContent).toBe("Barcode");
    expect(barcode[1].textContent).toBe("0012345678905");
    expect(barcode[1].querySelector("bdi")?.getAttribute("dir")).toBe("ltr");
    // Inner spaces are not collapsed or trimmed.
    expect(sku[1].textContent).toBe("SKU  0042");
    expect(sku[1].querySelector("bdi")?.classList.contains("catalog-code")).toBe(true);
    expect(barcode[2].textContent).toBe("All stores");
    expect(plu[1].textContent).toBe("007");
    await waitFor(() => expect(plu[2].textContent).toBe("Cairo Festival"));
    expect(external[3].textContent).toBe("legacy-pos");
    expect(barcode[3].textContent).toBe("—");
  });

  test("no identifiers says so", async () => {
    consoleGetCatalogProduct.mockResolvedValue(one(detail({ identifiers: [] })));
    renderDetail();
    await loaded();
    const ids = section("Identifiers");
    expect(within(ids).getByText("This item has no active identifiers.")).toBeDefined();
    expect(within(ids).queryByRole("table")).toBeNull();
  });

  // --- Store overrides: raw deviations, never resolved ------------------------------

  test("two stores with overrides: each deviation is next to the tenant value, labelled", async () => {
    activeContext.mockReturnValue(ctx("owner", "t1", CAIRO_STORE));
    listStores.mockResolvedValue({
      status: 200,
      data: [
        { id: CAIRO_STORE, code: "CAI", name: "Cairo Festival" },
        { id: NEW_YORK_STORE, code: "NYC", name: "New York Flagship" },
      ],
    });
    consoleGetCatalogProduct.mockResolvedValue(
      one(
        detail({
          storeOverrides: [
            override({
              storeId: CAIRO_STORE,
              isActive: false,
              price: { amount: "12.0000", currencyCode: "EGP" },
            }),
            override({ storeId: NEW_YORK_STORE, taxCategory: "reduced" }),
          ],
        }),
      ),
    );
    renderDetail();
    await loaded();
    const overrides = section("Store overrides");
    const cairo = within(overrides).getByRole("table", {
      name: "Store override for Cairo Festival",
    });
    // The other store's name arrives with the store list.
    const newYork = await within(overrides).findByRole("table", {
      name: "Store override for New York Flagship",
    });
    const header = within(cairo)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(header).toEqual(["Setting", "Store value", "Tenant value"]);

    const cairoRows = within(cairo)
      .getAllByRole("row")
      .slice(1)
      .map((r) =>
        within(r)
          .getAllByRole("cell")
          .map((c) => c.textContent),
      );
    expect(cairoRows).toEqual([
      ["Availability", "Not available", "Available"],
      ["Price", "12.00 EGP", "10.50 EGP"],
    ]);
    const newYorkRows = within(newYork)
      .getAllByRole("row")
      .slice(1)
      .map((r) =>
        within(r)
          .getAllByRole("cell")
          .map((c) => c.textContent),
      );
    // Only the deviation the store has: availability and price are not overridden here.
    expect(newYorkRows).toEqual([["Tax category", "reduced", "standard"]]);
  });

  test("the page never presents an effective or resolved value", async () => {
    consoleGetCatalogProduct.mockResolvedValue(
      one(detail({ storeOverrides: [override({ isActive: false })] })),
    );
    renderDetail();
    await loaded();
    expect(screen.queryByText(/effective/i)).toBeNull();
    // The section says where the resolved view lives instead of computing it.
    expect(within(section("Store overrides")).getByText(/resolved by the server/i)).toBeDefined();
  });

  test("an override with no values of its own says it differs from the tenant in nothing", async () => {
    consoleGetCatalogProduct.mockResolvedValue(one(detail({ storeOverrides: [override()] })));
    renderDetail();
    await loaded();
    const overrides = section("Store overrides");
    expect(within(overrides).getByText("This override sets no value of its own.")).toBeDefined();
    expect(within(overrides).queryByRole("table")).toBeNull();
  });

  test("no overrides in scope says so", async () => {
    renderDetail();
    await loaded();
    expect(
      within(section("Store overrides")).getByText(
        "No store in your scope has its own values for this item.",
      ),
    ).toBeDefined();
  });

  test("a store whose name is unknown shows its id, and a failing store list does not fail the page", async () => {
    listStores.mockResolvedValue({ status: 500, error: {} });
    consoleGetCatalogProduct.mockResolvedValue(
      one(detail({ storeOverrides: [override({ storeId: NEW_YORK_STORE, isActive: true })] })),
    );
    renderDetail();
    await loaded();
    const table = await within(section("Store overrides")).findByRole("table", {
      name: `Store override for ${NEW_YORK_STORE}`,
    });
    expect(table).toBeDefined();
    expect(within(section("Tenant values")).getByText("Beverages")).toBeDefined();
  });

  test("a store list that is not a list (empty body) falls back to ids", async () => {
    listStores.mockResolvedValue({ status: 200, data: {} });
    consoleGetCatalogProduct.mockResolvedValue(
      one(detail({ storeOverrides: [override({ isActive: true })] })),
    );
    renderDetail();
    await loaded();
    expect(
      await within(section("Store overrides")).findByRole("table", {
        name: `Store override for ${CAIRO_STORE}`,
      }),
    ).toBeDefined();
  });

  test("the active store's name comes from the scope, without the store list", async () => {
    activeContext.mockReturnValue(ctx("store_manager", "t1", CAIRO_STORE));
    listStores.mockResolvedValue({ status: 200, data: [] });
    consoleGetCatalogProduct.mockResolvedValue(
      one(detail({ storeOverrides: [override({ isActive: false })] })),
    );
    renderDetail();
    await loaded();
    expect(
      within(section("Store overrides")).getByRole("table", {
        name: "Store override for Cairo Festival",
      }),
    ).toBeDefined();
  });

  // --- Cross-links, and what the page does not have ----------------------------------------

  test("with a store in scope, a link goes to its on-hand stock", async () => {
    activeContext.mockReturnValue(ctx("owner", "t1", CAIRO_STORE));
    renderDetail();
    await loaded();
    const link = screen.getByRole("link", { name: "View on-hand stock in Cairo Festival" });
    expect(link.getAttribute("href")).toBe(
      `/inventory/stores/${CAIRO_STORE}/products/${PRODUCT_1}`,
    );
  });

  test("with All stores there is no inventory link", async () => {
    renderDetail();
    await loaded();
    expect(screen.queryByRole("link", { name: /on-hand/i })).toBeNull();
  });

  test("the back link returns to the item list", async () => {
    renderDetail();
    await loaded();
    expect(screen.getByRole("link", { name: "Back to items" }).getAttribute("href")).toBe(
      "/catalog/products",
    );
  });

  // RT-766 asserted a page with no control at all. RT-768 gives owner and tenant_admin an Edit
  // link and a Retire action, so the "no control" guarantee now belongs to the roles and states
  // that stay read-only (store_manager; a retired item, covered in catalog-product-retire).
  test("read-only role: no form, no field and no action button on a loaded page", async () => {
    activeContext.mockReturnValue(ctx("store_manager", "t1", CAIRO_STORE));
    consoleGetCatalogProduct.mockResolvedValue(
      one(detail({ storeOverrides: [override({ isActive: false })] })),
    );
    renderDetail();
    await loaded();
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.queryAllByRole("textbox")).toEqual([]);
    expect(screen.queryAllByRole("checkbox")).toEqual([]);
    expect(screen.queryAllByRole("combobox")).toEqual([]);
    expect(document.querySelector("form, input, textarea, select")).toBeNull();
    expect(screen.queryByRole("link", { name: /edit|retire|add/i })).toBeNull();
  });

  test("no ERP data on the page: nothing mentions ERPNext or an ERP mapping", async () => {
    renderDetail();
    await loaded();
    expect(document.body.textContent).not.toMatch(/erp|frappe/i);
  });

  // --- States -------------------------------------------------------------------------

  test("loading is announced while the product is read", async () => {
    consoleGetCatalogProduct.mockReturnValue(new Promise(() => {}));
    renderDetail();
    expect(await screen.findByText(/loading item/i)).toBeDefined();
  });

  test.each([404, 400])(
    "a %i reads as the one non-disclosing not-available state",
    async (status) => {
      consoleGetCatalogProduct.mockResolvedValue(failure(status, "req-404"));
      renderDetail();
      expect(await screen.findByText(UNAVAILABLE)).toBeDefined();
      // Non-disclosing: it never says why, and it names no request to quote.
      expect(screen.queryByText(/req-404/)).toBeNull();
      expect(screen.getByRole("link", { name: "Back to items" })).toBeDefined();
    },
  );

  test("a 401 says the session ended and offers no retry", async () => {
    consoleGetCatalogProduct.mockResolvedValue(failure(401, "req-401"));
    renderDetail();
    expect(await screen.findByText("Your session has expired. Sign in again.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  test("a 500 is a banner with the request id, and Retry reads again", async () => {
    consoleGetCatalogProduct.mockResolvedValueOnce(failure(500, "req-500"));
    renderDetail();
    expect(await screen.findByText("Could not load this item.")).toBeDefined();
    expect(screen.getByText("req-500")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await loaded();
    expect(consoleGetCatalogProduct).toHaveBeenCalledTimes(2);
  });

  test("a 429 is its own message with a gated Retry", async () => {
    consoleGetCatalogProduct.mockResolvedValueOnce(failure(429, "req-429"));
    renderDetail();
    expect(
      await screen.findByText("Too many requests. Wait a moment, then try again."),
    ).toBeDefined();
    expect(screen.getByText("req-429")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await loaded();
  });

  test("a product without identifier or override lists reads as empty sections, not as a failure", async () => {
    consoleGetCatalogProduct.mockResolvedValue(
      one({ ...detail(), identifiers: undefined, storeOverrides: undefined }),
    );
    renderDetail();
    await loaded();
    expect(within(section("Identifiers")).getByText(/no active identifiers/i)).toBeDefined();
    expect(within(section("Store overrides")).getByText(/no store in your scope/i)).toBeDefined();
  });

  test("the category id is not shown as copy", async () => {
    renderDetail();
    await loaded();
    expect(document.body.textContent).not.toContain(CATEGORY_1);
  });
});
