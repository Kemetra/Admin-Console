import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const listStores = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, listStores: (...a: unknown[]) => listStores(...a) };
});

const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { createQueryClient } from "@/lib/query";
import { ScopeHeader } from "@/shell/ScopeHeader";

const switchStore = vi.fn().mockResolvedValue(undefined);
const clearStore = vi.fn().mockResolvedValue(undefined);

function value(over: Record<string, unknown> = {}) {
  return {
    switchStore,
    clearStore,
    context: {
      active_tenant: { id: "t1", name: "Northstar Retail" },
      active_store: null,
      memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", store_access_kind: "all" }],
      ...over,
    },
  };
}

const twoStores = {
  status: 200,
  data: [
    { id: "s1", code: "CFC", name: "Cairo Festival City" },
    { id: "s2", code: "NCM", name: "New Cairo Mall" },
  ],
};

function renderHeader(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ScopeHeader />
    </QueryClientProvider>,
  );
}

function openMenu(): void {
  fireEvent.click(screen.getByRole("button", { name: /Northstar Retail/ }));
}

/**
 * RT-354: the scope menu lists the stores the caller may enter in the active
 * tenant and switches to one through the context mutator (which re-fetches; no
 * optimistic update).
 */
describe("ScopeHeader store menu", () => {
  beforeEach(() => {
    listStores.mockReset();
    activeContext.mockReset();
    switchStore.mockClear();
    clearStore.mockClear();
  });

  test("does not load stores until the menu opens", () => {
    activeContext.mockReturnValue(value());
    listStores.mockResolvedValue(twoStores);
    renderHeader();
    expect(listStores).not.toHaveBeenCalled();
  });

  test("lists every store for 'all' access, after 'All stores'", async () => {
    activeContext.mockReturnValue(value());
    listStores.mockResolvedValue(twoStores);
    renderHeader();
    openMenu();
    await screen.findByRole("menuitem", { name: "New Cairo Mall" });
    expect(screen.getAllByRole("menuitem").map((b) => b.textContent)).toEqual([
      "All stores✓",
      "Cairo Festival City",
      "New Cairo Mall",
    ]);
  });

  test("lists only the granted stores for 'specific' access", async () => {
    activeContext.mockReturnValue(
      value({
        memberships: [
          { tenant_id: "t1", store_access_kind: "specific", accessible_store_ids: ["s2"] },
        ],
      }),
    );
    listStores.mockResolvedValue(twoStores);
    renderHeader();
    openMenu();
    await screen.findByRole("menuitem", { name: "New Cairo Mall" });
    expect(screen.queryByRole("menuitem", { name: "Cairo Festival City" })).toBeNull();
  });

  test("selecting another store calls switchStore and closes the menu", async () => {
    activeContext.mockReturnValue(value());
    listStores.mockResolvedValue(twoStores);
    renderHeader();
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "New Cairo Mall" }));
    expect(switchStore).toHaveBeenCalledWith("s2");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("the active store is marked current and re-selecting it does not switch", async () => {
    activeContext.mockReturnValue(
      value({ active_store: { id: "s1", name: "Cairo Festival City" } }),
    );
    listStores.mockResolvedValue(twoStores);
    renderHeader();
    openMenu();
    const current = await screen.findByRole("menuitem", { name: /Cairo Festival City/ });
    expect(current.getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "All stores" }).getAttribute("aria-current")).toBe(
      null,
    );
    fireEvent.click(current);
    expect(switchStore).not.toHaveBeenCalled();
  });

  test("'All stores' clears the store", async () => {
    activeContext.mockReturnValue(
      value({ active_store: { id: "s1", name: "Cairo Festival City" } }),
    );
    listStores.mockResolvedValue(twoStores);
    renderHeader();
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "All stores" }));
    expect(clearStore).toHaveBeenCalledTimes(1);
  });

  test("loading, then empty state", async () => {
    activeContext.mockReturnValue(value());
    let resolve: (v: unknown) => void = () => {};
    listStores.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    renderHeader();
    openMenu();
    expect(await screen.findByText(/loading stores/i)).toBeDefined();
    resolve({ status: 200, data: [] });
    expect(await screen.findByText(/no stores you can open/i)).toBeDefined();
  });

  test("a non-array list body renders the empty state instead of crashing the shell", async () => {
    activeContext.mockReturnValue(value());
    listStores.mockResolvedValue({ status: 200, data: {} });
    renderHeader();
    openMenu();
    expect(await screen.findByText(/no stores you can open/i)).toBeDefined();
    expect(screen.getByRole("menuitem", { name: /all stores/i })).toBeDefined();
  });

  test("error state offers a retry that re-fetches", async () => {
    activeContext.mockReturnValue(value());
    listStores.mockResolvedValue({ status: 500, error: {} });
    renderHeader();
    openMenu();
    const retry = await screen.findByRole("menuitem", { name: /try again/i }, { timeout: 5000 });
    expect(screen.getByText(/couldn't load stores/i)).toBeDefined();
    const calls = listStores.mock.calls.length;
    listStores.mockResolvedValue(twoStores);
    fireEvent.click(retry);
    await waitFor(() => expect(listStores.mock.calls.length).toBeGreaterThan(calls));
    expect(await screen.findByRole("menuitem", { name: "New Cairo Mall" })).toBeDefined();
  });
});
