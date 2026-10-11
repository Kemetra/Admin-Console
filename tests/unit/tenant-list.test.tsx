import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the RF-2 data layer at the wrapper boundary (no live DP2; FR-004-012).
const listTenants = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, listTenants: (...a: unknown[]) => listTenants(...a) };
});

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { TenantList } from "@/tenants/TenantList";

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
      <TenantList />
    </Tree>,
  );
}

/**
 * Tenant list state matrix (T011, VG-1). Renders the BACKEND-SCOPED set with no
 * client filter (OQ-2); zero rows is a successful empty state distinct from
 * loading/error (OQ-8); 403 renders via the persistent banner (no pre-hide,
 * OQ-3); the "New tenant" primary is always rendered (never role-hidden).
 */
describe("TenantList state matrix", () => {
  beforeEach(() => {
    listTenants.mockReset();
  });

  test("loading -> shows a loading affordance, distinct from empty", async () => {
    listTenants.mockReturnValue(new Promise(() => {})); // never resolves
    renderList();
    expect(await screen.findByText(/loading tenants/i)).toBeDefined();
  });

  test("success -> renders the backend-scoped rows as a table (no client filter)", async () => {
    listTenants.mockResolvedValue({
      status: 200,
      data: [
        { id: "t1", slug: "northstar", name: "Northstar Retail" },
        { id: "t2", slug: "helios", name: "Helios Markets" },
      ],
    });
    renderList();
    expect(await screen.findByText("Northstar Retail")).toBeDefined();
    expect(screen.getByText("Helios Markets")).toBeDefined();
    expect(screen.getByText("northstar")).toBeDefined();
    // create entry point always present (never role-hidden, OQ-3)
    expect(screen.getByRole("link", { name: /new tenant/i })).toBeDefined();
  });

  test("empty -> successful zero-row state with create entry point", async () => {
    listTenants.mockResolvedValue({ status: 200, data: [] });
    renderList();
    expect(await screen.findByText(/no tenants yet/i)).toBeDefined();
    expect(screen.getByRole("link", { name: /new tenant/i })).toBeDefined();
  });

  test("403 -> persistent banner with request_id (action attempted, not pre-blocked)", async () => {
    listTenants.mockResolvedValue({
      status: 403,
      error: { error: { request_id: "req-403" } },
    });
    renderList();
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/permission/i)).toBeDefined();
    expect(screen.getByText(/req-403/)).toBeDefined();
  });

  test("5xx -> retryable banner", async () => {
    listTenants.mockResolvedValue({ status: 503, error: { error: { request_id: "req-503" } } });
    renderList();
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/try again/i)).toBeDefined();
  });

  test("5xx retry button refetches; success on retry renders the rows", async () => {
    listTenants
      .mockResolvedValueOnce({ status: 503, error: { error: { request_id: "req-503" } } })
      .mockResolvedValueOnce({
        status: 200,
        data: [{ id: "t1", slug: "northstar", name: "Northstar Retail" }],
      });
    renderList();
    const retry = await screen.findByRole("button", { name: /retry/i });
    fireEvent.click(retry);
    expect(await screen.findByText("Northstar Retail")).toBeDefined();
    expect(listTenants).toHaveBeenCalledTimes(2);
  });

  test("Arabic: heading, primary and headers render in Arabic; data stays as authored", async () => {
    setLocale("ar");
    listTenants.mockResolvedValue({
      status: 200,
      data: [{ id: "t1", slug: "northstar", name: "Northstar Retail" }],
    });
    renderList();
    expect(await screen.findByText("Northstar Retail")).toBeDefined();
    expect(screen.getByRole("heading", { name: "المؤسسات" })).toBeDefined();
    expect(screen.getByText("كل المؤسسات التي يمكنك إدارتها.")).toBeDefined();
    expect(screen.getByRole("link", { name: "إضافة مؤسسة" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "الاسم" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "المعرّف المختصر" })).toBeDefined();
    expect(screen.queryByText("Tenants")).toBeNull();
    expect(screen.queryByRole("link", { name: /new tenant/i })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Slug" })).toBeNull();
  });

  test("Arabic: empty state renders in Arabic", async () => {
    setLocale("ar");
    listTenants.mockResolvedValue({ status: 200, data: [] });
    renderList();
    expect(await screen.findByText("لا توجد مؤسسات بعد.")).toBeDefined();
    expect(screen.getByRole("link", { name: "إضافة مؤسسة" })).toBeDefined();
  });

  test("a cached error re-renders in the new locale on a switch (key, not copy, is cached)", async () => {
    listTenants.mockResolvedValue({ status: 503, error: { error: { request_id: "req-503" } } });
    renderList();
    expect(await screen.findByText("Something went wrong. Try again.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
    act(() => setLocale("ar"));
    expect(await screen.findByText("حدث خطأ ما. حاول مرة أخرى.")).toBeDefined();
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeDefined();
    expect(screen.queryByText("Something went wrong. Try again.")).toBeNull();
    expect(listTenants).toHaveBeenCalledTimes(1);
  });
});
