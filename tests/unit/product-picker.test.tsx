import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { PRODUCT_1, PRODUCT_2, PRODUCT_3, failure, page, product } from "./catalog-fixtures";

const consoleListCatalogProducts = vi.fn();
vi.mock("@/lib/catalog-queries", () => ({
  consoleListCatalogProducts: (...a: unknown[]) => consoleListCatalogProducts(...a),
}));

import { ProductPicker } from "@/catalog/ProductPicker";
import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { reportRateLimited, resetRateLimit } from "@/lib/rate-limit";

/**
 * RT-767: the shared product picker over `consoleListCatalogProducts`. Active
 * products only, an explicit search submit, a keyboard-operable listbox, no
 * price anywhere, and every failure shown as its own state.
 */
const WATER = product({ productId: PRODUCT_1, name: "Mineral water 1.5L" });
const COLA = product({
  productId: PRODUCT_2,
  name: "Cola 330ml",
  primarySku: "SKU-0043",
  primaryBarcode: null,
});
const TEA = product({
  productId: PRODUCT_3,
  name: "Black tea 100 bags",
  primarySku: null,
  primaryBarcode: "6221234567890",
});

function renderPicker(
  props: Partial<React.ComponentProps<typeof ProductPicker>> = {},
  client = createQueryClient(),
) {
  const onSelect = vi.fn();
  const view = (p: Partial<React.ComponentProps<typeof ProductPicker>>) => (
    <QueryClientProvider client={client}>
      <ProductPicker tenantId="t1" onSelect={onSelect} {...p} />
    </QueryClientProvider>
  );
  const utils = render(view(props));
  return { onSelect, rerender: (p: typeof props) => utils.rerender(view(p)), client };
}

const listbox = () => screen.findByRole("listbox", { name: "Active products" });

beforeEach(() => {
  setLocale("en");
  consoleListCatalogProducts.mockReset();
  resetRateLimit();
});

