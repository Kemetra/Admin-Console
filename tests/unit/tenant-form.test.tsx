import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { SAVED_NAVIGATION } from "@/shell/dirty-guard";

const createTenant = vi.fn();
const updateTenant = vi.fn();
const navigate = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return {
    ...actual,
    createTenant: (...a: unknown[]) => createTenant(...a),
    updateTenant: (...a: unknown[]) => updateTenant(...a),
  };
});
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigate };
});

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { TenantForm } from "@/tenants/TenantForm";

function renderForm(props: Parameters<typeof TenantForm>[0]): void {
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
      <TenantForm {...props} />
    </Tree>,
  );
}

/**
 * Tenant create/edit branching (T012, VG-1). Uncontrolled native form (R4-3);
 * no client-side validation. Success routes to the affected detail; 409 slug
 * conflict renders INLINE on the slug field; 403 renders via the persistent
 * banner; 404 on update renders uniform. No 422/429 (contract documents none).
 */
describe("TenantForm create", () => {
  beforeEach(() => {
    createTenant.mockReset();
    updateTenant.mockReset();
    navigate.mockReset();
  });

  function submit(values: { slug?: string; name?: string }) {
    if (values.slug !== undefined) {
      fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: values.slug } });
    }
    if (values.name !== undefined) {
      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: values.name } });
    }
    fireEvent.click(screen.getByRole("button", { name: /create tenant/i }));
  }

  test("success -> routes to the new tenant detail", async () => {
    createTenant.mockResolvedValue({ status: 201, data: { id: "t9", slug: "acme", name: "Acme" } });
    renderForm({ mode: "create" });
    submit({ slug: "acme", name: "Acme" });
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/tenants/t9", { state: SAVED_NAVIGATION }),
    );
  });

  test("409 slug conflict -> inline error on the slug field, no route change", async () => {
    createTenant.mockResolvedValue({ status: 409, error: { error: { request_id: "r1" } } });
    renderForm({ mode: "create" });
    submit({ slug: "taken", name: "Dup" });
    expect(await screen.findByText(/slug is already in use/i)).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
    // inline, not banner: the slug input is marked invalid
    expect(screen.getByLabelText(/slug/i).getAttribute("aria-invalid")).toBe("true");
  });

  test("403 -> persistent banner with request_id, no route change", async () => {
    createTenant.mockResolvedValue({ status: 403, error: { error: { request_id: "req-403" } } });
    renderForm({ mode: "create" });
    submit({ slug: "x", name: "Y" });
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/req-403/)).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  test("submit is disabled while the create is in flight", async () => {
    createTenant.mockReturnValue(new Promise(() => {}));
    renderForm({ mode: "create" });
    submit({ slug: "a", name: "B" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /create tenant/i }).hasAttribute("disabled")).toBe(
        true,
      ),
    );
  });
});

describe("TenantForm edit", () => {
  beforeEach(() => {
    createTenant.mockReset();
    updateTenant.mockReset();
    navigate.mockReset();
  });

  test("404 on update -> uniform not-available, no route change", async () => {
    updateTenant.mockResolvedValue({ status: 404 });
    renderForm({
      mode: "edit",
      tenantId: "t1",
      initial: { slug: "northstar", name: "Northstar Retail" },
    });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/not available/i)).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  test("edit prefills the backend values; slug is read-only on edit", () => {
    renderForm({
      mode: "edit",
      tenantId: "t1",
      initial: { slug: "northstar", name: "Northstar Retail" },
    });
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe("Northstar Retail");
  });
});

describe("TenantForm Arabic", () => {
  beforeEach(() => {
    createTenant.mockReset();
    updateTenant.mockReset();
    navigate.mockReset();
  });

  test("create form renders in Arabic; the inline slug conflict follows a locale switch", async () => {
    setLocale("ar");
    createTenant.mockResolvedValue({ status: 409, error: { error: { request_id: "r1" } } });
    renderForm({ mode: "create" });
    expect(screen.getByRole("heading", { name: "مؤسسة جديدة" })).toBeDefined();
    expect(screen.getByRole("button", { name: "إلغاء" })).toBeDefined();
    expect(screen.queryByRole("button", { name: /create tenant/i })).toBeNull();
    fireEvent.change(screen.getByLabelText("المعرّف المختصر"), { target: { value: "taken" } });
    fireEvent.change(screen.getByLabelText("الاسم"), { target: { value: "Dup" } });
    fireEvent.click(screen.getByRole("button", { name: "إضافة المؤسسة" }));
    expect(
      await screen.findByText("هذا المعرّف المختصر مستخدم بالفعل. اختر معرّفًا آخر."),
    ).toBeDefined();
    // the error is held as a catalog key, so a switch re-renders it
    act(() => setLocale("en"));
    expect(
      await screen.findByText("That slug is already in use. Choose a different one."),
    ).toBeDefined();
    expect(screen.getByRole("heading", { name: "New tenant" })).toBeDefined();
  });

  test("edit form renders its Arabic title and save action", () => {
    setLocale("ar");
    renderForm({
      mode: "edit",
      tenantId: "t1",
      initial: { slug: "northstar", name: "Northstar Retail" },
    });
    expect(screen.getByRole("heading", { name: "تعديل المؤسسة" })).toBeDefined();
    expect(screen.getByRole("button", { name: "حفظ التغييرات" })).toBeDefined();
  });
});
