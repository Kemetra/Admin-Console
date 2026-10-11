import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const readStore = vi.fn();
const softDeleteStore = vi.fn();
const navigate = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return {
    ...actual,
    readStore: (...a: unknown[]) => readStore(...a),
    softDeleteStore: (...a: unknown[]) => softDeleteStore(...a),
  };
});
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigate, useParams: () => ({ storeId: "s1" }) };
});
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => ({
    context: { active_tenant: { id: "t1", name: "Northstar Retail" } },
  }),
}));

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { StoreDetail } from "@/stores/StoreDetail";

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
      <StoreDetail />
    </Tree>,
  );
}

/**
 * Store detail (T027, VG-1). Read-first; active-state badge; edit + soft-delete
 * for all (403 on attempt). 404 uniform (FR-004-008). A scope-401 renders the
 * scope prompt, not a sign-out (OQ-4). Soft-delete behind a named inline confirm.
 */
describe("StoreDetail", () => {
  beforeEach(() => {
    readStore.mockReset();
    softDeleteStore.mockReset();
    navigate.mockReset();
  });

  test("success -> field rows + state badge + actions", async () => {
    readStore.mockResolvedValue({
      status: 200,
      data: { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true },
    });
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Cairo Festival City" })).toBeDefined();
    expect(screen.getByText("CFC")).toBeDefined();
    expect(screen.getByText("active")).toBeDefined();
    expect(screen.getByRole("link", { name: /edit/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /soft-delete/i })).toBeDefined();
  });

  test("404 -> uniform not-available with a way back", async () => {
    readStore.mockResolvedValue({ status: 404 });
    renderDetail();
    expect(await screen.findByText(/not available/i)).toBeDefined();
    // The back arrow is decorative (aria-hidden): the accessible name is the label.
    expect(screen.getByRole("link", { name: "Back to stores" })).toBeDefined();
  });

  test("scope-401 -> scope prompt, not a sign-out", async () => {
    readStore.mockResolvedValue({ status: 401 });
    renderDetail();
    expect(await screen.findByText(/select a tenant before managing stores/i)).toBeDefined();
  });

  test("soft-delete -> named confirm, then routes back on success", async () => {
    readStore.mockResolvedValue({
      status: 200,
      data: { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true },
    });
    softDeleteStore.mockResolvedValue({ status: 204 });
    renderDetail();
    await screen.findByRole("heading", { name: "Cairo Festival City" });
    fireEvent.click(screen.getByRole("button", { name: /soft-delete/i }));
    const region = await screen.findByRole("region", { name: /confirm: soft-delete/i });
    expect(region.textContent).toMatch(/Cairo Festival City/);
    const btns = screen.getAllByRole("button", { name: /soft-delete/i });
    fireEvent.click(btns[btns.length - 1]);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/stores"));
  });

  test("Arabic: labels, state badge and actions render in Arabic", async () => {
    setLocale("ar");
    readStore.mockResolvedValue({
      status: 200,
      data: { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: false },
    });
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Cairo Festival City" })).toBeDefined();
    expect(screen.getByText("الرمز")).toBeDefined();
    expect(screen.getByText("معرّف المتجر")).toBeDefined();
    expect(screen.getByText("غير نشط").className).toContain("badge--suspended");
    expect(screen.getByText("CFC")).toBeDefined();
    expect(screen.getByRole("link", { name: "العودة إلى المتاجر" })).toBeDefined();
    expect(screen.getByRole("link", { name: "تعديل" })).toBeDefined();
    expect(screen.getByRole("button", { name: "حذف" })).toBeDefined();
    expect(screen.queryByText("inactive")).toBeNull();
    expect(screen.queryByRole("button", { name: /soft-delete/i })).toBeNull();
  });

  test("Arabic: 404 renders the uniform not-available copy", async () => {
    setLocale("ar");
    readStore.mockResolvedValue({ status: 404 });
    renderDetail();
    expect(await screen.findByText("هذا العنصر غير متاح.")).toBeDefined();
    expect(screen.getByRole("link", { name: "العودة إلى المتاجر" })).toBeDefined();
  });
});
