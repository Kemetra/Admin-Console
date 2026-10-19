import type { ErpnextItemMapping, ErpnextWarehouseMapping } from "@/lib/erp-mapping-queries";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const api = vi.hoisted(() => ({
  tenantAdminListErpnextItemMappings: vi.fn(),
  tenantAdminSuggestErpnextItemMapping: vi.fn(),
  tenantAdminConfirmErpnextItemMapping: vi.fn(),
  tenantAdminRetireErpnextItemMapping: vi.fn(),
  tenantAdminListErpnextWarehouseMappings: vi.fn(),
  tenantAdminSetErpnextWarehouseMapping: vi.fn(),
  tenantAdminRetireErpnextWarehouseMapping: vi.fn(),
}));
vi.mock("@/lib/erp-mapping-queries", () =>
  Object.fromEntries(
    Object.keys(api).map((name) => [
      name,
      (...a: unknown[]) => api[name as keyof typeof api](...a),
    ]),
  ),
);
const listStores = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, listStores: (...a: unknown[]) => listStores(...a) };
});
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { ErpMappings } from "@/erp-mappings/ErpMappings";
import { createQueryClient } from "@/lib/query";

/**
 * RT-725 screen: per operation, the happy path and every contract error code;
 * a mutation runs only after an explicit confirm, carries the version on
 * screen, and is sent exactly once (never re-sent on a failure).
 */
const ITEM = "0190f000-0000-7000-8000-0000000000b1";
const ITEM_2 = "0190f000-0000-7000-8000-0000000000b2";
const PRODUCT = "0190f000-0000-7000-8000-0000000000c1";
const WH = "0190f000-0000-7000-8000-0000000000d1";
const STORE_A = "0190f000-0000-7000-8000-0000000000a1";
const STORE_B = "0190f000-0000-7000-8000-0000000000a2";
const STRAY_STORE = "0190f000-0000-7000-8000-0000000000a9";
const REQ = "11111111-2222-4333-8444-555555555555";

function itemRow(over: Partial<ErpnextItemMapping> = {}): ErpnextItemMapping {
  return {
    id: ITEM,
    tenant_product_id: PRODUCT,
    erpnext_item_ref: "ITEM-COLA-330",
    state: "suggested",
    suggestion_source: "manual",
    version: 3,
    suggested_by: null,
    suggested_at: "2026-10-18T09:00:00Z",
    confirmed_by: null,
    confirmed_at: null,
    retired_at: null,
    created_at: "2026-10-18T09:00:00Z",
    updated_at: "2026-10-18T09:00:00Z",
    ...over,
  };
}

function whRow(over: Partial<ErpnextWarehouseMapping> = {}): ErpnextWarehouseMapping {
  return {
    id: WH,
    store_id: STORE_A,
    purpose: "stock",
    erpnext_warehouse_ref: "Maadi Stores - NS",
    version: 2,
    set_by: null,
    set_at: "2026-10-18T09:00:00Z",
    retired_at: null,
    created_at: "2026-10-18T09:00:00Z",
    updated_at: "2026-10-18T09:00:00Z",
    ...over,
  };
}

function ctx(role: string | null = "owner", tenant: { id: string; name: string } | null = null) {
  return {
    context: {
      user: { id: "u1", display_name: "Amal Saleh" },
      active_tenant: tenant ?? { id: "t1", name: "Northstar Retail" },
      active_store: null,
      active_role_code: role,
      memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: role }],
    },
    switchTenant: vi.fn(),
    switchStore: vi.fn(),
    clearStore: vi.fn(),
  };
}

const ok = <T,>(data: T, status = 200) => ({ status, data });
const failure = (status: number, retryAfter?: number) => ({
  status,
  error: { error: { code: "x", message: "x", request_id: REQ } },
  ...(retryAfter === undefined ? {} : { retryAfter }),
});

