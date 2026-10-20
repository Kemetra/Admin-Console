import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const listStores = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, listStores: (...a: unknown[]) => listStores(...a) };
});

// Active context provider stub — drives the pre-gate (active tenant present?).
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { StoreList } from "@/stores/StoreList";

/** Renders the list; `rerenderList` re-renders it on the same query client (a tenant switch). */
function renderList(): { rerenderList: () => void } {
  const qc = createQueryClient();
  function Tree({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  // A fresh element per render: React skips a re-render of the identical element.
  const tree = () => (
    <Tree>
      <StoreList />
    </Tree>
  );
  const view = render(tree());
  return { rerenderList: () => view.rerender(tree()) };
}

const withActiveTenant = {
  context: { active_tenant: { id: "t1", name: "Northstar Retail" } },
};
const noActiveTenant = { context: { active_tenant: null } };

const twoStores = [
  { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true, timezone: "Africa/Cairo" },
  { id: "s2", code: "NCM", name: "New Cairo Mall", is_active: false, timezone: "UTC" },
];

/**
 * Store list state matrix (T020; RT-400 screens 01–04). Pre-gates on the active
 * tenant (OQ-4): no active tenant → scope prompt, and listStores is NEVER called
 * (the scope-401 is avoided, not interpreted as a sign-out). A residual 401
 * (scope went stale) → scope prompt, still not a sign-out. Backend-scoped rows,
 * no client filter. «Add store» stays in the header in every state.
 */
describe("StoreList pre-gate + state matrix", () => {
  beforeEach(() => {
    listStores.mockReset();
    activeContext.mockReset();
  });

  test("no active tenant -> scope prompt, listStores NOT called", async () => {
    activeContext.mockReturnValue(noActiveTenant);
    renderList();
    expect(await screen.findByText(/select a tenant before managing stores/i)).toBeDefined();
    expect(listStores).not.toHaveBeenCalled();
  });

  test("active tenant + rows -> backend-scoped store table", async () => {
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 200, data: twoStores });
    renderList();
    expect(await screen.findByText("Cairo Festival City")).toBeDefined();
    expect(screen.getByText("CFC")).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Store" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeDefined();
  });

  test("RT-477: each row shows the store's time zone as its IANA identity, no UTC offset", async () => {
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 200, data: twoStores });
    renderList();
    await screen.findByText("Cairo Festival City");
    expect(screen.getByRole("columnheader", { name: "Time zone" })).toBeDefined();
    expect(screen.getByText("Cairo").closest("td")?.textContent).toBe("Cairo (Africa/Cairo)");
    expect(screen.getByText("Africa/Cairo").tagName).toBe("BDI");
    expect(screen.getByText("UTC")).toBeDefined();
    expect(screen.queryByText(/GMT|UTC[+-]|\+\d\d:\d\d/)).toBeNull();
  });

  test("RT-477: Arabic list shows «المنطقة الزمنية» and «القاهرة (Africa/Cairo)»", async () => {
    setLocale("ar");
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 200, data: twoStores });
    renderList();
    await screen.findByText("Cairo Festival City");
    expect(screen.getByRole("columnheader", { name: "المنطقة الزمنية" })).toBeDefined();
    expect(screen.getByText("القاهرة").closest("td")?.textContent).toBe("القاهرة (Africa/Cairo)");
    act(() => setLocale("en"));
  });

  test("loading -> the add action is already in the header", () => {
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockReturnValue(new Promise(() => {}));
    renderList();
    expect(screen.getByRole("link", { name: "Add store" }).getAttribute("href")).toBe(
      "/stores/new",
    );
  });

  test("active tenant + zero rows -> empty state with a next step, one add action", async () => {
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 200, data: [] });
    renderList();
    expect(await screen.findByText("No stores in this tenant yet.")).toBeDefined();
    expect(screen.getByText(/pair point-of-sale devices/i)).toBeDefined();
    expect(screen.getAllByRole("link", { name: "Add store" })).toHaveLength(1);
  });

  test("residual 401 -> scope prompt, NOT a sign-out (no banner, stays in shell)", async () => {
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 401 });
    renderList();
    expect(await screen.findByText(/select a tenant before managing stores/i)).toBeDefined();
    // not rendered as a generic error banner
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("403 -> danger banner with request_id, no reload", async () => {
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 403, error: { error: { request_id: "req-403" } } });
    renderList();
    const alert = await screen.findByRole("alert");
    expect(alert.className).toContain("rtc-alert--danger");
    expect(screen.getByText(/req-403/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Reload stores" })).toBeNull();
  });

  test("5xx -> warning banner with a title, request_id and a reload that refetches", async () => {
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 503, error: { error: { request_id: "req-503" } } });
    renderList();
    const alert = await screen.findByRole("alert");
    expect(alert.className).toContain("rtc-alert--warning");
    expect(screen.getByText("Couldn't load the store list.")).toBeDefined();
    expect(screen.getByText(/req-503/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Add store" })).toBeDefined();

    listStores.mockResolvedValue({ status: 200, data: twoStores });
    fireEvent.click(screen.getByRole("button", { name: "Reload stores" }));
    expect(await screen.findByText("Cairo Festival City")).toBeDefined();
    expect(listStores).toHaveBeenCalledTimes(2);
  });

  test("a non-banner failure (400) is an error banner, never the empty state", async () => {
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 400, error: { error: { request_id: "req-400" } } });
    renderList();
    const alert = await screen.findByRole("alert");
    expect(alert.className).toContain("rtc-alert--danger");
    expect(screen.getByText(/req-400/)).toBeDefined();
    expect(screen.queryByText("No stores in this tenant yet.")).toBeNull();
  });

  test("state badges come from the catalog and keep their CSS classes", async () => {
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 200, data: twoStores });
    renderList();
    expect(await screen.findByText("Cairo Festival City")).toBeDefined();
    expect(screen.getByText("Active").className).toContain("badge--active");
    expect(screen.getByText("Suspended").className).toContain("badge--suspended");
    expect(screen.getByText("Northstar Retail")).toBeDefined();
  });

  test("Arabic: heading, scope sub, headers, badges and primary render in Arabic", async () => {
    setLocale("ar");
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 200, data: twoStores });
    renderList();
    expect(await screen.findByText("Cairo Festival City")).toBeDefined();
    expect(screen.getByRole("heading", { name: "المتاجر" })).toBeDefined();
    // the tenant name stays as authored, isolated inside the Arabic sentence
    const tenant = screen.getByText("Northstar Retail");
    expect(tenant.tagName).toBe("BDI");
    expect(tenant.parentElement?.textContent).toBe("المتاجر في Northstar Retail");
    expect(screen.getByRole("columnheader", { name: "المتجر" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "الرمز" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "الحالة" })).toBeDefined();
    expect(screen.getByText("نشط").className).toContain("badge--active");
    expect(screen.getByText("موقوف").className).toContain("badge--suspended");
    expect(screen.getByRole("link", { name: "إضافة متجر" })).toBeDefined();
    expect(screen.queryByText("Stores")).toBeNull();
    expect(screen.queryByText("Active")).toBeNull();
    expect(screen.queryByRole("link", { name: /add store/i })).toBeNull();
  });

  test("Arabic: empty state renders in Arabic", async () => {
    setLocale("ar");
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 200, data: [] });
    renderList();
    expect(await screen.findByText("لا توجد متاجر في هذه المؤسسة بعد.")).toBeDefined();
    expect(screen.getByText("أضف أول متجر لتتمكن من إقران نقاط البيع.")).toBeDefined();
    expect(screen.getByRole("link", { name: "إضافة متجر" })).toBeDefined();
  });

  test("Arabic: 5xx renders the Arabic title and reload", async () => {
    setLocale("ar");
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 500 });
    renderList();
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText("تعذّر تحميل قائمة المتاجر.")).toBeDefined();
    expect(screen.getByRole("button", { name: "إعادة تحميل المتاجر" })).toBeDefined();
  });

  test("Arabic: no active tenant -> Arabic scope prompt", async () => {
    setLocale("ar");
    activeContext.mockReturnValue(noActiveTenant);
    renderList();
    expect(await screen.findByText(/^اختر مؤسسة قبل إدارة المتاجر\./)).toBeDefined();
    expect(screen.getByRole("heading", { name: "المتاجر" })).toBeDefined();
    expect(screen.queryByText(/select a tenant/i)).toBeNull();
  });
});

