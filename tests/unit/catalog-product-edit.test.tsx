import { DirtyGuardProvider } from "@/shell/dirty-guard";
import { NavigationBlocker } from "@/shell/navigation-blocker";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Outlet, RouterProvider, createMemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  CATEGORY_1,
  CATEGORY_2,
  PRODUCT_1,
  categories,
  ctx,
  detail,
  failure,
  one,
  writeFailure,
} from "./catalog-fixtures";

const consoleGetCatalogProduct = vi.fn();
const consoleListCatalogCategories = vi.fn();
const consoleUpdateCatalogProduct = vi.fn();
vi.mock("@/lib/catalog-queries", () => ({
  consoleGetCatalogProduct: (...a: unknown[]) => consoleGetCatalogProduct(...a),
  consoleListCatalogCategories: (...a: unknown[]) => consoleListCatalogCategories(...a),
  consoleUpdateCatalogProduct: (...a: unknown[]) => consoleUpdateCatalogProduct(...a),
  consoleRetireCatalogProduct: vi.fn(),
  consoleListCatalogProducts: vi.fn(),
}));
const activeContext = vi.fn();
// Reactive, so a test can change the scope under a mounted page (a tenant switch).
const scopeStore = vi.hoisted(() => ({ version: 0, listeners: new Set<() => void>() }));
vi.mock("@/context/ActiveContextProvider", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useActiveContextValue: () => {
      useSyncExternalStore(
        (listener) => {
          scopeStore.listeners.add(listener);
          return () => scopeStore.listeners.delete(listener);
        },
        () => scopeStore.version,
      );
      return activeContext();
    },
  };
});

/** Tell every mounted page the scope changed (the mock above already answers the new one). */
function changeScope(): void {
  act(() => {
    scopeStore.version += 1;
    for (const listener of scopeStore.listeners) listener();
  });
}

import { CatalogProductEdit } from "@/catalog/CatalogProductEdit";
import { createQueryClient } from "@/lib/query";

const LOADED_AT = "2026-10-07T10:30:00Z";
const RELOADED_AT = "2026-10-08T09:00:00Z";

function Layout(): React.JSX.Element {
  return (
    <DirtyGuardProvider>
      <NavigationBlocker />
      <main data-dirty-scope>
        <Outlet />
      </main>
    </DirtyGuardProvider>
  );
}

function renderEdit(productId = PRODUCT_1) {
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: "/catalog/products/:productId/edit", element: <CatalogProductEdit /> },
          { path: "/catalog/products/:productId", element: <h1>DETAIL PAGE</h1> },
        ],
      },
    ],
    { initialEntries: [`/catalog/products/${productId}/edit`] },
  );
  const view = render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, ...view };
}

async function loaded(): Promise<void> {
  await screen.findByRole("heading", { level: 1, name: /Edit/ });
}

const name = () => screen.getByLabelText(/^Name/) as HTMLInputElement;
const description = () => screen.getByLabelText(/^Description/) as HTMLTextAreaElement;
const category = () => screen.getByLabelText(/^Category/) as HTMLSelectElement;
const tax = () => screen.getByLabelText(/^Tax category/) as HTMLInputElement;
const available = () => screen.getByLabelText(/Available for sale/) as HTMLInputElement;
const save = () => screen.getByRole("button", { name: /Save changes/ });

function type(el: HTMLElement, value: string): void {
  fireEvent.change(el, { target: { value } });
}

function summary(): HTMLElement | null {
  return screen.queryByRole("region", { name: /problems? need/ });
}

const UNAVAILABLE = "This item is not available to you.";

