import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
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

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { StoreList } from "@/stores/StoreList";

/**
 * RT-753 (UX-10) — the reference consumer of the shared DataTable sort. The
 * store roster is a COMPLETE set (GET /api/v1/stores takes no cursor, limit or
 * cap), so ordering it in memory is dataset-level, not viewport-level. Default
 * order stays the server's until the user sorts.
 */

const tenant = (id: string) => ({ context: { active_tenant: { id, name: `Tenant ${id}` } } });

const stores = [
  { id: "s1", code: "ZMK", name: "Zamalek", is_active: false, timezone: "Africa/Cairo" },
  { id: "s2", code: "ALX", name: "Mall 10", is_active: true, timezone: "Africa/Cairo" },
  { id: "s3", code: "MAD", name: "Mall 2", is_active: true, timezone: "Africa/Cairo" },
];

function Tree({ qc, children }: { qc: ReturnType<typeof createQueryClient>; children: ReactNode }) {
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function renderList() {
  const qc = createQueryClient();
  const view = render(
    <Tree qc={qc}>
      <StoreList />
    </Tree>,
  );
  return {
    ...view,
    rerenderList: () =>
      view.rerender(
        <Tree qc={qc}>
          <StoreList />
        </Tree>,
      ),
  };
}

function names(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[0]?.textContent ?? "");
}

describe("StoreList sorting (RT-753)", () => {
  beforeEach(() => {
    listStores.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(tenant("t1"));
    listStores.mockResolvedValue({ status: 200, data: stores });
    act(() => setLocale("en"));
  });

  test("starts in the server's order with no active sort", async () => {
    renderList();
    await screen.findByText("Zamalek");
    expect(names()).toEqual(["Zamalek", "Mall 10", "Mall 2"]);
    for (const th of screen.getAllByRole("columnheader")) {
      expect(th.hasAttribute("aria-sort")).toBe(false);
    }
  });

  test("Store, Code and Status are sortable; Time zone is not", async () => {
    renderList();
    await screen.findByText("Zamalek");
    for (const name of ["Store", "Code", "Status"]) {
      expect(within(screen.getByRole("columnheader", { name })).getByRole("button")).toBeTruthy();
    }
    expect(
      within(screen.getByRole("columnheader", { name: "Time zone" })).queryByRole("button"),
    ).toBeNull();
  });

  test("pressing Store sorts by name ascending, naturally (Mall 2 before Mall 10)", async () => {
    renderList();
    await screen.findByText("Zamalek");
    fireEvent.click(screen.getByRole("button", { name: "Store" }));
    expect(names()).toEqual(["Mall 2", "Mall 10", "Zamalek"]);
    expect(screen.getByRole("columnheader", { name: "Store" }).getAttribute("aria-sort")).toBe(
      "ascending",
    );
  });

  test("pressing Store again reverses it", async () => {
    renderList();
    await screen.findByText("Zamalek");
    fireEvent.click(screen.getByRole("button", { name: "Store" }));
    fireEvent.click(screen.getByRole("button", { name: "Store" }));
    expect(names()).toEqual(["Zamalek", "Mall 10", "Mall 2"]);
    expect(screen.getByRole("columnheader", { name: "Store" }).getAttribute("aria-sort")).toBe(
      "descending",
    );
  });

  test("sorting is done in memory over the full roster: no second request", async () => {
    renderList();
    await screen.findByText("Zamalek");
    fireEvent.click(screen.getByRole("button", { name: "Code" }));
    expect(names()).toEqual(["Mall 10", "Mall 2", "Zamalek"]);
    expect(listStores).toHaveBeenCalledTimes(1);
  });

  test("Status sorts active stores before suspended ones", async () => {
    renderList();
    await screen.findByText("Zamalek");
    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    expect(names()).toEqual(["Mall 10", "Mall 2", "Zamalek"]);
  });

  test("Arabic names sort with the Arabic collation", async () => {
    act(() => setLocale("ar"));
    listStores.mockResolvedValue({
      status: 200,
      data: [
        { id: "a", code: "C", name: "مدينة نصر", is_active: true },
        { id: "b", code: "A", name: "الإسكندرية", is_active: true },
        { id: "c", code: "B", name: "القاهرة", is_active: true },
      ],
    });
    renderList();
    await screen.findByText("مدينة نصر");
    fireEvent.click(screen.getByRole("button", { name: "المتجر" }));
    expect(names()).toEqual(["الإسكندرية", "القاهرة", "مدينة نصر"]);
    act(() => setLocale("en"));
  });

  test("a different active tenant starts unsorted again (sort never leaks across scope)", async () => {
    const view = renderList();
    await screen.findByText("Zamalek");
    fireEvent.click(screen.getByRole("button", { name: "Store" }));
    expect(names()[0]).toBe("Mall 2");

    activeContext.mockReturnValue(tenant("t2"));
    view.rerenderList();
    await screen.findByText("Zamalek");
    expect(names()).toEqual(["Zamalek", "Mall 10", "Mall 2"]);
  });

  test("returning to the first tenant does not bring its old sort back", async () => {
    const view = renderList();
    await screen.findByText("Zamalek");
    fireEvent.click(screen.getByRole("button", { name: "Store" }));
    expect(names()[0]).toBe("Mall 2");

    activeContext.mockReturnValue(tenant("t2"));
    view.rerenderList();
    await screen.findByText("Zamalek");

    activeContext.mockReturnValue(tenant("t1"));
    view.rerenderList();
    await screen.findByText("Zamalek");
    expect(names()).toEqual(["Zamalek", "Mall 10", "Mall 2"]);
    expect(screen.getByRole("columnheader", { name: "Store" }).hasAttribute("aria-sort")).toBe(
      false,
    );
  });
});
