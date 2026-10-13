import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const readStore = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, readStore: (...a: unknown[]) => readStore(...a) };
});
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useParams: () => ({ storeId: "s1" }) };
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
 * Store detail (T027; RT-400 screen 19). Read-first; state badge; «Edit store»
 * for everyone (403 on attempt). No delete or closure action (decision 194).
 * 404 uniform (FR-004-008). A scope-401 renders the scope prompt, not a
 * sign-out (OQ-4).
 */
describe("StoreDetail", () => {
  beforeEach(() => {
    readStore.mockReset();
  });

  test("success -> field rows, state badge and the edit action, no delete", async () => {
    readStore.mockResolvedValue({
      status: 200,
      data: { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true },
    });
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Cairo Festival City" })).toBeDefined();
    expect(screen.getByText("CFC")).toBeDefined();
    expect(screen.getByText("Active").className).toContain("badge--active");
    expect(screen.getByRole("link", { name: "Edit store" }).getAttribute("href")).toBe(
      "/stores/s1/edit",
    );
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  test("404 -> uniform not-available with a way back", async () => {
    readStore.mockResolvedValue({ status: 404 });
    renderDetail();
    expect(await screen.findByText(/not available/i)).toBeDefined();
    // The back arrow is decorative (aria-hidden): the accessible name is the label.
    expect(screen.getByRole("link", { name: "Back to stores" })).toBeDefined();
  });

  test("403 -> danger banner with the request reference", async () => {
    readStore.mockResolvedValue({ status: 403, error: { error: { request_id: "req-403" } } });
    renderDetail();
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByText(/req-403/)).toBeDefined();
  });

  test("scope-401 -> scope prompt, not a sign-out", async () => {
    readStore.mockResolvedValue({ status: 401 });
    renderDetail();
    expect(await screen.findByText(/select a tenant before managing stores/i)).toBeDefined();
  });

  test("Arabic: labels, suspended badge and the edit action render in Arabic", async () => {
    setLocale("ar");
    readStore.mockResolvedValue({
      status: 200,
      data: { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: false },
    });
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Cairo Festival City" })).toBeDefined();
    expect(screen.getByText("الرمز")).toBeDefined();
    expect(screen.getByText("معرّف المتجر")).toBeDefined();
    expect(screen.getByText("موقوف").className).toContain("badge--suspended");
    expect(screen.getByText("CFC")).toBeDefined();
    expect(screen.getByRole("link", { name: "تعديل المتجر" })).toBeDefined();
    expect(screen.queryByRole("button", { name: /حذف/ })).toBeNull();
    expect(screen.queryByText("Suspended")).toBeNull();
  });

  test("Arabic: 404 renders the uniform not-available copy", async () => {
    setLocale("ar");
    readStore.mockResolvedValue({ status: 404 });
    renderDetail();
    expect(await screen.findByText("هذا العنصر غير متاح.")).toBeDefined();
    expect(screen.getByRole("link", { name: "العودة إلى المتاجر" })).toBeDefined();
  });
});