function renderPage(entry = "/erp-connection/mappings"): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/erp-connection/mappings" element={<ErpMappings />} />
          <Route path="/erp-connection" element={<p>status page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const itemsPanel = () => screen.getByRole("region", { name: "Item mappings" });
const whPanel = () => screen.getByRole("region", { name: "Warehouse mappings" });

async function itemRowEl(ref = "ITEM-COLA-330"): Promise<HTMLElement> {
  return within(itemsPanel()).findByRole("row", { name: new RegExp(ref) });
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  listStores.mockReset();
  activeContext.mockReset();
  activeContext.mockReturnValue(ctx());
  listStores.mockResolvedValue({
    status: 200,
    data: [
      { id: STORE_A, name: "Maadi", code: "MAD", is_active: true },
      { id: STORE_B, name: "Zamalek", code: "ZAM", is_active: true },
    ],
  });
  api.tenantAdminListErpnextItemMappings.mockResolvedValue(ok({ items: [itemRow()] }));
  api.tenantAdminListErpnextWarehouseMappings.mockResolvedValue(ok({ items: [whRow()] }));
});

describe("gate and reads", () => {
  test.each(["store_manager", "cashier", null])(
    "%s gets NoAccess and nothing is requested",
    async (role) => {
      activeContext.mockReturnValue(ctx(role));
      renderPage();
      expect(await screen.findByRole("heading", { name: /access/i })).toBeTruthy();
      expect(api.tenantAdminListErpnextItemMappings).not.toHaveBeenCalled();
      expect(api.tenantAdminListErpnextWarehouseMappings).not.toHaveBeenCalled();
    },
  );

  test("no active tenant: a prompt, nothing requested", () => {
    activeContext.mockReturnValue({ ...ctx(), context: { ...ctx().context, active_tenant: null } });
    renderPage();
    expect(screen.getByText("Select a tenant to view its ERPNext mappings.")).toBeTruthy();
    expect(api.tenantAdminListErpnextItemMappings).not.toHaveBeenCalled();
  });

  test("owner sees both lists: ids and references exact, store names resolved, back link", async () => {
    renderPage();
    const row = await itemRowEl();
    expect(within(row).getByText(PRODUCT)).toBeTruthy();
    expect(within(row).getByText("Suggested — not used for posting")).toBeTruthy();
    expect(within(row).getByText("Manual")).toBeTruthy();
    expect(within(row).getByText("Not confirmed yet")).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Confirm" })).toBeTruthy();
    const wh = await within(whPanel()).findByRole("row", { name: /Maadi Stores - NS/ });
    expect(within(wh).getByText("Maadi")).toBeTruthy();
    expect(within(wh).getByText("Stock")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Back to connection & sync" }).getAttribute("href"),
    ).toBe("/erp-connection");
    expect(api.tenantAdminListErpnextItemMappings).toHaveBeenCalledWith(undefined);
  });

  test("tenant_admin may use it too", async () => {
    activeContext.mockReturnValue(ctx("tenant_admin"));
    renderPage();
    expect(await itemRowEl()).toBeTruthy();
  });

  test("Unknown stays Unknown: an unknown state offers no action, unknown values show as received", async () => {
    api.tenantAdminListErpnextItemMappings.mockResolvedValue(
      ok({
        items: [
          itemRow({
            state: "archived" as ErpnextItemMapping["state"],
            suggestion_source: "ml" as ErpnextItemMapping["suggestion_source"],
          }),
        ],
      }),
    );
    api.tenantAdminListErpnextWarehouseMappings.mockResolvedValue(
      ok({
        items: [
          whRow({
            store_id: STRAY_STORE,
            purpose: "transit" as ErpnextWarehouseMapping["purpose"],
          }),
        ],
      }),
    );
    renderPage();
    const row = await itemRowEl();
    expect(within(row).getByText("Unknown")).toBeTruthy();
    expect(within(row).getByText("ml")).toBeTruthy();
    expect(within(row).queryByRole("button")).toBeNull();
    const wh = await within(whPanel()).findByRole("row", { name: /Maadi Stores - NS/ });
    expect(within(wh).getByText("Unknown store")).toBeTruthy();
    expect(within(wh).getByText(STRAY_STORE)).toBeTruthy();
    expect(within(wh).getByText("transit")).toBeTruthy();
  });

  test("the state filter reads the review queue through the URL", async () => {
    renderPage("/erp-connection/mappings?state=suggested");
    await itemRowEl();
    expect(api.tenantAdminListErpnextItemMappings).toHaveBeenCalledWith("suggested");
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "confirmed" } });
    await waitFor(() =>
      expect(api.tenantAdminListErpnextItemMappings).toHaveBeenLastCalledWith("confirmed"),
    );
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "" } });
    await waitFor(() =>
      expect(api.tenantAdminListErpnextItemMappings).toHaveBeenLastCalledWith(undefined),
    );
  });

  test("a bad state filter is never sent", async () => {
    renderPage("/erp-connection/mappings?state=retired");
    await itemRowEl();
    expect(api.tenantAdminListErpnextItemMappings).toHaveBeenCalledWith(undefined);
  });

  test("empty lists say so, per filter", async () => {
    api.tenantAdminListErpnextItemMappings.mockResolvedValue(ok({ items: [] }));
    api.tenantAdminListErpnextWarehouseMappings.mockResolvedValue(ok({ items: [] }));
    renderPage("/erp-connection/mappings?state=suggested");
    expect(await screen.findByText("No suggestions waiting for review.")).toBeTruthy();
    expect(await screen.findByText("No active warehouse mappings.")).toBeTruthy();
  });

  test.each([403, 404])(
    "a %i list read hides the panel: role copy, no actions, no retry",
    async (status) => {
      api.tenantAdminListErpnextItemMappings.mockResolvedValue(failure(status));
      api.tenantAdminListErpnextWarehouseMappings.mockResolvedValue(failure(status));
      renderPage();
      const alerts = await screen.findAllByText("This section isn't available to your role.");
      expect(alerts).toHaveLength(2);
      expect(screen.queryByLabelText("State")).toBeNull();
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
      expect(screen.queryByRole("form", { name: "Set a warehouse mapping" })).toBeNull();
    },
  );

  test.each([
    [400, "The server rejected this request. Change the filter and try again."],
    [401, "Your session has ended. Sign in again."],
    [429, "Too many requests. Wait a moment, then try again."],
    [500, "Couldn't load the mappings. Try again."],
  ])("a %i list read shows its own copy with the request id", async (status, copy) => {
    api.tenantAdminListErpnextItemMappings.mockResolvedValue(failure(status));
    renderPage();
    const alert = await within(itemsPanel()).findByRole("alert");
    expect(alert.textContent).toContain(copy);
    expect(alert.textContent).toContain(REQ);
  });

  test("a list read with no answer is a failed read; Retry reads again", async () => {
    api.tenantAdminListErpnextWarehouseMappings.mockRejectedValueOnce(new TypeError("network"));
    renderPage();
    const alert = await within(whPanel()).findByRole("alert");
    expect(alert.textContent).toContain("Couldn't load the mappings. Try again.");
    fireEvent.click(within(alert).getByRole("button"));
    expect(await within(whPanel()).findByRole("row", { name: /Maadi Stores - NS/ })).toBeTruthy();
    expect(api.tenantAdminListErpnextWarehouseMappings).toHaveBeenCalledTimes(2);
  });

  test("a store read that throws is failed, never 'every store mapped'", async () => {
    listStores.mockRejectedValue(new TypeError("network"));
    renderPage();
    expect(
      await screen.findByText(
        "Couldn't load the store list, so no mapping can be set right now.",
        {},
        { timeout: 4000 },
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/To change one, retire it/)).toBeNull();
  });

  test("while the store list loads, the form claims nothing", async () => {
    listStores.mockReturnValue(new Promise(() => {}));
    renderPage();
    await within(whPanel()).findByRole("row", { name: /Maadi Stores - NS/ });
    expect(screen.queryByText(/To change one, retire it/)).toBeNull();
    expect(screen.queryByRole("form", { name: "Set a warehouse mapping" })).toBeNull();
    expect(screen.queryByText(/Couldn't load the store list/)).toBeNull();
  });

  test("a store list that fails offers no store to set", async () => {
    listStores.mockResolvedValue({ status: 500, error: { error: { code: "x", message: "x" } } });
    renderPage();
    expect(
      await screen.findByText("Couldn't load the store list, so no mapping can be set right now."),
    ).toBeTruthy();
  });
});

