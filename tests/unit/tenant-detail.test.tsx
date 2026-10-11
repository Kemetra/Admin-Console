import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const readTenant = vi.fn();
const softDeleteTenant = vi.fn();
const navigate = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return {
    ...actual,
    readTenant: (...a: unknown[]) => readTenant(...a),
    softDeleteTenant: (...a: unknown[]) => softDeleteTenant(...a),
  };
});
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigate, useParams: () => ({ tenantId: "t1" }) };
});

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { TenantDetail } from "@/tenants/TenantDetail";

function renderDetail(): void {
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
      <TenantDetail />
    </Tree>,
  );
}

/**
 * Tenant detail (T017, VG-1). Read-first; status as a display-only badge;
 * edit + soft-delete rendered for all (403 on attempt, never pre-hidden). 404
 * renders uniformly (FR-004-008). Soft-delete is behind an inline confirm that
 * names the resource, then re-fetches the list and routes back (S8).
 */
describe("TenantDetail", () => {
  beforeEach(() => {
    readTenant.mockReset();
    softDeleteTenant.mockReset();
    navigate.mockReset();
  });

  test("success -> renders field rows + status badge + actions", async () => {
    readTenant.mockResolvedValue({
      status: 200,
      data: { id: "t1", slug: "northstar", name: "Northstar Retail", status: "active" },
    });
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Northstar Retail" })).toBeDefined();
    expect(screen.getByText("northstar")).toBeDefined();
    expect(screen.getByText("active")).toBeDefined();
    expect(screen.getByRole("link", { name: /edit/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /soft-delete/i })).toBeDefined();
  });

  test("404 -> uniform not-available with a way back", async () => {
    readTenant.mockResolvedValue({ status: 404 });
    renderDetail();
    expect(await screen.findByText(/not available/i)).toBeDefined();
    // The back arrow is decorative (aria-hidden): the accessible name is the label.
    expect(screen.getByRole("link", { name: "Back to tenants" })).toBeDefined();
  });

  test("soft-delete -> confirm names the resource, then routes back on success", async () => {
    readTenant.mockResolvedValue({
      status: 200,
      data: { id: "t1", slug: "northstar", name: "Northstar Retail", status: "active" },
    });
    softDeleteTenant.mockResolvedValue({ status: 204 });
    renderDetail();
    await screen.findByRole("heading", { name: "Northstar Retail" });
    fireEvent.click(screen.getByRole("button", { name: /soft-delete/i }));
    // inline confirm region names the resource
    const confirmRegion = await screen.findByRole("region", { name: /confirm: soft-delete/i });
    expect(confirmRegion.textContent).toMatch(/Northstar Retail/);
    // confirm via the button inside the confirm region
    const confirmBtns = screen.getAllByRole("button", { name: /soft-delete/i });
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/tenants"));
  });

  test("Arabic: labels, status badge and actions render in Arabic", async () => {
    setLocale("ar");
    readTenant.mockResolvedValue({
      status: 200,
      data: { id: "t1", slug: "northstar", name: "Northstar Retail", status: "suspended" },
    });
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Northstar Retail" })).toBeDefined();
    expect(screen.getByText("المعرّف المختصر")).toBeDefined();
    expect(screen.getByText("الحالة")).toBeDefined();
    expect(screen.getByText("معرّف المؤسسة")).toBeDefined();
    // the status code drives the label; the badge keeps its CSS class
    const badge = screen.getByText("معلّقة");
    expect(badge.className).toContain("badge--suspended");
    expect(screen.queryByText("suspended")).toBeNull();
    expect(screen.getByRole("link", { name: "تعديل" })).toBeDefined();
    expect(screen.getByRole("button", { name: "حذف" })).toBeDefined();
    expect(screen.queryByRole("button", { name: /soft-delete/i })).toBeNull();
  });

  test("Arabic: 404 renders the uniform not-available copy with an Arabic back link", async () => {
    setLocale("ar");
    readTenant.mockResolvedValue({ status: 404 });
    renderDetail();
    expect(await screen.findByText("هذا العنصر غير متاح.")).toBeDefined();
    expect(screen.getByRole("link", { name: "العودة إلى المؤسسات" })).toBeDefined();
  });
});
