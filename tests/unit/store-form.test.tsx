import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { SAVED_NAVIGATION } from "@/shell/dirty-guard";

const createStore = vi.fn();
const updateStore = vi.fn();
const navigate = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return {
    ...actual,
    createStore: (...a: unknown[]) => createStore(...a),
    updateStore: (...a: unknown[]) => updateStore(...a),
  };
});
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigate };
});
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { createQueryClient } from "@/lib/query";
import { StoreForm } from "@/stores/StoreForm";

function renderForm(props: Parameters<typeof StoreForm>[0]): void {
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
      <StoreForm {...props} />
    </Tree>,
  );
}

const withTenant = { context: { active_tenant: { id: "t1", name: "Northstar Retail" } } };

/**
 * Store create/edit branching (T021, VG-1). No tenant picker — the active tenant
 * is shown as a read-only scope line (FR-004-005). 409 store-code conflict →
 * inline on the code field (OQ-9). 401 no-active-tenant → scope prompt, NOT a
 * sign-out (OQ-4). 403 banner; 404 uniform on update. No 422/429.
 */
describe("StoreForm create", () => {
  beforeEach(() => {
    createStore.mockReset();
    updateStore.mockReset();
    navigate.mockReset();
    activeContext.mockReturnValue(withTenant);
  });

  function submit(values: { code?: string; name?: string }) {
    if (values.code !== undefined) {
      fireEvent.change(screen.getByLabelText(/code/i), { target: { value: values.code } });
    }
    if (values.name !== undefined) {
      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: values.name } });
    }
    fireEvent.click(screen.getByRole("button", { name: /create store/i }));
  }

  test("renders the active tenant as a read-only scope line, NOT a tenant picker", () => {
    renderForm({ mode: "create" });
    // scope shown
    expect(screen.getByText(/Northstar Retail/)).toBeDefined();
    // no select / combobox for tenant
    expect(screen.queryByRole("combobox")).toBeNull();
    // only code + name inputs
    expect(screen.getByLabelText(/code/i)).toBeDefined();
    expect(screen.getByLabelText(/name/i)).toBeDefined();
  });

  test("success -> routes to the new store detail", async () => {
    createStore.mockResolvedValue({
      status: 201,
      data: { id: "s9", code: "CFC", name: "Cairo FC" },
    });
    renderForm({ mode: "create" });
    submit({ code: "CFC", name: "Cairo FC" });
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/stores/s9", { state: SAVED_NAVIGATION }),
    );
  });

  test("409 store-code conflict -> inline on the code field, no route change", async () => {
    createStore.mockResolvedValue({ status: 409, error: { error: { request_id: "r1" } } });
    renderForm({ mode: "create" });
    submit({ code: "DUP", name: "Dup Store" });
    expect(await screen.findByText(/store code is already in use/i)).toBeDefined();
    expect(screen.getByLabelText(/code/i).getAttribute("aria-invalid")).toBe("true");
    expect(navigate).not.toHaveBeenCalled();
  });

  test("401 no active tenant -> scope prompt, NOT a sign-out", async () => {
    createStore.mockResolvedValue({ status: 401 });
    renderForm({ mode: "create" });
    submit({ code: "X", name: "Y" });
    expect(await screen.findByText(/select a tenant before managing stores/i)).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  test("403 -> persistent banner with request_id", async () => {
    createStore.mockResolvedValue({ status: 403, error: { error: { request_id: "req-403" } } });
    renderForm({ mode: "create" });
    submit({ code: "X", name: "Y" });
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/req-403/)).toBeDefined();
  });
});

describe("StoreForm pre-gate", () => {
  beforeEach(() => {
    activeContext.mockReturnValue({ context: { active_tenant: null } });
    navigate.mockReset();
  });

  test("no active tenant -> scope prompt before the form is reachable", () => {
    renderForm({ mode: "create" });
    expect(screen.getByText(/select a tenant before managing stores/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /create store/i })).toBeNull();
  });
});