describe("confirm an item mapping", () => {
  async function openConfirm(): Promise<HTMLElement> {
    renderPage();
    const row = await itemRowEl();
    fireEvent.click(within(row).getByRole("button", { name: "Confirm" }));
    return screen.getByRole("region", { name: "Confirm item mapping" });
  }

  test("nothing is sent until the confirm; Cancel sends nothing", async () => {
    const step = await openConfirm();
    expect(step.textContent).toContain("ITEM-COLA-330");
    expect(step.textContent).toContain(PRODUCT);
    fireEvent.click(within(step).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("region", { name: "Confirm item mapping" })).toBeNull();
    expect(api.tenantAdminConfirmErpnextItemMapping).not.toHaveBeenCalled();
  });

  test("happy path: the version on screen is sent once, the list is read again", async () => {
    api.tenantAdminConfirmErpnextItemMapping.mockResolvedValue(
      ok(itemRow({ state: "confirmed", version: 4 })),
    );
    const step = await openConfirm();
    api.tenantAdminListErpnextItemMappings.mockResolvedValue(
      ok({
        items: [itemRow({ state: "confirmed", version: 4, confirmed_at: "2026-10-19T09:00:00Z" })],
      }),
    );
    fireEvent.click(within(step).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("Mapping confirmed.")).toBeTruthy();
    expect(api.tenantAdminConfirmErpnextItemMapping).toHaveBeenCalledTimes(1);
    expect(api.tenantAdminConfirmErpnextItemMapping).toHaveBeenCalledWith(ITEM, 3);
    const row = await itemRowEl();
    await within(row).findByText("Confirmed");
    expect(within(row).queryByRole("button", { name: "Confirm" })).toBeNull();
  });

  test.each([
    [400, "The server rejected these values. Check them and try again.", false],
    [401, "Your session has ended. Sign in again.", false],
    [403, "The server refused a change from this page. Reload the console and try again.", false],
    [404, "This mapping no longer exists or isn't available to you. The list was refreshed.", true],
    [409, "This mapping changed since you loaded it, or can no longer be confirmed.", true],
    [429, "Too many requests. Wait 30 seconds, then try again.", false],
    [500, "No clear answer came back, so the change may or may not have been applied.", true],
  ])(
    "a %i stays in the confirm step with its own copy; never re-sent",
    async (status, copy, rereads) => {
      api.tenantAdminConfirmErpnextItemMapping.mockResolvedValue(failure(status, 30));
      const step = await openConfirm();
      const reads = api.tenantAdminListErpnextItemMappings.mock.calls.length;
      fireEvent.click(within(step).getByRole("button", { name: "Confirm" }));
      const alert = await within(step).findByRole("alert");
      expect(alert.textContent).toContain(copy);
      expect(alert.textContent).toContain(REQ);
      await new Promise((r) => setTimeout(r, 20));
      expect(api.tenantAdminConfirmErpnextItemMapping).toHaveBeenCalledTimes(1);
      const after = api.tenantAdminListErpnextItemMappings.mock.calls.length;
      expect(after > reads).toBe(rereads);
    },
  );

  test("no answer at all reads as an unknown outcome", async () => {
    api.tenantAdminConfirmErpnextItemMapping.mockRejectedValue(new TypeError("network"));
    const step = await openConfirm();
    fireEvent.click(within(step).getByRole("button", { name: "Confirm" }));
    const alert = await within(step).findByRole("alert");
    expect(alert.textContent).toContain("Unknown result");
    expect(api.tenantAdminConfirmErpnextItemMapping).toHaveBeenCalledTimes(1);
  });

  test("a double click sends one request", async () => {
    let settle: (v: unknown) => void = () => {};
    api.tenantAdminConfirmErpnextItemMapping.mockReturnValue(
      new Promise((r) => {
        settle = r;
      }),
    );
    const step = await openConfirm();
    const button = within(step).getByRole("button", { name: "Confirm" });
    fireEvent.click(button);
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(button);
    settle(ok(itemRow({ state: "confirmed" })));
    expect(await screen.findByText("Mapping confirmed.")).toBeTruthy();
    expect(api.tenantAdminConfirmErpnextItemMapping).toHaveBeenCalledTimes(1);
  });
});

