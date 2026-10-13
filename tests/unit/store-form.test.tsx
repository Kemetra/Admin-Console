import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { SAVED_NAVIGATION } from "@/shell/dirty-guard";

const createStore = vi.fn();
const updateStore = vi.fn();
const readStore = vi.fn();
const navigate = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return {
    ...actual,
    createStore: (...a: unknown[]) => createStore(...a),
    updateStore: (...a: unknown[]) => updateStore(...a),
    readStore: (...a: unknown[]) => readStore(...a),
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

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { StoreForm } from "@/stores/StoreForm";
import { StoreFormRoute } from "@/stores/StoreFormRoute";

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
const cfc = { code: "CFC", name: "Cairo Festival City", is_active: true };

/**
 * Store create/edit branching (T021; RT-400 screens 16 and 17). No tenant
 * picker — the active tenant is shown as a read-only scope line on create
 * (FR-004-005). 409 store-code conflict → inline on the code field (OQ-9). 401
 * no-active-tenant → scope prompt, NOT a sign-out (OQ-4). 403 banner; 404
 * uniform on update. Edit saves the name only; the V1 `is_active` flag has its
 * own «Suspend / Activate store» control.
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
      fireEvent.change(screen.getByLabelText(/store code/i), { target: { value: values.code } });
    }
    if (values.name !== undefined) {
      fireEvent.change(screen.getByLabelText(/store name/i), { target: { value: values.name } });
    }
    fireEvent.click(screen.getByRole("button", { name: /create store/i }));
  }

  test("renders the active tenant as a read-only scope line, NOT a tenant picker", () => {
    renderForm({ mode: "create" });
    expect(screen.getByRole("heading", { name: "Add store" })).toBeDefined();
    expect(screen.getByText(/Northstar Retail/)).toBeDefined();
    expect(screen.queryByRole("combobox")).toBeNull();
    // only name + code inputs, both marked required, code editable with its hint
    const name = screen.getByLabelText(/store name/i);
    const code = screen.getByLabelText(/store code/i);
    expect(name.getAttribute("aria-required")).toBe("true");
    expect(code.getAttribute("aria-required")).toBe("true");
    expect(code.hasAttribute("readonly")).toBe(false);
    expect(code.getAttribute("aria-describedby")).toBe("store-code-hint");
    expect(screen.getByText("The code can't be changed after the store is created.")).toBeDefined();
    expect(screen.queryByLabelText("Store ID")).toBeNull();
    expect(screen.queryByRole("button", { name: /suspend store/i })).toBeNull();
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
    expect(createStore).toHaveBeenCalledWith({ code: "CFC", name: "Cairo FC" });
  });

  test("409 store-code conflict -> inline on the code field, no route change", async () => {
    createStore.mockResolvedValue({ status: 409, error: { error: { request_id: "r1" } } });
    renderForm({ mode: "create" });
    submit({ code: "DUP", name: "Dup Store" });
    expect(await screen.findByText(/store code is already in use/i)).toBeDefined();
    const code = screen.getByLabelText(/store code/i);
    expect(code.getAttribute("aria-invalid")).toBe("true");
    expect(code.getAttribute("aria-describedby")).toBe("store-code-hint store-code-error");
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

  test("an undocumented 400 still reaches the banner, never a silent failure", async () => {
    createStore.mockResolvedValue({ status: 400, error: { error: { request_id: "req-400" } } });
    renderForm({ mode: "create" });
    submit({ code: "", name: "" });
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/req-400/)).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("StoreForm edit", () => {
  beforeEach(() => {
    createStore.mockReset();
    updateStore.mockReset();
    navigate.mockReset();
    activeContext.mockReturnValue(withTenant);
  });

  test("renders the store name in the title, read-only code and store ID, no scope line", () => {
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    expect(screen.getByRole("heading", { name: "Edit Cairo Festival City" })).toBeDefined();
    expect((screen.getByLabelText(/store name/i) as HTMLInputElement).value).toBe(
      "Cairo Festival City",
    );
    const code = screen.getByLabelText(/store code/i) as HTMLInputElement;
    expect(code.value).toBe("CFC");
    expect(code.hasAttribute("readonly")).toBe(true);
    expect(code.getAttribute("aria-required")).toBeNull();
    const id = screen.getByLabelText("Store ID") as HTMLInputElement;
    expect(id.value).toBe("s1");
    expect(id.hasAttribute("readonly")).toBe(true);
    expect(screen.queryByText(/will be created in/i)).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel editing" })).toBeDefined();
  });

  test("save sends the name only, then routes to the store detail", async () => {
    updateStore.mockResolvedValue({ status: 200, data: { id: "s1" } });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    fireEvent.change(screen.getByLabelText(/store name/i), { target: { value: "CFC Mall" } });
    fireEvent.click(screen.getByRole("button", { name: "Save store" }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/stores/s1", { state: SAVED_NAVIGATION }),
    );
    expect(updateStore).toHaveBeenCalledWith("s1", { name: "CFC Mall" });
  });

  test("403 on save -> the edit-denied banner with request_id, no route change", async () => {
    updateStore.mockResolvedValue({ status: 403, error: { error: { request_id: "req-403" } } });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    fireEvent.click(screen.getByRole("button", { name: "Save store" }));
    const alert = await screen.findByRole("alert");
    expect(alert.className).toContain("rtc-alert--danger");
    expect(screen.getByText("You don't have permission to edit this store.")).toBeDefined();
    expect(screen.getByText(/Nothing changed\./)).toBeDefined();
    expect(screen.getByText(/req-403/)).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  test("404 on save -> uniform not-available banner", async () => {
    updateStore.mockResolvedValue({ status: 404 });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    fireEvent.click(screen.getByRole("button", { name: "Save store" }));
    expect(await screen.findByText(/not available/i)).toBeDefined();
  });

  test("«Suspend store» asks first, naming the store; confirming sends is_active=false", async () => {
    updateStore.mockResolvedValue({ status: 200, data: { ...cfc, id: "s1", is_active: false } });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    expect(screen.getByRole("heading", { name: "Store status" })).toBeDefined();
    expect(screen.getByText("Active").className).toContain("badge--active");
    fireEvent.click(screen.getByRole("button", { name: "Suspend store" }));
    const confirm = screen.getByRole("region", { name: "Confirm: suspend store" });
    expect(confirm.textContent).toContain("Suspend Cairo Festival City?");
    expect(updateStore).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: "Suspend store" }));
    await waitFor(() => expect(updateStore).toHaveBeenCalledWith("s1", { is_active: false }));
    await waitFor(() => expect(screen.queryByRole("region", { name: /confirm/i })).toBeNull());
    expect(navigate).not.toHaveBeenCalled();
  });

  test("cancelling the suspend confirm sends nothing", () => {
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    fireEvent.click(screen.getByRole("button", { name: "Suspend store" }));
    const confirm = screen.getByRole("region", { name: "Confirm: suspend store" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("region", { name: /confirm/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Suspend store" })).toBeDefined();
    expect(updateStore).not.toHaveBeenCalled();
  });

  test("suspended store -> «Activate store» sends is_active=true", async () => {
    updateStore.mockResolvedValue({ status: 200, data: { id: "s1" } });
    renderForm({ mode: "edit", storeId: "s1", initial: { ...cfc, is_active: false } });
    expect(screen.getByText("Suspended").className).toContain("badge--suspended");
    expect(screen.queryByRole("button", { name: "Suspend store" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Activate store" }));
    await waitFor(() => expect(updateStore).toHaveBeenCalledWith("s1", { is_active: true }));
  });

  test("403 on the status change -> the edit-denied banner", async () => {
    updateStore.mockResolvedValue({ status: 403, error: { error: { request_id: "req-9" } } });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    fireEvent.click(screen.getByRole("button", { name: "Suspend store" }));
    const confirm = screen.getByRole("region", { name: "Confirm: suspend store" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Suspend store" }));
    expect(await screen.findByText("You don't have permission to edit this store.")).toBeDefined();
    expect(screen.getByText(/req-9/)).toBeDefined();
  });

  test("a non-403 non-retryable failure never shows the permission copy", async () => {
    updateStore.mockResolvedValue({ status: 400, error: { error: { request_id: "req-400" } } });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    fireEvent.click(screen.getByRole("button", { name: "Save store" }));
    expect(await screen.findByText("The request could not be completed.")).toBeDefined();
    expect(screen.queryByText(/permission/i)).toBeNull();
  });

  test("a thrown save (offline) -> generic banner, no route change", async () => {
    updateStore.mockRejectedValue(new TypeError("Failed to fetch"));
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    fireEvent.click(screen.getByRole("button", { name: "Save store" }));
    expect(await screen.findByText("The request could not be completed.")).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  test("a thrown status change (offline) -> generic banner", async () => {
    updateStore.mockRejectedValue(new TypeError("Failed to fetch"));
    renderForm({ mode: "edit", storeId: "s1", initial: { ...cfc, is_active: false } });
    fireEvent.click(screen.getByRole("button", { name: "Activate store" }));
    expect(await screen.findByText("The request could not be completed.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Activate store" })).toBeDefined();
  });

  test("save and the status toggle never run at the same time", async () => {
    const ok = { status: 200, data: { ...cfc, id: "s1" } };
    const pendingCall = () => {
      let finish: (v: unknown) => void = () => {};
      const promise = new Promise((resolve) => {
        finish = resolve;
      });
      updateStore.mockReturnValue(promise);
      return () => finish(ok);
    };
    const isDisabled = (name: string) =>
      (screen.getByRole("button", { name }) as HTMLButtonElement).disabled;
    renderForm({ mode: "edit", storeId: "s1", initial: { ...cfc, is_active: false } });

    let finish = pendingCall();
    fireEvent.click(screen.getByRole("button", { name: "Activate store" }));
    await waitFor(() => expect(isDisabled("Save store")).toBe(true));
    await act(async () => finish());
    await waitFor(() => expect(isDisabled("Save store")).toBe(false));

    finish = pendingCall();
    fireEvent.click(screen.getByRole("button", { name: "Save store" }));
    await waitFor(() => expect(isDisabled("Activate store")).toBe(true));
    await act(async () => finish());
  });

  test("the status control sits outside the name form", () => {
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    const suspend = screen.getByRole("button", { name: "Suspend store" }) as HTMLButtonElement;
    expect(suspend.form).toBeNull();
    expect(suspend.closest("form")).toBeNull();
  });
});

describe("StoreFormRoute edit: the status toggle and the detail cache", () => {
  beforeEach(() => {
    readStore.mockReset();
    updateStore.mockReset();
    navigate.mockReset();
    activeContext.mockReturnValue(withTenant);
  });

  test("a successful toggle writes the returned store into the cache: no refetch, no stale badge, the name edit survives", async () => {
    readStore.mockResolvedValue({ status: 200, data: { ...cfc, id: "s1", is_active: false } });
    updateStore.mockResolvedValue({ status: 200, data: { ...cfc, id: "s1", is_active: true } });
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/stores/s1/edit"]}>
          <Routes>
            <Route path="/stores/:storeId/edit" element={<StoreFormRoute mode="edit" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Suspended")).toBeDefined();
    fireEvent.change(screen.getByLabelText(/store name/i), { target: { value: "Unsaved name" } });
    fireEvent.click(screen.getByRole("button", { name: "Activate store" }));

    expect(await screen.findByRole("button", { name: "Suspend store" })).toBeDefined();
    expect(screen.getByText("Active").className).toContain("badge--active");
    expect(readStore).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText(/store name/i) as HTMLInputElement).value).toBe("Unsaved name");
  });
});

describe("StoreFormRoute edit: a partial PATCH response", () => {
  beforeEach(() => {
    readStore.mockReset();
    updateStore.mockReset();
    activeContext.mockReturnValue(withTenant);
  });

  test("is merged over the cached store, so code and ID survive", async () => {
    readStore.mockResolvedValue({ status: 200, data: { ...cfc, id: "s1" } });
    // The generated Store type allows a partial body; only the flag comes back.
    updateStore.mockResolvedValue({ status: 200, data: { is_active: false } });
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/stores/s1/edit"]}>
          <Routes>
            <Route path="/stores/:storeId/edit" element={<StoreFormRoute mode="edit" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Suspend store" }));
    const confirm = screen.getByRole("region", { name: "Confirm: suspend store" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Suspend store" }));

    expect(await screen.findByRole("button", { name: "Activate store" })).toBeDefined();
    expect(qc.getQueryData(["rf2", "store", "s1"])).toEqual({
      kind: "store",
      store: { ...cfc, id: "s1", is_active: false },
    });
    expect((screen.getByLabelText(/store code/i) as HTMLInputElement).value).toBe("CFC");
    expect(readStore).toHaveBeenCalledTimes(1);
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

describe("StoreForm Arabic", () => {
  beforeEach(() => {
    createStore.mockReset();
    updateStore.mockReset();
    navigate.mockReset();
    activeContext.mockReturnValue(withTenant);
  });

  test("create form renders in Arabic; the inline code conflict follows a locale switch", async () => {
    setLocale("ar");
    createStore.mockResolvedValue({ status: 409, error: { error: { request_id: "r1" } } });
    renderForm({ mode: "create" });
    expect(screen.getByRole("heading", { name: "إضافة متجر" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "بيانات المتجر" })).toBeDefined();
    // the read-only scope line names the tenant as authored, isolated
    const tenant = screen.getByText("Northstar Retail");
    expect(tenant.tagName).toBe("BDI");
    expect(tenant.closest("p")?.textContent).toBe("سيُنشأ المتجر في Northstar Retail.");
    expect(screen.getByText("لا يمكن تغيير الرمز بعد إنشاء المتجر.")).toBeDefined();
    expect(screen.queryByRole("button", { name: /create store/i })).toBeNull();
    fireEvent.change(screen.getByLabelText("رمز المتجر (إلزامي)"), { target: { value: "DUP" } });
    fireEvent.change(screen.getByLabelText("اسم المتجر (إلزامي)"), {
      target: { value: "Dup Store" },
    });
    fireEvent.click(screen.getByRole("button", { name: "إنشاء المتجر" }));
    expect(
      await screen.findByText("رمز المتجر هذا مستخدم بالفعل في هذه المؤسسة. اختر رمزًا آخر."),
    ).toBeDefined();
    act(() => setLocale("en"));
    expect(await screen.findByText(/store code is already in use/i)).toBeDefined();
  });

  test("edit form renders its Arabic title, hints, status control and actions", () => {
    setLocale("ar");
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    const heading = screen.getByRole("heading", { name: "تعديل Cairo Festival City" });
    expect(heading.querySelector("bdi")?.textContent).toBe("Cairo Festival City");
    expect(screen.getByLabelText("رمز المتجر")).toBeDefined();
    expect(screen.getByText("للقراءة فقط. لا يمكن تغيير الرمز بعد إنشاء المتجر.")).toBeDefined();
    expect(screen.getByText("استخدمه عند التواصل مع الدعم.")).toBeDefined();
    expect(screen.getByRole("heading", { name: "حالة المتجر" })).toBeDefined();
    expect(screen.getByText("نشط").className).toContain("badge--active");
    expect(screen.getByRole("button", { name: "إيقاف المتجر" })).toBeDefined();
    expect(screen.getByRole("button", { name: "حفظ المتجر" })).toBeDefined();
    expect(screen.getByRole("button", { name: "إلغاء التعديل" })).toBeDefined();
  });

  test("Arabic: 403 on save -> the Arabic edit-denied banner", async () => {
    setLocale("ar");
    updateStore.mockResolvedValue({ status: 403, error: { error: { request_id: "req-91c2" } } });
    renderForm({ mode: "edit", storeId: "s1", initial: cfc });
    fireEvent.click(screen.getByRole("button", { name: "حفظ المتجر" }));
    expect(await screen.findByText("ليست لديك صلاحية لتعديل هذا المتجر.")).toBeDefined();
    expect(
      screen.getByText("لم يتغيّر شيء. يستطيع مالك المؤسسة أو مسؤولها إجراء هذا التعديل."),
    ).toBeDefined();
  });

  test("Arabic: residual 401 -> Arabic scope prompt", async () => {
    setLocale("ar");
    createStore.mockResolvedValue({ status: 401 });
    renderForm({ mode: "create" });
    fireEvent.change(screen.getByLabelText("رمز المتجر (إلزامي)"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "إنشاء المتجر" }));
    expect(await screen.findByText(/^اختر مؤسسة قبل إدارة المتاجر\./)).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });
});
