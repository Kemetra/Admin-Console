import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const ctx = vi.hoisted(() => ({ role: "owner" as string | undefined }));
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => ({
    context: { active_tenant: { id: "t1" }, active_role_code: ctx.role },
  }),
}));

const readTenant = vi.fn();
const readStore = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return {
    ...actual,
    readTenant: (...a: unknown[]) => readTenant(...a),
    readStore: (...a: unknown[]) => readStore(...a),
  };
});
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useParams: () => ({ tenantId: "t1", storeId: "s1" }) };
});

const getTenantPolicy = vi.fn();
const getStorePolicy = vi.fn();
vi.mock("@/lib/cash-variance-policy-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cash-variance-policy-queries")>();
  return {
    ...actual,
    consoleGetTenantCashVariancePolicy: (...a: unknown[]) => getTenantPolicy(...a),
    consoleGetStoreCashVariancePolicy: (...a: unknown[]) => getStorePolicy(...a),
    consoleListTenantCashVariancePolicyRevisions: async () => ({
      status: 200,
      data: { items: [], nextCursor: null },
    }),
    consoleListStoreCashVariancePolicyRevisions: async () => ({
      status: 200,
      data: { items: [], nextCursor: null },
    }),
  };
});

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { StoreDetail } from "@/stores/StoreDetail";
import { TenantDetail } from "@/tenants/TenantDetail";
import { limitTenantRead, plainStoreRead } from "./cash-policy-fixtures";

function mount(ui: React.JSX.Element) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * RT-389: the policy sections sit on the tenant and store detail pages. The
 * tenant section is owner / tenant_admin only; the store section is read-only
 * for a store_manager; neither is shown (or requested) for other roles.
 */
describe("policy sections on the detail pages", () => {
  beforeEach(() => {
    ctx.role = "owner";
    readTenant.mockReset();
    readStore.mockReset();
    getTenantPolicy.mockReset();
    getStorePolicy.mockReset();
    readTenant.mockResolvedValue({
      status: 200,
      data: { id: "t1", slug: "northstar", name: "Northstar Retail", status: "active" },
    });
    readStore.mockResolvedValue({
      status: 200,
      data: {
        id: "s1",
        code: "CFC",
        name: "Cairo Festival City",
        is_active: true,
        timezone: "Africa/Cairo",
      },
    });
    getTenantPolicy.mockResolvedValue({ status: 200, data: limitTenantRead });
    getStorePolicy.mockResolvedValue({ status: 200, data: plainStoreRead });
    setLocale("en");
  });

  test("tenant page: an owner sees the policy section under the tenant fields", async () => {
    mount(<TenantDetail />);
    expect(await screen.findByRole("heading", { name: "Shift variance policy" })).toBeDefined();
    expect(await screen.findByRole("button", { name: "Apply now" })).toBeDefined();
    expect(getTenantPolicy).toHaveBeenCalledWith("t1");
  });

  test("tenant page: a store_manager sees no policy section and nothing is requested", async () => {
    ctx.role = "store_manager";
    mount(<TenantDetail />);
    await screen.findByRole("heading", { name: "Northstar Retail" });
    expect(screen.queryByText("Shift variance policy")).toBeNull();
    expect(getTenantPolicy).not.toHaveBeenCalled();
  });

  test("store page: an owner sees the policy and the store's time zone drives the form", async () => {
    mount(<StoreDetail />);
    expect(await screen.findByRole("button", { name: "Apply now" })).toBeDefined();
    expect(screen.getByLabelText("Expiry (optional)")).toBeDefined();
    expect(getStorePolicy).toHaveBeenCalledWith("s1");
  });

  test("store page: a store_manager sees the policy without any edit control", async () => {
    ctx.role = "store_manager";
    mount(<StoreDetail />);
    expect(await screen.findByText("Effective policy")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Apply now" })).toBeNull();
    expect(screen.queryByLabelText("Reason")).toBeNull();
  });

  test("store page: a cashier sees no policy section", async () => {
    ctx.role = "cashier";
    mount(<StoreDetail />);
    await screen.findByRole("heading", { name: "Cairo Festival City" });
    expect(screen.queryByText("Shift variance policy")).toBeNull();
    expect(getStorePolicy).not.toHaveBeenCalled();
  });
});