/**
 * RT-753 (UX-10) — the reference consumer of the shared DataTable sort. The
 * roster is a COMPLETE set (GET /api/v1/stores takes no cursor, limit or cap),
 * so ordering it in memory is dataset-level, not viewport-level. Default order
 * stays the server's until the user sorts; the sort never outlives the tenant.
 */
const sortStores = [
  { id: "s1", code: "ZMK", name: "Zamalek", is_active: false },
  { id: "s2", code: "ALX", name: "Mall 10", is_active: true },
  { id: "s3", code: "MAD", name: "Mall 2", is_active: true },
];
const tenantOf = (id: string) => ({ context: { active_tenant: { id, name: `Tenant ${id}` } } });

function storeNames(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[0]?.textContent ?? "");
}

const pressSort = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const hasAriaSort = (name: string) =>
  screen.getByRole("columnheader", { name }).hasAttribute("aria-sort");

describe("StoreList sorting (RT-753)", () => {
  beforeEach(() => {
    listStores.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(tenantOf("t1"));
    listStores.mockResolvedValue({ status: 200, data: sortStores });
    act(() => setLocale("en"));
  });

  test("starts in the server's order with no active sort", async () => {
    renderList();
    await screen.findByText("Zamalek");
    expect(storeNames()).toEqual(["Zamalek", "Mall 10", "Mall 2"]);
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

  test("Store sorts by name ascending, naturally, then descending on a second press", async () => {
    renderList();
    await screen.findByText("Zamalek");
    pressSort("Store");
    expect(storeNames()).toEqual(["Mall 2", "Mall 10", "Zamalek"]);
    expect(screen.getByRole("columnheader", { name: "Store" }).getAttribute("aria-sort")).toBe(
      "ascending",
    );
    pressSort("Store");
    expect(storeNames()).toEqual(["Zamalek", "Mall 10", "Mall 2"]);
    expect(screen.getByRole("columnheader", { name: "Store" }).getAttribute("aria-sort")).toBe(
      "descending",
    );
  });

  test("sorting is done in memory over the full roster: no second request", async () => {
    renderList();
    await screen.findByText("Zamalek");
    pressSort("Code");
    expect(storeNames()).toEqual(["Mall 10", "Mall 2", "Zamalek"]);
    expect(listStores).toHaveBeenCalledTimes(1);
  });

  test("Status sorts active stores before suspended ones", async () => {
    renderList();
    await screen.findByText("Zamalek");
    pressSort("Status");
    expect(storeNames()).toEqual(["Mall 10", "Mall 2", "Zamalek"]);
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
    pressSort("المتجر");
    expect(storeNames()).toEqual(["الإسكندرية", "القاهرة", "مدينة نصر"]);
    act(() => setLocale("en"));
  });

  test("a different active tenant starts unsorted again (sort never leaks across scope)", async () => {
    const view = renderList();
    await screen.findByText("Zamalek");
    pressSort("Store");
    expect(storeNames()[0]).toBe("Mall 2");

    activeContext.mockReturnValue(tenantOf("t2"));
    view.rerenderList();
    await screen.findByText("Zamalek");
    expect(storeNames()).toEqual(["Zamalek", "Mall 10", "Mall 2"]);
  });

  test("returning to the first tenant does not bring its old sort back", async () => {
    const view = renderList();
    await screen.findByText("Zamalek");
    pressSort("Store");

    activeContext.mockReturnValue(tenantOf("t2"));
    view.rerenderList();
    await screen.findByText("Zamalek");

    activeContext.mockReturnValue(tenantOf("t1"));
    view.rerenderList();
    await screen.findByText("Zamalek");
    expect(storeNames()).toEqual(["Zamalek", "Mall 10", "Mall 2"]);
    expect(hasAriaSort("Store")).toBe(false);
  });
});
