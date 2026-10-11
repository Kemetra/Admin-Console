import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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

function renderList(): void {
  const qc = createQueryClient();
  function Tree({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  render(
    <Tree>
      <StoreList />
    </Tree>,
  );
}

const withActiveTenant = {
  context: { active_tenant: { id: "t1", name: "Northstar Retail" } },
};
const noActiveTenant = { context: { active_tenant: null } };

/**
 * Store list state matrix (T020, VG-1). Pre-gates on the active tenant (OQ-4):
 * no active tenant → scope prompt, and listStores is NEVER called (the scope-401
 * is avoided, not interpreted as a sign-out). A residual 401 (scope went stale)
 * → scope prompt, still not a sign-out. Backend-scoped rows, no client filter.
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
    listStores.mockResolvedValue({
      status: 200,
      data: [
        { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true },
        { id: "s2", code: "NMC", name: "New Cairo Mall", is_active: true },
      ],
    });
    renderList();
    expect(await screen.findByText("Cairo Festival City")).toBeDefined();
    expect(screen.getByText("CFC")).toBeDefined();
  });

  test("active tenant + zero rows -> empty state with create entry point", async () => {
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 200, data: [] });
    renderList();
    expect(await screen.findByText(/no stores/i)).toBeDefined();
    expect(screen.getByRole("link", { name: /new store/i })).toBeDefined();
  });

  test("residual 401 -> scope prompt, NOT a sign-out (no banner, stays in shell)", async () => {
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 401 });
    renderList();
    expect(await screen.findByText(/select a tenant before managing stores/i)).toBeDefined();
    // not rendered as a generic error banner
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("403 -> persistent banner with request_id", async () => {
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 403, error: { error: { request_id: "req-403" } } });
    renderList();
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/req-403/)).toBeDefined();
  });

  test("state badges come from the catalog and keep their CSS classes", async () => {
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({
      status: 200,
      data: [
        { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true },
        { id: "s2", code: "NCM", name: "New Cairo Mall", is_active: false },
      ],
    });
    renderList();
    expect(await screen.findByText("Cairo Festival City")).toBeDefined();
    expect(screen.getByText("active").className).toContain("badge--active");
    expect(screen.getByText("inactive").className).toContain("badge--suspended");
    expect(screen.getByText("Northstar Retail")).toBeDefined();
  });

  test("Arabic: heading, scope sub, headers, badges and primary render in Arabic", async () => {
    setLocale("ar");
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({
      status: 200,
      data: [
        { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true },
        { id: "s2", code: "NCM", name: "New Cairo Mall", is_active: false },
      ],
    });
    renderList();
    expect(await screen.findByText("Cairo Festival City")).toBeDefined();
    expect(screen.getByRole("heading", { name: "المتاجر" })).toBeDefined();
    // the tenant name stays as authored, isolated inside the Arabic sentence
    const tenant = screen.getByText("Northstar Retail");
    expect(tenant.tagName).toBe("BDI");
    expect(tenant.parentElement?.textContent).toBe("المتاجر في Northstar Retail.");
    expect(screen.getByRole("columnheader", { name: "الرمز" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "الحالة" })).toBeDefined();
    expect(screen.getByText("نشط").className).toContain("badge--active");
    expect(screen.getByText("غير نشط").className).toContain("badge--suspended");
    expect(screen.getByRole("link", { name: "إضافة متجر" })).toBeDefined();
    expect(screen.queryByText("Stores")).toBeNull();
    expect(screen.queryByText("active")).toBeNull();
    expect(screen.queryByRole("link", { name: /new store/i })).toBeNull();
  });

  test("Arabic: empty state and scope prompt render in Arabic", async () => {
    setLocale("ar");
    activeContext.mockReturnValue(withActiveTenant);
    listStores.mockResolvedValue({ status: 200, data: [] });
    renderList();
    expect(await screen.findByText(/^لا توجد متاجر في .*Northstar Retail.* بعد\.$/)).toBeDefined();
    expect(screen.getByRole("link", { name: "إضافة متجر" })).toBeDefined();
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