describe("retire an item mapping, then suggest a replacement", () => {
  async function retire(): Promise<void> {
    api.tenantAdminRetireErpnextItemMapping.mockResolvedValue(
      ok(itemRow({ retired_at: "2026-10-19T09:00:00Z", version: 4 })),
    );
    renderPage();
    const row = await itemRowEl();
    fireEvent.click(within(row).getByRole("button", { name: "Retire" }));
    const step = screen.getByRole("region", { name: "Retire item mapping" });
    api.tenantAdminListErpnextItemMappings.mockResolvedValue(ok({ items: [] }));
    fireEvent.click(within(step).getByRole("button", { name: "Retire" }));
    expect(await screen.findByText("Mapping retired.")).toBeTruthy();
  }

  test("retire sends the version once; the suggestion form names the retired product", async () => {
    await retire();
    expect(api.tenantAdminRetireErpnextItemMapping).toHaveBeenCalledWith(ITEM, 3);
    expect(api.tenantAdminRetireErpnextItemMapping).toHaveBeenCalledTimes(1);
    const form = screen.getByRole("form", { name: "Suggest a replacement item" });
    expect(form.textContent).toContain(PRODUCT);
    // There is no free-text product field: only the ERPNext reference is typed.
    expect(within(form).getAllByRole("textbox")).toHaveLength(1);
    fireEvent.click(within(form).getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("form", { name: "Suggest a replacement item" })).toBeNull();
    expect(api.tenantAdminSuggestErpnextItemMapping).not.toHaveBeenCalled();
  });

  test("suggest: an empty reference is not sent; a trimmed one is, once, after the confirm", async () => {
    await retire();
    const form = screen.getByRole("form", { name: "Suggest a replacement item" });
    fireEvent.click(within(form).getByRole("button", { name: "Review" }));
    expect(screen.getByText("Enter the ERPNext reference.")).toBeTruthy();
    fireEvent.change(within(form).getByLabelText("ERPNext Item reference"), {
      target: { value: "  ITEM-COLA-330-V2 " },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Review" }));
    const step = screen.getByRole("region", { name: "Suggest a replacement item" });
    expect(step.textContent).toContain("ITEM-COLA-330-V2");
    expect(api.tenantAdminSuggestErpnextItemMapping).not.toHaveBeenCalled();
    api.tenantAdminSuggestErpnextItemMapping.mockResolvedValue(
      ok(itemRow({ id: ITEM_2, erpnext_item_ref: "ITEM-COLA-330-V2", version: 1 }), 201),
    );
    fireEvent.click(within(step).getByRole("button", { name: "Record suggestion" }));
    expect(await screen.findByText(/Suggestion recorded/)).toBeTruthy();
    expect(api.tenantAdminSuggestErpnextItemMapping).toHaveBeenCalledTimes(1);
    expect(api.tenantAdminSuggestErpnextItemMapping).toHaveBeenCalledWith({
      tenant_product_id: PRODUCT,
      erpnext_item_ref: "ITEM-COLA-330-V2",
    });
  });

  test.each([
    [400, "The server rejected these values."],
    [403, "The server refused a change from this page."],
    [404, "This product isn't available to you. No suggestion was recorded."],
    [409, "This product already has an active mapping."],
    [429, "Too many requests."],
    [503, "Unknown result"],
  ])("suggest %i keeps the step open with its copy; never re-sent", async (status, copy) => {
    await retire();
    api.tenantAdminSuggestErpnextItemMapping.mockResolvedValue(failure(status));
    const form = screen.getByRole("form", { name: "Suggest a replacement item" });
    fireEvent.change(within(form).getByLabelText("ERPNext Item reference"), {
      target: { value: "ITEM-X" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Review" }));
    const step = screen.getByRole("region", { name: "Suggest a replacement item" });
    fireEvent.click(within(step).getByRole("button", { name: "Record suggestion" }));
    expect((await within(step).findByRole("alert")).textContent).toContain(copy);
    expect(api.tenantAdminSuggestErpnextItemMapping).toHaveBeenCalledTimes(1);
    // Cancel goes back to the form with the reference kept.
    fireEvent.click(within(step).getByRole("button", { name: "Cancel" }));
    expect((screen.getByLabelText("ERPNext Item reference") as HTMLInputElement).value).toBe(
      "ITEM-X",
    );
  });

  test.each([
    [404, "This mapping no longer exists"],
    [409, "or was already retired"],
  ])("retire %i shows its copy and offers no suggestion", async (status, copy) => {
    api.tenantAdminRetireErpnextItemMapping.mockResolvedValue(failure(status));
    renderPage();
    const row = await itemRowEl();
    fireEvent.click(within(row).getByRole("button", { name: "Retire" }));
    const step = screen.getByRole("region", { name: "Retire item mapping" });
    fireEvent.click(within(step).getByRole("button", { name: "Retire" }));
    expect((await within(step).findByRole("alert")).textContent).toContain(copy);
    expect(screen.queryByRole("form", { name: "Suggest a replacement item" })).toBeNull();
    expect(api.tenantAdminRetireErpnextItemMapping).toHaveBeenCalledTimes(1);
  });
});

describe("warehouse mappings", () => {
  async function fillSet(ref = "Zamalek Stores - NS"): Promise<HTMLElement> {
    renderPage();
    const form = await screen.findByRole("form", { name: "Set a warehouse mapping" });
    fireEvent.change(within(form).getByLabelText("Store"), { target: { value: STORE_B } });
    fireEvent.change(within(form).getByLabelText("ERPNext Warehouse reference"), {
      target: { value: ref },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Review" }));
    return screen.getByRole("region", { name: "Set a warehouse mapping" });
  }

  test("only stores without an active mapping are offered", async () => {
    renderPage();
    const form = await screen.findByRole("form", { name: "Set a warehouse mapping" });
    const options = within(within(form).getByLabelText("Store")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Choose a store", "Zamalek"]);
  });

  test("every store mapped: no form, a note on how to re-point", async () => {
    api.tenantAdminListErpnextWarehouseMappings.mockResolvedValue(
      ok({ items: [whRow(), whRow({ id: "w2", store_id: STORE_B })] }),
    );
    renderPage();
    expect(await screen.findByText(/To change one, retire it, then set a new one./)).toBeTruthy();
    expect(screen.queryByRole("form", { name: "Set a warehouse mapping" })).toBeNull();
  });

  test("set: missing values are flagged and nothing is sent", async () => {
    renderPage();
    const form = await screen.findByRole("form", { name: "Set a warehouse mapping" });
    fireEvent.click(within(form).getByRole("button", { name: "Review" }));
    expect(screen.getByText("Choose a store.")).toBeTruthy();
    expect(screen.getByText("Enter the ERPNext reference.")).toBeTruthy();
    expect(api.tenantAdminSetErpnextWarehouseMapping).not.toHaveBeenCalled();
  });

  test("set happy path: sent once after the confirm, the form resets", async () => {
    api.tenantAdminSetErpnextWarehouseMapping.mockResolvedValue(
      ok(whRow({ id: "w2", store_id: STORE_B, erpnext_warehouse_ref: "Zamalek Stores - NS" }), 201),
    );
    const step = await fillSet("  Zamalek Stores - NS ");
    expect(step.textContent).toContain("Zamalek");
    expect(step.textContent).toContain("Zamalek Stores - NS");
    fireEvent.click(within(step).getByRole("button", { name: "Set mapping" }));
    expect(await screen.findByText("Warehouse mapping set.")).toBeTruthy();
    expect(api.tenantAdminSetErpnextWarehouseMapping).toHaveBeenCalledTimes(1);
    expect(api.tenantAdminSetErpnextWarehouseMapping).toHaveBeenCalledWith({
      store_id: STORE_B,
      erpnext_warehouse_ref: "Zamalek Stores - NS",
    });
  });

  test.each([
    [400, "The server rejected these values."],
    [401, "Your session has ended."],
    [403, "The server refused a change from this page."],
    [404, "This store isn't available to you. No mapping was set."],
    [409, "This store already has an active warehouse mapping."],
    [429, "Too many requests."],
    [500, "Unknown result"],
  ])("set %i keeps the confirm open with its copy; never re-sent", async (status, copy) => {
    api.tenantAdminSetErpnextWarehouseMapping.mockResolvedValue(failure(status));
    const step = await fillSet();
    fireEvent.click(within(step).getByRole("button", { name: "Set mapping" }));
    expect((await within(step).findByRole("alert")).textContent).toContain(copy);
    expect(api.tenantAdminSetErpnextWarehouseMapping).toHaveBeenCalledTimes(1);
    fireEvent.click(within(step).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("form", { name: "Set a warehouse mapping" })).toBeTruthy();
  });

  test("retire happy path: the version on screen, once", async () => {
    api.tenantAdminRetireErpnextWarehouseMapping.mockResolvedValue(
      ok(whRow({ retired_at: "2026-10-19T09:00:00Z" })),
    );
    renderPage();
    const row = await within(whPanel()).findByRole("row", { name: /Maadi Stores - NS/ });
    fireEvent.click(within(row).getByRole("button", { name: "Retire" }));
    const step = screen.getByRole("region", { name: "Retire warehouse mapping" });
    expect(step.textContent).toContain("Maadi");
    api.tenantAdminListErpnextWarehouseMappings.mockResolvedValue(ok({ items: [] }));
    fireEvent.click(within(step).getByRole("button", { name: "Retire" }));
    expect(await screen.findByText("Warehouse mapping retired.")).toBeTruthy();
    expect(api.tenantAdminRetireErpnextWarehouseMapping).toHaveBeenCalledWith(WH, 2);
    expect(api.tenantAdminRetireErpnextWarehouseMapping).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("No active warehouse mappings.")).toBeTruthy();
  });

  test.each([
    [400, "The server rejected these values."],
    [403, "The server refused a change from this page."],
    [404, "This mapping no longer exists"],
    [409, "or was already retired"],
    [429, "Too many requests."],
    [502, "Unknown result"],
  ])("retire %i shows its copy; never re-sent; Cancel closes", async (status, copy) => {
    api.tenantAdminRetireErpnextWarehouseMapping.mockResolvedValue(failure(status));
    renderPage();
    const row = await within(whPanel()).findByRole("row", { name: /Maadi Stores - NS/ });
    fireEvent.click(within(row).getByRole("button", { name: "Retire" }));
    const step = screen.getByRole("region", { name: "Retire warehouse mapping" });
    fireEvent.click(within(step).getByRole("button", { name: "Retire" }));
    expect((await within(step).findByRole("alert")).textContent).toContain(copy);
    expect(api.tenantAdminRetireErpnextWarehouseMapping).toHaveBeenCalledTimes(1);
    fireEvent.click(within(step).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("region", { name: "Retire warehouse mapping" })).toBeNull();
  });
});

describe("stale reads", () => {
  test("a failed re-read keeps the rows and says so", async () => {
    api.tenantAdminConfirmErpnextItemMapping.mockResolvedValue(failure(409));
    renderPage();
    const row = await itemRowEl();
    api.tenantAdminListErpnextItemMappings.mockResolvedValue(failure(500));
    fireEvent.click(within(row).getByRole("button", { name: "Confirm" }));
    const step = screen.getByRole("region", { name: "Confirm item mapping" });
    fireEvent.click(within(step).getByRole("button", { name: "Confirm" }));
    expect(
      await within(itemsPanel()).findByText("Couldn't load the mappings. Try again."),
    ).toBeTruthy();
    expect(await itemRowEl()).toBeTruthy();
  });
});
