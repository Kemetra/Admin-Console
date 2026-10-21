import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  CAIRO_STORE,
  CATEGORY_1,
  NEW_YORK_STORE,
  PRODUCT_1,
  PRODUCT_2,
  PRODUCT_3,
  categories,
  ctx,
  failure,
  page,
  product,
  storeView,
} from "./catalog-fixtures";

const consoleListCatalogProducts = vi.fn();
const consoleListCatalogCategories = vi.fn();
vi.mock("@/lib/catalog-queries", () => ({
  consoleListCatalogProducts: (...a: unknown[]) => consoleListCatalogProducts(...a),
  consoleListCatalogCategories: (...a: unknown[]) => consoleListCatalogCategories(...a),
}));
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { CatalogProductList } from "@/catalog/CatalogProductList";
import { createQueryClient } from "@/lib/query";

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

/** The shell keys the routed surface by scope (ProtectedArea, RT-268): a scope change remounts it. */
function ScopeKeyed(): React.JSX.Element {
  const context = activeContext().context;
  const key = `${context?.active_tenant?.id}/${context?.active_store?.id ?? "all"}`;
  return <CatalogProductList key={key} />;
}

function tree(entry: string, client = createQueryClient()): React.JSX.Element {
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/catalog/products" element={<ScopeKeyed />} />
          <Route path="/catalog/products/:productId" element={<p>detail</p>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderList(entry = "/catalog/products") {
  return render(tree(entry));
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

/** The count's number is isolated in a <bdi>, so match the status message's whole text. */
function loadedCount(count: number): HTMLElement {
  return screen.getByText(
    (_, el) => el?.tagName === "OUTPUT" && el.textContent === `Loaded items: ${count}`,
  );
}

describe("CatalogProductList (RT-765, CAT-C1a)", () => {
  beforeEach(() => {
    consoleListCatalogProducts.mockReset();
    consoleListCatalogCategories.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx());
    consoleListCatalogCategories.mockResolvedValue(categories);
    consoleListCatalogProducts.mockResolvedValue(page([product()]));
  });

  test("no active tenant: scope prompt and nothing is requested", async () => {
    activeContext.mockReturnValue(ctx("owner", null));
    renderList();
    expect(await screen.findByText(/select a tenant to view items/i)).toBeDefined();
    expect(consoleListCatalogProducts).not.toHaveBeenCalled();
    expect(consoleListCatalogCategories).not.toHaveBeenCalled();
  });

  test("store_staff sees the unavailable state, with no form and no read", async () => {
    activeContext.mockReturnValue(ctx("store_staff"));
    renderList();
    expect(await screen.findByText("These items are not available to you.")).toBeDefined();
    expect(screen.queryByRole("form")).toBeNull();
    expect(consoleListCatalogProducts).not.toHaveBeenCalled();
    expect(consoleListCatalogCategories).not.toHaveBeenCalled();
  });

  test("the first page is requested with the default status and the page size, nothing else", async () => {
    renderList();
    await tableReady();
    expect(consoleListCatalogProducts).toHaveBeenCalledTimes(1);
    expect(consoleListCatalogProducts.mock.calls[0][0]).toEqual({ status: "active", limit: 50 });
  });

  test("tenant scope (All stores): tenant price, no availability column", async () => {
    renderList();
    const table = await tableReady();
    expect(within(table).queryByText("Store availability")).toBeNull();
    const [, row] = within(table).getAllByRole("row");
    expect(within(row).getByText("10.50 EGP")).toBeDefined();
  });

  test("rows render server values: identifiers isolated, missing values labelled, never rounded", async () => {
    consoleListCatalogProducts.mockResolvedValue(
      page([
        product(),
        product({
          productId: PRODUCT_2,
          name: "Loose tea",
          status: "retired",
          categoryId: null,
          categoryName: null,
          primarySku: null,
          primaryBarcode: null,
          defaultPrice: null,
          taxCategory: "reduced",
          trackingMode: "batch",
        }),
        product({
          productId: PRODUCT_3,
          name: "Salt",
          status: "inactive",
          defaultPrice: { amount: "10.1250", currencyCode: "EGP" },
        }),
      ]),
    );
    renderList();
    const table = await tableReady();
    const [, first, second, third] = within(table).getAllByRole("row");
    expect(within(first).getByText("Mineral water 1.5L")).toBeDefined();
    expect(within(first).getByText("Active")).toBeDefined();
    expect(within(first).getByText("Beverages")).toBeDefined();
    expect(within(first).getByText("SKU-0042").closest("bdi")?.getAttribute("dir")).toBe("ltr");
    expect(within(first).getByText("0012345678905").closest("bdi")?.getAttribute("dir")).toBe(
      "ltr",
    );
    expect(within(first).getByText("standard")).toBeDefined();
    expect(within(first).getByText("None")).toBeDefined();
    expect(within(first).getByRole("time").getAttribute("dateTime")).toBe("2026-10-07T10:30:00Z");

    expect(within(second).getByText("Retired")).toBeDefined();
    expect(within(second).getByText("No price")).toBeDefined();
    expect(within(second).getByText("No category")).toBeDefined();
    expect(within(second).getByText("By batch")).toBeDefined();

    expect(within(third).getByText("Inactive")).toBeDefined();
    expect(within(third).getByText("10.125 EGP")).toBeDefined();
  });

  test("the caption states the server order", async () => {
    renderList();
    const table = await tableReady();
    expect(within(table).getByText("Items, by name from A to Z")).toBeDefined();
  });

  describe("store in scope", () => {
    beforeEach(() => {
      activeContext.mockReturnValue(ctx("store_manager", "t1", CAIRO_STORE));
    });

    test("store_id is sent and the columns show the server-resolved store values", async () => {
      consoleListCatalogProducts.mockResolvedValue(
        page([
          product({ storeView: storeView({ hasOverride: true }) }),
          product({
            productId: PRODUCT_2,
            name: "Loose tea",
            defaultPrice: null,
            storeView: storeView({ effectivePrice: null, effectiveActive: false }),
          }),
        ]),
      );
      renderList();
      const table = await tableReady();
      expect(consoleListCatalogProducts.mock.calls[0][0]).toEqual({
        status: "active",
        limit: 50,
        store_id: CAIRO_STORE,
      });
      expect(within(table).getByText("Store availability")).toBeDefined();
      const [, first, second] = within(table).getAllByRole("row");
      // The store's effective price (12.00), not the tenant default (10.50).
      expect(within(first).getByText("12.00 EGP")).toBeDefined();
      expect(within(first).queryByText("10.50 EGP")).toBeNull();
      expect(within(first).getByText("Available")).toBeDefined();
      expect(within(first).getByText("Store-specific")).toBeDefined();
      expect(within(second).getByText("Not available")).toBeDefined();
      expect(within(second).getByText("No price")).toBeDefined();
      expect(within(second).queryByText("Store-specific")).toBeNull();
    });

    test("a row without its storeView shows no price, never the tenant's", async () => {
      consoleListCatalogProducts.mockResolvedValue(page([product()]));
      renderList();
      const table = await tableReady();
      const [, row] = within(table).getAllByRole("row");
      expect(within(row).queryByText("10.50 EGP")).toBeNull();
      expect(within(row).getAllByRole("cell")[2].textContent).toBe("—");
    });

    test("a store change restarts the walk from the first page", async () => {
      consoleListCatalogProducts
        .mockResolvedValueOnce(page([product({ storeView: storeView() })], "c1"))
        .mockResolvedValueOnce(page([product({ productId: PRODUCT_2, name: "Loose tea" })]));
      const client = createQueryClient();
      const view = render(tree("/catalog/products", client));
      await tableReady();
      activeContext.mockReturnValue(ctx("store_manager", "t1", NEW_YORK_STORE));
      view.rerender(tree("/catalog/products", client));
      expect(await screen.findByText("Loose tea")).toBeDefined();
      expect(consoleListCatalogProducts).toHaveBeenCalledTimes(2);
      expect(consoleListCatalogProducts.mock.calls[1][0]).toMatchObject({
        store_id: NEW_YORK_STORE,
        cursor: undefined,
      });
      expect(screen.queryByText("Mineral water 1.5L")).toBeNull();
    });

    test("a 404 with a store in scope is the scope-stale message, never 'no items'", async () => {
      consoleListCatalogProducts.mockResolvedValue(failure(404));
      renderList();
      expect(await screen.findByText("The selected store is no longer available.")).toBeDefined();
      expect(screen.queryByText(/there are no active items/i)).toBeNull();
      expect(screen.queryByText("These items are not available to you.")).toBeNull();
    });
  });

  describe("filters", () => {
    test("the search text is sent verbatim: no trim, leading zeros and spaces kept", async () => {
      renderList();
      await tableReady();
      fireEvent.change(screen.getByLabelText("Name or code"), { target: { value: " 0012 " } });
      fireEvent.click(screen.getByRole("button", { name: "Search" }));
      await waitFor(() => expect(consoleListCatalogProducts).toHaveBeenCalledTimes(2));
      expect(consoleListCatalogProducts.mock.calls[1][0]).toEqual({
        q: " 0012 ",
        status: "active",
        limit: 50,
      });
      expect(location()).toBe("/catalog/products?q=+0012+");
    });

    test("nothing is requested until Search applies the form (explicit submit)", async () => {
      renderList();
      await tableReady();
      fireEvent.change(screen.getByLabelText("Name or code"), { target: { value: "milk" } });
      expect(consoleListCatalogProducts).toHaveBeenCalledTimes(1);
    });

    test("status and category are applied to the URL and the request", async () => {
      renderList();
      await tableReady();
      const category = (await screen.findByLabelText("Category")) as HTMLSelectElement;
      await waitFor(() => expect(within(category).getByText("Beverages")).toBeDefined());
      fireEvent.change(screen.getByLabelText("Status"), { target: { value: "any" } });
      fireEvent.change(category, { target: { value: CATEGORY_1 } });
      fireEvent.click(screen.getByRole("button", { name: "Search" }));
      await waitFor(() => expect(consoleListCatalogProducts).toHaveBeenCalledTimes(2));
      expect(consoleListCatalogProducts.mock.calls[1][0]).toEqual({
        status: "any",
        category_id: CATEGORY_1,
        limit: 50,
      });
      expect(location()).toBe(`/catalog/products?status=any&category=${CATEGORY_1}`);
    });

    test("a deep link reads its filters", async () => {
      renderList(`/catalog/products?q=salt&status=inactive&category=${CATEGORY_1}`);
      await tableReady();
      expect(consoleListCatalogProducts.mock.calls[0][0]).toEqual({
        q: "salt",
        status: "inactive",
        category_id: CATEGORY_1,
        limit: 50,
      });
      expect((screen.getByLabelText("Name or code") as HTMLInputElement).value).toBe("salt");
      expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("inactive");
    });

    test("a search text over 100 characters is refused before any request", async () => {
      renderList(`/catalog/products?q=${"x".repeat(101)}`);
      expect(await screen.findByText("Search text can be at most 100 characters.")).toBeDefined();
      expect(consoleListCatalogProducts).not.toHaveBeenCalled();
    });

    test("a malformed category in the link is refused before any request", async () => {
      renderList("/catalog/products?category=nope");
      expect(await screen.findByText("The category in the link is not valid.")).toBeDefined();
      expect(consoleListCatalogProducts).not.toHaveBeenCalled();
    });

    test("a new filter restarts the walk without a cursor and drops the old rows", async () => {
      consoleListCatalogProducts
        .mockResolvedValueOnce(page([product()], "c1"))
        .mockResolvedValueOnce(page([product({ productId: PRODUCT_3, name: "Salt" })]));
      renderList();
      await tableReady();
      fireEvent.change(screen.getByLabelText("Status"), { target: { value: "retired" } });
      fireEvent.click(screen.getByRole("button", { name: "Search" }));
      expect(await screen.findByText("Salt")).toBeDefined();
      expect(consoleListCatalogProducts.mock.calls[1][0]).toMatchObject({
        status: "retired",
        cursor: undefined,
      });
      expect(screen.queryByText("Mineral water 1.5L")).toBeNull();
    });

    test("a tenant change resets every filter", async () => {
      activeContext.mockReturnValue(ctx("owner", "t1"));
      const client = createQueryClient();
      const view = render(
        tree(`/catalog/products?q=salt&status=inactive&category=${CATEGORY_1}`, client),
      );
      await tableReady();
      const before = consoleListCatalogProducts.mock.calls.length;
      activeContext.mockReturnValue(ctx("owner", "t2"));
      view.rerender(
        tree(`/catalog/products?q=salt&status=inactive&category=${CATEGORY_1}`, client),
      );
      await waitFor(() => expect(location()).toBe("/catalog/products"));
      await waitFor(() =>
        expect(consoleListCatalogProducts.mock.calls.at(-1)?.[0]).toEqual({
          status: "active",
          limit: 50,
        }),
      );
      expect((screen.getByLabelText("Name or code") as HTMLInputElement).value).toBe("");
      // The new tenant is never asked with the old tenant's filters, not even once.
      for (const [query] of consoleListCatalogProducts.mock.calls.slice(before)) {
        expect(query).not.toHaveProperty("category_id");
        expect(query).not.toHaveProperty("q");
      }
    });

    test("an uppercase category id in the link is sent lower case and selected in the form", async () => {
      renderList(`/catalog/products?category=${CATEGORY_1.toUpperCase()}`);
      await tableReady();
      expect(consoleListCatalogProducts.mock.calls[0][0]).toMatchObject({
        category_id: CATEGORY_1,
      });
      await waitFor(() =>
        expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe(CATEGORY_1),
      );
      expect(
        (screen.getByLabelText("Category") as HTMLSelectElement).selectedOptions[0].textContent,
      ).toBe("Beverages");
    });

    test("a server category id in upper case still names and selects the applied category", async () => {
      consoleListCatalogCategories.mockResolvedValue({
        status: 200,
        data: {
          items: [
            {
              categoryId: CATEGORY_1.toUpperCase(),
              name: "Beverages",
              description: null,
              updatedAt: "2026-10-01T08:00:00Z",
            },
          ],
        },
      });
      consoleListCatalogProducts.mockResolvedValue(page([], null));
      renderList(`/catalog/products?category=${CATEGORY_1}`);
      const notice = await screen.findByText(/no items match/i);
      await waitFor(() => expect(notice.textContent).toContain("Beverages"));
      expect(notice.textContent).not.toContain("Unavailable category");
      const select = screen.getByLabelText("Category") as HTMLSelectElement;
      expect(select.selectedOptions[0].textContent).toBe("Beverages");
    });

    test("an applied category is not called unavailable while the list is unknown", async () => {
      consoleListCatalogCategories.mockResolvedValue(failure(500));
      consoleListCatalogProducts.mockResolvedValue(page([], null));
      renderList(`/catalog/products?category=${CATEGORY_1}`);
      const notice = await screen.findByText(/no items match/i);
      expect(notice.textContent).toContain("Selected category");
      expect(notice.textContent).not.toContain("Unavailable category");
      const select = screen.getByLabelText("Category") as HTMLSelectElement;
      expect(select.selectedOptions[0].textContent).toBe("Selected category");
    });

    test("the category list failing leaves the list usable, with a note", async () => {
      consoleListCatalogCategories.mockResolvedValue(failure(500));
      renderList();
      await tableReady();
      expect(await screen.findByText("Categories could not be loaded.")).toBeDefined();
      expect(screen.getByText("Mineral water 1.5L")).toBeDefined();
    });

    test("a category list without items (empty body) is an empty set, not a crash", async () => {
      consoleListCatalogCategories.mockResolvedValue({ status: 200, data: {} });
      renderList();
      await tableReady();
      const category = screen.getByLabelText("Category") as HTMLSelectElement;
      expect(within(category).getAllByRole("option")).toHaveLength(1);
    });
  });

  describe("empty states", () => {
    test("no filters and an empty walk: the dataset is empty, with no create control", async () => {
      consoleListCatalogProducts.mockResolvedValue(page([], null));
      renderList();
      expect(await screen.findByText("There are no active items yet.")).toBeDefined();
      expect(screen.queryByRole("link", { name: /add/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /add/i })).toBeNull();
      expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
    });

    test("a filtered empty walk names the filters and offers to clear them", async () => {
      consoleListCatalogProducts.mockResolvedValue(page([], null));
      renderList("/catalog/products?q=zzz&status=retired");
      const notice = await screen.findByText(/no items match/i);
      expect(notice.textContent).toContain("zzz");
      // The typed text is isolated from the sentence around it (bidi).
      expect(notice.querySelector("bdi")?.textContent).toBe("zzz");
      expect(notice.textContent).toContain("Retired");
      expect(notice.closest("output")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
      await waitFor(() => expect(location()).toBe("/catalog/products"));
    });

    test("an empty page with a cursor is not 'no items': Load more walks on", async () => {
      consoleListCatalogProducts
        .mockResolvedValueOnce(page([], "c1"))
        .mockResolvedValueOnce(page([product()], null));
      renderList();
      const more = await screen.findByRole("button", { name: "Load more" });
      expect(screen.queryByText(/there are no active items/i)).toBeNull();
      expect(screen.getByText(/no matching items in the part checked so far/i)).toBeDefined();
      fireEvent.click(more);
      expect(await screen.findByText("Mineral water 1.5L")).toBeDefined();
      expect(consoleListCatalogProducts.mock.calls[1][0]).toMatchObject({ cursor: "c1" });
    });

    test("a response with no items field is read as an empty walk", async () => {
      consoleListCatalogProducts.mockResolvedValue({ status: 200, data: {} });
      renderList();
      expect(await screen.findByText("There are no active items yet.")).toBeDefined();
    });
  });

  describe("errors", () => {
    /** The loaded first page has a cursor; Load more asks for the next one. */
    async function loadMoreFailing(failingPage: unknown, storeId?: string): Promise<void> {
      if (storeId) activeContext.mockReturnValue(ctx("owner", "t1", storeId));
      consoleListCatalogProducts
        .mockResolvedValueOnce(page([product({ storeView: storeView() })], "c1"))
        .mockResolvedValueOnce(failingPage);
      renderList();
      await tableReady();
      fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    }

    const retry = () => screen.queryByRole("button", { name: "Retry" });

    test.each([
      [
        "404 is the one non-disclosing state",
        failure(404),
        "These items are not available to you.",
        false,
      ],
      ["400 is a validation message", failure(400), /the server rejected this search/i, false],
      [
        "401 says the session expired",
        failure(401),
        "Your session has expired. Sign in again.",
        false,
      ],
      ["500 is a retryable banner", failure(500), "Could not load items.", true],
      // The shell's RateLimitBanner owns the countdown; the surface only offers a Retry.
      ["429 is the generic retryable error", failure(429), "Could not load items.", true],
    ] as const)("a first-page %s", async (_name, response, text, retryable) => {
      consoleListCatalogProducts.mockResolvedValue(response);
      renderList();
      expect(await screen.findByText(text)).toBeDefined();
      expect(retry() !== null).toBe(retryable);
      // A failure is never an empty list.
      expect(screen.queryByText(/there are no active items/i)).toBeNull();
      expect(screen.queryByText(/too many requests/i)).toBeNull();
    });

    test("a first-page failure carries the request id, and Retry re-reads", async () => {
      consoleListCatalogProducts
        .mockResolvedValueOnce(failure(500, "req-500"))
        .mockResolvedValueOnce(page([product()]));
      renderList();
      expect(await screen.findByText("Could not load items.")).toBeDefined();
      expect(screen.getByText("req-500")).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(await screen.findByText("Mineral water 1.5L")).toBeDefined();
    });

    test.each([
      [
        "404 with a store: the store is stale",
        failure(404),
        CAIRO_STORE,
        "The selected store is no longer available.",
      ],
      [
        "404 without a store: unavailable",
        failure(404),
        undefined,
        "These items are not available to you.",
      ],
      [
        "401: the session expired",
        failure(401),
        undefined,
        "Your session has expired. Sign in again.",
      ],
    ] as const)(
      "a continuation %s, with no Retry and the rows kept",
      async (_name, response, storeId, text) => {
        await loadMoreFailing(response, storeId);
        expect(await screen.findByText(text)).toBeDefined();
        expect(retry()).toBeNull();
        expect(screen.getByText("Mineral water 1.5L")).toBeDefined();
      },
    );

    test("a failed continuation keeps the loaded rows and retries the next page", async () => {
      await loadMoreFailing(failure(500));
      consoleListCatalogProducts.mockResolvedValueOnce(
        page([product({ productId: PRODUCT_2, name: "Loose tea" })], null),
      );
      expect(await screen.findByText(/the rest of the rows could not be loaded/i)).toBeDefined();
      expect(screen.getByText("Mineral water 1.5L")).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(await screen.findByText("Loose tea")).toBeDefined();
      expect(consoleListCatalogProducts.mock.calls[2][0]).toMatchObject({ cursor: "c1" });
    });

    test("a 400 on a continuation restarts the walk from the first page", async () => {
      await loadMoreFailing(failure(400));
      consoleListCatalogProducts.mockResolvedValueOnce(
        page([product({ productId: PRODUCT_2, name: "Loose tea" })], null),
      );
      expect(
        await screen.findByText(/did not accept the position of the next page/i),
      ).toBeDefined();
      expect(retry()).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Start again" }));
      expect(await screen.findByText("Loose tea")).toBeDefined();
      expect(consoleListCatalogProducts.mock.calls[2][0]).toMatchObject({ cursor: undefined });
      expect(screen.queryByText("Mineral water 1.5L")).toBeNull();
    });
  });

  describe("paging", () => {
    test("a product that appears on two pages is listed once, the later row winning (D4)", async () => {
      consoleListCatalogProducts
        .mockResolvedValueOnce(
          page(
            [
              product({ productId: PRODUCT_1, name: "Alpha" }),
              product({ productId: PRODUCT_2, name: "Bravo" }),
            ],
            "c1",
          ),
        )
        .mockResolvedValueOnce(
          page(
            [
              product({ productId: PRODUCT_1, name: "Alpha renamed" }),
              product({ productId: PRODUCT_3, name: "Charlie" }),
            ],
            null,
          ),
        );
      renderList();
      await tableReady();
      fireEvent.click(screen.getByRole("button", { name: "Load more" }));
      expect(await screen.findByText("Charlie")).toBeDefined();
      const table = screen.getByRole("table");
      const names = within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[0].textContent);
      expect(names).toEqual(["Bravo", "Alpha renamed", "Charlie"]);
      // The count is the deduplicated rows, never a total.
      expect(loadedCount(3)).toBeDefined();
    });

    test("the loaded count is a status message with its number isolated", async () => {
      renderList();
      await tableReady();
      const count = loadedCount(1);
      expect(count.tagName).toBe("OUTPUT");
      expect(count.querySelector("bdi")?.textContent).toBe("1");
    });

    test("Load more is offered while the server gives a cursor; the end only for a null cursor", async () => {
      consoleListCatalogProducts.mockResolvedValueOnce(page([product()], "c1"));
      renderList();
      await tableReady();
      expect(screen.getByRole("button", { name: "Load more" })).toBeDefined();
      expect(screen.queryByText("End of the items.")).toBeNull();
    });

    test("when the last page arrives, focus moves from Load more to the end of the list", async () => {
      consoleListCatalogProducts
        .mockResolvedValueOnce(page([product()], "c1"))
        .mockResolvedValueOnce(page([product({ productId: PRODUCT_2, name: "Loose tea" })], null));
      renderList();
      await tableReady();
      const more = screen.getByRole("button", { name: "Load more" });
      more.focus();
      fireEvent.click(more);
      const end = await screen.findByText("End of the items.");
      await waitFor(() => expect(document.activeElement).toBe(end));
    });
  });

  test("activating a row opens the product's detail route", async () => {
    renderList();
    const table = await tableReady();
    fireEvent.click(within(table).getByText("Mineral water 1.5L"));
    await waitFor(() => expect(location()).toBe(`/catalog/products/${PRODUCT_1}`));
  });
});