describe("loading the first page", () => {
  test("asks for active products only, with no store and no search", async () => {
    consoleListCatalogProducts.mockResolvedValue(page([WATER]));
    renderPicker();
    await listbox();
    expect(consoleListCatalogProducts).toHaveBeenCalledTimes(1);
    expect(consoleListCatalogProducts).toHaveBeenCalledWith({ status: "active", limit: 25 });
  });

  test("shows a loading state before the products arrive", async () => {
    consoleListCatalogProducts.mockReturnValue(new Promise(() => undefined));
    renderPicker();
    expect(await screen.findByText("Loading products")).toBeDefined();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("makes no request without a tenant", () => {
    renderPicker({ tenantId: null });
    expect(consoleListCatalogProducts).not.toHaveBeenCalled();
  });

  test("lists name, SKU and barcode, and never a price", async () => {
    consoleListCatalogProducts.mockResolvedValue(page([WATER, COLA, TEA]));
    renderPicker();
    const options = within(await listbox()).getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0].textContent).toContain("Mineral water 1.5L");
    expect(options[0].textContent).toContain("SKU-0042");
    expect(options[0].textContent).toContain("0012345678905");
    expect(options[1].textContent).toContain("SKU-0043");
    expect(options[2].textContent).toContain("6221234567890");
    // The fixture carries defaultPrice 10.5000 EGP (RT-743 D4: the picker shows none).
    expect(document.body.textContent).not.toMatch(/10\.5|EGP|ج\.م/);
    expect(screen.getByText("Products shown: 3")).toBeDefined();
  });

  test("a full page says the list is partial and never claims a total", async () => {
    consoleListCatalogProducts.mockResolvedValue(page([WATER], "cursor-2"));
    renderPicker();
    await listbox();
    expect(screen.getByText(/Refine the search/)).toBeDefined();
  });

  test("the last page carries no partial-list hint", async () => {
    consoleListCatalogProducts.mockResolvedValue(page([WATER], null));
    renderPicker();
    await listbox();
    expect(screen.queryByText(/Refine the search/)).toBeNull();
  });

  test("an empty answer is a state, not an error", async () => {
    consoleListCatalogProducts.mockResolvedValue(page([]));
    renderPicker();
    expect(await screen.findByText("There are no active products.")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("search", () => {
  test("is sent only on submit, exactly as typed, still active-only", async () => {
    consoleListCatalogProducts.mockResolvedValue(page([WATER]));
    renderPicker();
    await listbox();
    const input = screen.getByLabelText("Search active products");
    fireEvent.change(input, { target: { value: "  0012 " } });
    expect(consoleListCatalogProducts).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(consoleListCatalogProducts).toHaveBeenCalledTimes(2));
    expect(consoleListCatalogProducts).toHaveBeenLastCalledWith({
      status: "active",
      limit: 25,
      q: "  0012 ",
    });
  });

  test("a search with no match says so and names the search", async () => {
    consoleListCatalogProducts.mockResolvedValueOnce(page([WATER]));
    consoleListCatalogProducts.mockResolvedValueOnce(page([]));
    renderPicker();
    await listbox();
    fireEvent.change(screen.getByLabelText("Search active products"), {
      target: { value: "zzz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("No active product matches this search.")).toBeDefined();
  });

  test("a search over 100 characters is refused inline and sends nothing", async () => {
    consoleListCatalogProducts.mockResolvedValue(page([WATER]));
    renderPicker();
    await listbox();
    const input = screen.getByLabelText("Search active products");
    fireEvent.change(input, { target: { value: "a".repeat(101) } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Search text can be at most 100 characters.")).toBeDefined();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(consoleListCatalogProducts).toHaveBeenCalledTimes(1);
  });
});

describe("keyboard", () => {
  async function ready(items = [WATER, COLA, TEA]) {
    consoleListCatalogProducts.mockResolvedValue(page(items));
    const utils = renderPicker();
    const box = await listbox();
    box.focus();
    return { box, ...utils };
  }

  const activeName = (box: HTMLElement) => {
    const id = box.getAttribute("aria-activedescendant");
    return id ? document.getElementById(id)?.textContent : null;
  };

  test("the listbox is one tab stop; taking focus activates the first option", async () => {
    const { box } = await ready();
    expect(box.getAttribute("tabindex")).toBe("0");
    expect(activeName(box)).toContain("Mineral water");
  });

  test("the search box has focus when the picker opens", async () => {
    consoleListCatalogProducts.mockResolvedValue(page([WATER]));
    renderPicker();
    await listbox();
    expect(document.activeElement).toBe(screen.getByLabelText("Search active products"));
  });

  test("ArrowDown, ArrowUp, End and Home move the active option", async () => {
    const { box } = await ready();
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(activeName(box)).toContain("Cola");
    fireEvent.keyDown(box, { key: "End" });
    expect(activeName(box)).toContain("Black tea");
    fireEvent.keyDown(box, { key: "ArrowUp" });
    expect(activeName(box)).toContain("Cola");
    fireEvent.keyDown(box, { key: "Home" });
    expect(activeName(box)).toContain("Mineral water");
  });

  test("Enter selects the active option; selecting writes nothing", async () => {
    const { box, onSelect } = await ready();
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(COLA);
  });

  test("Space selects the active option", async () => {
    const { box, onSelect } = await ready();
    fireEvent.keyDown(box, { key: "End" });
    fireEvent.keyDown(box, { key: " " });
    expect(onSelect).toHaveBeenCalledWith(TEA);
  });

  test("Enter selects the first option the list activated on focus", async () => {
    const { box, onSelect } = await ready();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(WATER);
  });

  test("Escape is left alone so the surrounding drawer can close", async () => {
    const { box } = await ready();
    const outer = vi.fn();
    document.addEventListener("keydown", outer);
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    box.dispatchEvent(event);
    document.removeEventListener("keydown", outer);
    expect(outer).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
  });

  test("a click selects, and the chosen product is marked aria-selected", async () => {
    consoleListCatalogProducts.mockResolvedValue(page([WATER, COLA]));
    const { onSelect } = renderPicker({ selectedId: PRODUCT_2 });
    const options = within(await listbox()).getAllByRole("option");
    expect(options[0].getAttribute("aria-selected")).toBe("false");
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.click(options[0]);
    expect(onSelect).toHaveBeenCalledWith(WATER);
  });

  test("a clicked option holds focus: its own Enter chooses it once", async () => {
    consoleListCatalogProducts.mockResolvedValue(page([WATER, COLA]));
    const { onSelect } = renderPicker();
    const options = within(await listbox()).getAllByRole("option");
    options[1].focus();
    fireEvent.keyDown(options[1], { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(COLA);
  });

  test("ArrowDown in the search box moves into the list", async () => {
    consoleListCatalogProducts.mockResolvedValue(page([WATER]));
    renderPicker();
    const box = await listbox();
    fireEvent.keyDown(screen.getByLabelText("Search active products"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(box);
  });
});

describe("failures", () => {
  test("a server error shows the request id and a retry that asks again", async () => {
    consoleListCatalogProducts.mockResolvedValueOnce(failure(500, "req-picker-1"));
    consoleListCatalogProducts.mockResolvedValueOnce(page([WATER]));
    renderPicker();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("req-picker-1");
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await listbox();
    expect(consoleListCatalogProducts).toHaveBeenCalledTimes(2);
  });

  test("a retry after a failure shows loading and hides the stale error until it answers", async () => {
    consoleListCatalogProducts.mockResolvedValueOnce(failure(500, "req-stale"));
    let answer: (value: unknown) => void = () => undefined;
    consoleListCatalogProducts.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderPicker();
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Loading products")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
    answer(failure(500, "req-second"));
    expect((await screen.findByRole("alert")).textContent).toContain("req-second");
  });

  test("a 404 is the API's refusal, not an empty catalog", async () => {
    consoleListCatalogProducts.mockResolvedValue(failure(404));
    renderPicker();
    expect(await screen.findByText(/cannot be searched/)).toBeDefined();
    expect(screen.queryByText("There are no active products.")).toBeNull();
  });

  test("a 400 is a rejected search", async () => {
    consoleListCatalogProducts.mockResolvedValue(failure(400));
    renderPicker();
    expect(await screen.findByText(/rejected this search/)).toBeDefined();
  });

  test("a 401 is an ended session", async () => {
    consoleListCatalogProducts.mockResolvedValue(failure(401));
    renderPicker();
    expect(await screen.findByText(/session has ended/i)).toBeDefined();
  });

  test("a 429 is its own state, is never retried on its own, and gates the retry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      consoleListCatalogProducts.mockResolvedValue(failure(429));
      renderPicker();
      expect(await screen.findByText(/Too many requests/)).toBeDefined();
      act(() => reportRateLimited(30));
      await act(async () => {
        vi.advanceTimersByTime(20_000);
      });
      expect(consoleListCatalogProducts).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: /Try again/ }).hasAttribute("disabled")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test("a failed re-search keeps the search box and offers the retry", async () => {
    consoleListCatalogProducts.mockResolvedValueOnce(page([WATER]));
    consoleListCatalogProducts.mockResolvedValueOnce(failure(500, "req-2"));
    renderPicker();
    await listbox();
    const input = screen.getByLabelText("Search active products");
    fireEvent.change(input, { target: { value: "cola" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect((await screen.findByRole("alert")).textContent).toContain("req-2");
    expect((input as HTMLInputElement).value).toBe("cola");
  });
});

describe("tenant scope", () => {
  test("a different tenant never reuses the first tenant's products", async () => {
    consoleListCatalogProducts.mockResolvedValueOnce(page([WATER]));
    consoleListCatalogProducts.mockResolvedValueOnce(page([COLA]));
    const { rerender } = renderPicker({ tenantId: "t1" });
    expect((await listbox()).textContent).toContain("Mineral water");
    rerender({ tenantId: "t2" });
    await waitFor(() => expect(screen.getByRole("listbox").textContent).toContain("Cola"));
    expect(screen.getByRole("listbox").textContent).not.toContain("Mineral water");
    expect(consoleListCatalogProducts).toHaveBeenCalledTimes(2);
  });
});

describe("Arabic", () => {
  test("renders in Arabic with the same structure", async () => {
    setLocale("ar");
    consoleListCatalogProducts.mockResolvedValue(page([WATER]));
    renderPicker();
    const box = await screen.findByRole("listbox", { name: "الأصناف النشطة" });
    expect(within(box).getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "بحث" })).toBeDefined();
  });
});