describe("CatalogProductEdit (RT-768, CAT-C2a edit)", () => {
  beforeEach(() => {
    consoleGetCatalogProduct.mockReset();
    consoleListCatalogCategories.mockReset();
    consoleUpdateCatalogProduct.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx());
    consoleGetCatalogProduct.mockResolvedValue(one(detail()));
    consoleListCatalogCategories.mockResolvedValue(categories);
    consoleUpdateCatalogProduct.mockResolvedValue(
      one(detail({}, { taxCategory: "zero", updatedAt: RELOADED_AT })),
    );
  });

  // --- Gates ----------------------------------------------------------------------------

  test("no active tenant: scope prompt, nothing requested", async () => {
    activeContext.mockReturnValue(ctx("owner", null));
    renderEdit();
    expect(await screen.findByText("Select a tenant to edit this item.")).toBeDefined();
    expect(consoleGetCatalogProduct).not.toHaveBeenCalled();
  });

  test("a role the catalog refuses reads as not available, with no request", async () => {
    activeContext.mockReturnValue(ctx("store_staff"));
    renderEdit();
    expect(await screen.findByText(UNAVAILABLE)).toBeDefined();
    expect(consoleGetCatalogProduct).not.toHaveBeenCalled();
  });

  test("an id that is not a UUID reads as not available, with no request", async () => {
    renderEdit("new");
    expect(await screen.findByText(UNAVAILABLE)).toBeDefined();
    expect(consoleGetCatalogProduct).not.toHaveBeenCalled();
  });

  test("store_manager sees the item read-only: no form, a link back, no write", async () => {
    activeContext.mockReturnValue(ctx("store_manager"));
    renderEdit();
    expect(await screen.findByText("You can view this item but not edit it.")).toBeDefined();
    expect(document.querySelector("form, input, textarea, select")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to item" }).getAttribute("href")).toBe(
      `/catalog/products/${PRODUCT_1}`,
    );
    expect(consoleUpdateCatalogProduct).not.toHaveBeenCalled();
  });

  test("a retired product is read-only: no form", async () => {
    consoleGetCatalogProduct.mockResolvedValue(one(detail({}, { status: "retired" })));
    renderEdit();
    expect(await screen.findByText("This item is retired, so it is read-only.")).toBeDefined();
    expect(document.querySelector("form, input, textarea, select")).toBeNull();
  });

  test("a 404 is the one non-disclosing state", async () => {
    consoleGetCatalogProduct.mockResolvedValue(failure(404));
    renderEdit();
    expect(await screen.findByText(UNAVAILABLE)).toBeDefined();
  });

  // --- The form ---------------------------------------------------------------------------

  test("fields are prefilled from the item; price is read-only text, not an input", async () => {
    renderEdit();
    await loaded();
    expect(name().value).toBe("Mineral water 1.5L");
    expect(description().value).toBe("Still spring water, 1.5 litre bottle.");
    expect(category().value).toBe(CATEGORY_1);
    expect(tax().value).toBe("standard");
    expect(available().checked).toBe(true);
    expect(screen.getByText(/10\.50/)).toBeDefined();
    expect(screen.queryByLabelText(/^Price/)).toBeNull();
  });

  test("tax category is machine text: LTR, no spellcheck, no autocomplete", async () => {
    renderEdit();
    await loaded();
    expect(tax().getAttribute("dir")).toBe("ltr");
    expect(tax().getAttribute("spellcheck")).toBe("false");
    expect(tax().getAttribute("autocomplete")).toBe("off");
    expect(name().getAttribute("dir")).toBe("auto");
    expect(description().getAttribute("dir")).toBe("auto");
  });

  test("name and tax category are announced required; the form validates itself", async () => {
    renderEdit();
    await loaded();
    expect(name().getAttribute("aria-required")).toBe("true");
    expect(tax().getAttribute("aria-required")).toBe("true");
    expect(document.querySelector("form")?.hasAttribute("novalidate")).toBe(true);
  });

  test("category: none, the tenant's categories, and a retired current one marked retired", async () => {
    consoleGetCatalogProduct.mockResolvedValue(
      one(
        detail(
          {},
          { categoryId: "0190f000-0000-7000-8000-0000000007c9", categoryName: "Old drinks" },
        ),
      ),
    );
    renderEdit();
    await loaded();
    await waitFor(() => expect(within(category()).getAllByRole("option")).toHaveLength(4));
    const labels = within(category())
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(labels).toEqual(["No category", "Old drinks (retired)", "Beverages", "Snacks"]);
    expect(category().value).toBe("0190f000-0000-7000-8000-0000000007c9");
  });

  test("the form is tracked by the unsaved-work guard (not opted out)", async () => {
    renderEdit();
    await loaded();
    expect(document.querySelector("form")?.getAttribute("data-dirty-guard")).not.toBe("off");
  });

  // --- No-op and the patch ------------------------------------------------------------------

  test("a no-op edit does not submit, says so, and Save stays available", async () => {
    renderEdit();
    await loaded();
    fireEvent.click(save());
    expect(await screen.findByText("There are no changes to save.")).toBeDefined();
    expect(consoleUpdateCatalogProduct).not.toHaveBeenCalled();
    expect((save() as HTMLButtonElement).disabled).toBe(false);
  });

  test("the no-changes notice goes away on the next edit", async () => {
    renderEdit();
    await loaded();
    fireEvent.click(save());
    await screen.findByText("There are no changes to save.");
    type(tax(), "zero");
    expect(screen.queryByText("There are no changes to save.")).toBeNull();
  });

  test("an edit that is put back is a no-op", async () => {
    renderEdit();
    await loaded();
    type(tax(), "zero");
    type(tax(), "standard");
    fireEvent.click(save());
    await screen.findByText("There are no changes to save.");
    expect(consoleUpdateCatalogProduct).not.toHaveBeenCalled();
  });

  test("PATCH sends expectedUpdatedAt and only the changed field", async () => {
    renderEdit();
    await loaded();
    type(tax(), "zero");
    fireEvent.click(save());
    await waitFor(() => expect(consoleUpdateCatalogProduct).toHaveBeenCalledTimes(1));
    expect(consoleUpdateCatalogProduct).toHaveBeenCalledWith(PRODUCT_1, {
      expectedUpdatedAt: LOADED_AT,
      taxCategory: "zero",
    });
  });

  test("a changed name is sent trimmed at the ends (D5)", async () => {
    renderEdit();
    await loaded();
    type(name(), "  Spring water  ");
    fireEvent.click(save());
    await waitFor(() => expect(consoleUpdateCatalogProduct).toHaveBeenCalled());
    expect(consoleUpdateCatalogProduct).toHaveBeenCalledWith(PRODUCT_1, {
      expectedUpdatedAt: LOADED_AT,
      name: "Spring water",
    });
  });

  test("clearing the description and the category sends null for each", async () => {
    renderEdit();
    await loaded();
    await waitFor(() => expect(within(category()).getAllByRole("option")).toHaveLength(3));
    type(description(), "");
    type(category(), "");
    fireEvent.click(save());
    await waitFor(() => expect(consoleUpdateCatalogProduct).toHaveBeenCalled());
    expect(consoleUpdateCatalogProduct).toHaveBeenCalledWith(PRODUCT_1, {
      expectedUpdatedAt: LOADED_AT,
      description: null,
      categoryId: null,
    });
  });

  test("a retired current category is not sent when the category is left alone", async () => {
    consoleGetCatalogProduct.mockResolvedValue(
      one(
        detail(
          {},
          { categoryId: "0190f000-0000-7000-8000-0000000007c9", categoryName: "Old drinks" },
        ),
      ),
    );
    renderEdit();
    await loaded();
    type(tax(), "zero");
    fireEvent.click(save());
    await waitFor(() => expect(consoleUpdateCatalogProduct).toHaveBeenCalled());
    expect(consoleUpdateCatalogProduct.mock.calls[0][1]).not.toHaveProperty("categoryId");
  });

  test("availability is sent when toggled", async () => {
    renderEdit();
    await loaded();
    fireEvent.click(available());
    fireEvent.click(save());
    await waitFor(() => expect(consoleUpdateCatalogProduct).toHaveBeenCalled());
    expect(consoleUpdateCatalogProduct).toHaveBeenCalledWith(PRODUCT_1, {
      expectedUpdatedAt: LOADED_AT,
      isActive: false,
    });
  });

  test("a saved edit lands on the detail, with no leave prompt", async () => {
    renderEdit();
    await loaded();
    type(tax(), "zero");
    fireEvent.click(save());
    expect(await screen.findByRole("heading", { name: "DETAIL PAGE" })).toBeDefined();
    expect(screen.queryByText("Leave without saving?")).toBeNull();
  });

  test("Save is disabled while the request is in flight: one request only", async () => {
    let finish: (v: unknown) => void = () => undefined;
    consoleUpdateCatalogProduct.mockReturnValue(
      new Promise((r) => {
        finish = r;
      }),
    );
    renderEdit();
    await loaded();
    type(tax(), "zero");
    fireEvent.click(save());
    await waitFor(() => expect((save() as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(save());
    expect(consoleUpdateCatalogProduct).toHaveBeenCalledTimes(1);
    await act(async () => finish(one(detail())));
  });

  // --- Dirty guard (RT-268) -------------------------------------------------------------------

  test("Cancel with edits asks Stay / Discard; Discard goes back to the item", async () => {
    renderEdit();
    await loaded();
    type(tax(), "zero");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Leave without saving?")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(await screen.findByRole("heading", { name: "DETAIL PAGE" })).toBeDefined();
  });

  test("Cancel without edits leaves at once", async () => {
    renderEdit();
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("heading", { name: "DETAIL PAGE" })).toBeDefined();
    expect(screen.queryByText("Leave without saving?")).toBeNull();
  });

  // --- The error summary (D7) -------------------------------------------------------------------

  describe("error summary", () => {
    async function blockedSubmit(): Promise<void> {
      renderEdit();
      await loaded();
      type(name(), "   ");
      type(tax(), "");
      fireEvent.click(save());
      await screen.findByRole("region", { name: "2 problems need fixing" });
    }

    test("no premature errors: nothing is in error before the first submit", async () => {
      renderEdit();
      await loaded();
      expect(summary()).toBeNull();
      expect(document.querySelectorAll("[aria-invalid='true']")).toHaveLength(0);
      type(name(), ""); // emptied, not left: still quiet
      expect(summary()).toBeNull();
      expect(name().getAttribute("aria-invalid")).toBeNull();
    });

    test("leaving an emptied required field shows nothing: no error moves the layout before Save", async () => {
      renderEdit();
      await loaded();
      type(name(), "");
      fireEvent.blur(name());
      expect(name().getAttribute("aria-invalid")).toBeNull();
      expect(screen.queryByText("Enter the item name.")).toBeNull();
      expect(summary()).toBeNull();
    });

    test("a blocked submit sends nothing and shows the summary at the top, focused", async () => {
      await blockedSubmit();
      expect(consoleUpdateCatalogProduct).not.toHaveBeenCalled();
      const region = screen.getByRole("region", { name: "2 problems need fixing" });
      expect(document.activeElement).toBe(region);
      // At the top: it comes before the first field in the document.
      expect(
        region.compareDocumentPosition(name()) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    test("one link per error in field order; the same errors are inline and described", async () => {
      await blockedSubmit();
      const links = within(
        screen.getByRole("region", { name: "2 problems need fixing" }),
      ).getAllByRole("link");
      expect(links.map((l) => l.textContent)).toEqual([
        "Enter the item name.",
        "Enter the tax category.",
      ]);
      for (const field of [name(), tax()]) {
        expect(field.getAttribute("aria-invalid")).toBe("true");
        const described = (field.getAttribute("aria-describedby") ?? "").split(" ");
        const errorId = described.find((id) =>
          document.getElementById(id)?.textContent?.match(/Enter the/),
        );
        expect(errorId).toBeDefined();
      }
      expect(screen.getAllByText("Enter the item name.")).toHaveLength(2); // summary + inline
    });

    test("a link focuses its field, and raises no leave prompt or navigation", async () => {
      const { router } = renderEdit();
      await loaded();
      type(name(), "");
      type(tax(), "");
      fireEvent.click(save());
      await screen.findByRole("region", { name: "2 problems need fixing" });
      const before = router.state.location;
      fireEvent.click(screen.getByRole("link", { name: "Enter the tax category." }));
      expect(document.activeElement).toBe(tax());
      expect(router.state.location).toBe(before);
      expect(screen.queryByText("Leave without saving?")).toBeNull();
    });

    test("an entry clears live as the field is fixed, and focus stays in the field", async () => {
      await blockedSubmit();
      name().focus();
      type(name(), "Water");
      expect(document.activeElement).toBe(name());
      const region = screen.getByRole("region", { name: "1 problem needs fixing" });
      expect(within(region).getAllByRole("link")).toHaveLength(1);
      expect(name().getAttribute("aria-invalid")).toBeNull();
      expect(tax().getAttribute("aria-invalid")).toBe("true");
    });

    test("the summary disappears when the last error is fixed; the form then saves", async () => {
      await blockedSubmit();
      type(name(), "Water");
      type(tax(), "zero");
      expect(summary()).toBeNull();
      fireEvent.click(save());
      await waitFor(() => expect(consoleUpdateCatalogProduct).toHaveBeenCalledTimes(1));
    });

    test("every blocked submit moves focus to the summary again", async () => {
      await blockedSubmit();
      const region = screen.getByRole("region", { name: "2 problems need fixing" });
      name().focus();
      expect(document.activeElement).toBe(name());
      fireEvent.click(save());
      expect(document.activeElement).toBe(region);
    });

    test("too-long values are named with the repair", async () => {
      renderEdit();
      await loaded();
      type(name(), "a".repeat(501));
      type(description(), "d".repeat(2001));
      type(tax(), "x".repeat(51));
      fireEvent.click(save());
      const region = await screen.findByRole("region", { name: "3 problems need fixing" });
      expect(
        within(region)
          .getAllByRole("link")
          .map((l) => l.textContent),
      ).toEqual([
        "The name can be at most 500 characters. Shorten it.",
        "The description can be at most 2000 characters. Shorten it.",
        "The tax category can be at most 50 characters. Shorten it.",
      ]);
    });

    test("a context error is a banner, never an entry of the summary", async () => {
      consoleUpdateCatalogProduct.mockResolvedValue(writeFailure(500, "internal_error", "req-500"));
      renderEdit();
      await loaded();
      type(tax(), "zero");
      fireEvent.click(save());
      expect(await screen.findByText(/nothing was saved/)).toBeDefined();
      expect(summary()).toBeNull();
    });
  });

  // --- Every 4xx / 5xx of the write contract ---------------------------------------------------------

  describe("write failures keep what was typed", () => {
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
      "%i %s: a banner with the request id; typed values kept; no summary",
      async (status, code, message) => {
        consoleUpdateCatalogProduct.mockResolvedValue(writeFailure(status, code, "req-xyz"));
        renderEdit();
        await loaded();
        type(tax(), "zero");
        fireEvent.click(save());
        const alert = await screen.findByText(message);
        expect(alert.closest("[role='alert']")?.textContent).toContain("req-xyz");
        expect(tax().value).toBe("zero");
        expect(summary()).toBeNull();
        expect(document.querySelectorAll("[aria-invalid='true']")).toHaveLength(0);
        expect((save() as HTMLButtonElement).disabled).toBe(false);
      },
    );

    test("a request that never completed is a banner too, and the input stays", async () => {
      consoleUpdateCatalogProduct.mockRejectedValue(new TypeError("Failed to fetch"));
      renderEdit();
      await loaded();
      type(tax(), "zero");
      fireEvent.click(save());
      expect(await screen.findByText(/nothing was saved/)).toBeDefined();
      expect(tax().value).toBe("zero");
    });

    test("a banner goes away with the next attempt", async () => {
      consoleUpdateCatalogProduct.mockResolvedValueOnce(writeFailure(500, "internal_error"));
      renderEdit();
      await loaded();
      type(tax(), "zero");
      fireEvent.click(save());
      await screen.findByText(/nothing was saved/);
      fireEvent.click(save());
      await waitFor(() => expect(screen.queryByText(/nothing was saved/)).toBeNull());
    });
  });

  describe("409 product_retired", () => {
    test("a banner says it, the form is locked, and nothing more is sent", async () => {
      consoleUpdateCatalogProduct.mockResolvedValue(writeFailure(409, "product_retired"));
      renderEdit();
      await loaded();
      type(tax(), "zero");
      fireEvent.click(save());
      expect(await screen.findByText(/retired, so it can no longer be changed/)).toBeDefined();
      expect((save() as HTMLButtonElement).disabled).toBe(true);
      expect(tax().value).toBe("zero");
      expect(summary()).toBeNull();
    });
  });

  describe("422 category_unavailable, the refused category", () => {
    /** The refetch the 422 triggers answers with a list that no longer has the refused category. */
    async function refused(): Promise<void> {
      consoleListCatalogCategories
        .mockResolvedValueOnce(categories)
        .mockResolvedValue({ status: 200, data: { items: [categories.data.items[0]] } });
      consoleUpdateCatalogProduct.mockResolvedValue(writeFailure(422, "category_unavailable"));
      renderEdit();
      await loaded();
      await waitFor(() => expect(within(category()).getAllByRole("option")).toHaveLength(3));
      type(category(), CATEGORY_2);
      fireEvent.click(save());
      await screen.findByRole("region", { name: "1 problem needs fixing" });
      await waitFor(() => expect(consoleListCatalogCategories).toHaveBeenCalledTimes(2));
    }

    test("it stays selected, marked unavailable, after the list drops it", async () => {
      await refused();
      await waitFor(() =>
        expect(
          within(category())
            .getAllByRole("option")
            .map((o) => o.textContent),
        ).toEqual(["No category", "Snacks (unavailable)", "Beverages"]),
      );
      expect(category().value).toBe(CATEGORY_2);
    });

    test("a second Save sends nothing while it stands, and focuses the summary", async () => {
      await refused();
      fireEvent.click(save());
      expect(consoleUpdateCatalogProduct).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(
        screen.getByRole("region", { name: "1 problem needs fixing" }),
      );
    });

    test("choosing No category clears the error and the next Save sends null", async () => {
      await refused();
      await screen.findByRole("option", { name: "Snacks (unavailable)" });
      type(category(), "");
      expect(summary()).toBeNull();
      consoleUpdateCatalogProduct.mockResolvedValue(one(detail()));
      fireEvent.click(save());
      await waitFor(() => expect(consoleUpdateCatalogProduct).toHaveBeenCalledTimes(2));
      expect(consoleUpdateCatalogProduct.mock.calls[1]).toEqual([
        PRODUCT_1,
        { expectedUpdatedAt: LOADED_AT, categoryId: null },
      ]);
    });
  });

  describe("scope change", () => {
    test("typed values and the opened state never carry into another tenant's item", async () => {
      renderEdit();
      await loaded();
      type(tax(), "zero");
      expect(tax().value).toBe("zero");
      activeContext.mockReturnValue(ctx("owner", "t2"));
      consoleGetCatalogProduct.mockResolvedValue(one(detail({}, { name: "Other tenant item" })));
      changeScope();
      await screen.findByRole("heading", { level: 1, name: /Other tenant item/ });
      expect(tax().value).toBe("standard");
      expect(consoleGetCatalogProduct).toHaveBeenCalledTimes(2);
    });

    test("a retired item in the new tenant reads read-only even if the old one was open", async () => {
      renderEdit();
      await loaded();
      activeContext.mockReturnValue(ctx("owner", "t2"));
      consoleGetCatalogProduct.mockResolvedValue(one(detail({}, { status: "retired" })));
      changeScope();
      expect(await screen.findByText("This item is retired, so it is read-only.")).toBeDefined();
      expect(document.querySelector("form")).toBeNull();
    });
  });

  describe("422 category_unavailable", () => {
    test("is a field error on the category: inline and in the summary, and the categories reload", async () => {
      consoleUpdateCatalogProduct.mockResolvedValue(writeFailure(422, "category_unavailable"));
      renderEdit();
      await loaded();
      await waitFor(() => expect(within(category()).getAllByRole("option")).toHaveLength(3));
      type(category(), CATEGORY_2);
      fireEvent.click(save());
      const region = await screen.findByRole("region", { name: "1 problem needs fixing" });
      expect(document.activeElement).toBe(region);
      expect(category().getAttribute("aria-invalid")).toBe("true");
      expect(
        within(region)
          .getAllByRole("link")
          .map((l) => l.textContent),
      ).toEqual(["This category is no longer available. Choose another category, or no category."]);
      await waitFor(() => expect(consoleListCatalogCategories).toHaveBeenCalledTimes(2));
    });

    test("choosing another category clears the entry live", async () => {
      consoleUpdateCatalogProduct.mockResolvedValue(writeFailure(422, "category_unavailable"));
      renderEdit();
      await loaded();
      await waitFor(() => expect(within(category()).getAllByRole("option")).toHaveLength(3));
      type(category(), CATEGORY_2);
      fireEvent.click(save());
      await screen.findByRole("region", { name: "1 problem needs fixing" });
      type(category(), "");
      expect(summary()).toBeNull();
      expect(category().getAttribute("aria-invalid")).toBeNull();
    });
  });

  // --- 409 stale_write: conflict banner, reload, typed values kept -----------------------------------

  describe("409 stale_write", () => {
    const FRESH = detail(
      { description: "Rewritten by someone else." },
      { name: "Water (renamed)", taxCategory: "reduced", updatedAt: RELOADED_AT },
    );

    async function stale(): Promise<void> {
      consoleUpdateCatalogProduct.mockResolvedValueOnce(writeFailure(409, "stale_write", "req-st"));
      renderEdit();
      await loaded();
      type(description(), "My own description");
      fireEvent.click(save());
      await screen.findByText(/changed since you opened it/);
    }

    test("a conflict banner offers Reload; the typed value is kept and not called invalid", async () => {
      await stale();
      expect(screen.getByRole("button", { name: "Reload" })).toBeDefined();
      expect(description().value).toBe("My own description");
      expect(summary()).toBeNull();
      expect(document.querySelectorAll("[aria-invalid='true']")).toHaveLength(0);
      expect(screen.getByText(/req-st/)).toBeDefined();
    });

    test("Reload reads the item again; typed fields stay, untouched ones follow the server", async () => {
      await stale();
      consoleGetCatalogProduct.mockResolvedValue(one(FRESH));
      fireEvent.click(screen.getByRole("button", { name: "Reload" }));
      await screen.findByText(/The latest version is loaded/);
      expect(consoleGetCatalogProduct).toHaveBeenCalledTimes(2);
      expect(description().value).toBe("My own description");
      expect(name().value).toBe("Water (renamed)");
      expect(tax().value).toBe("reduced");
    });

    test("saving after Reload sends the new expectedUpdatedAt and only what the user changed", async () => {
      await stale();
      consoleGetCatalogProduct.mockResolvedValue(one(FRESH));
      fireEvent.click(screen.getByRole("button", { name: "Reload" }));
      await screen.findByText(/The latest version is loaded/);
      consoleUpdateCatalogProduct.mockResolvedValue(one(FRESH));
      fireEvent.click(save());
      await waitFor(() => expect(consoleUpdateCatalogProduct).toHaveBeenCalledTimes(2));
      // The untouched name and tax category follow the server: they are NOT sent back.
      expect(consoleUpdateCatalogProduct.mock.calls[1]).toEqual([
        PRODUCT_1,
        { expectedUpdatedAt: RELOADED_AT, description: "My own description" },
      ]);
    });

    test("a reload that fails keeps the typed values and says so", async () => {
      await stale();
      consoleGetCatalogProduct.mockResolvedValue(failure(500));
      fireEvent.click(screen.getByRole("button", { name: "Reload" }));
      expect(await screen.findByText(/Could not reload this item/)).toBeDefined();
      expect(description().value).toBe("My own description");
      expect(screen.getByRole("heading", { level: 1, name: /Edit/ })).toBeDefined();
    });

    test("a failed reload keeps the conflict banner and its Reload, so it can be retried", async () => {
      await stale();
      consoleGetCatalogProduct.mockResolvedValue(failure(500));
      fireEvent.click(screen.getByRole("button", { name: "Reload" }));
      await screen.findByText(/Could not reload this item/);
      expect(screen.getByText(/changed since you opened it/)).toBeDefined();
      consoleGetCatalogProduct.mockResolvedValue(one(FRESH));
      fireEvent.click(screen.getByRole("button", { name: "Reload" }));
      await screen.findByText(/The latest version is loaded/);
      expect(screen.queryByText(/Could not reload this item/)).toBeNull();
      expect(name().value).toBe("Water (renamed)");
    });

    test("a reload that finds the item retired locks the form", async () => {
      await stale();
      consoleGetCatalogProduct.mockResolvedValue(one(detail({}, { status: "retired" })));
      fireEvent.click(screen.getByRole("button", { name: "Reload" }));
      expect(await screen.findByText(/retired, so it can no longer be changed/)).toBeDefined();
      expect((save() as HTMLButtonElement).disabled).toBe(true);
      expect(description().value).toBe("My own description");
    });
  });
});
