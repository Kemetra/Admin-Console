import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

// RT-780 (RT-777 S1): the /platform entry gate. Stub the network boundary so the
// gate renders from a fixed server-resolved context.
const getActiveContext = vi.fn();
const switchActiveTenant = vi.fn();
vi.mock("@/lib/client", () => ({
  getActiveContext: (...a: unknown[]) => getActiveContext(...a),
  switchActiveTenant: (...a: unknown[]) => switchActiveTenant(...a),
  switchActiveStore: vi.fn(),
  clearActiveStore: vi.fn(),
  signOut: vi.fn(),
  refreshSession: vi.fn(),
}));
// RT-782: the landing is the tenant directory; an empty list keeps this about the gate.
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, listTenants: async () => ({ status: 200, data: [], error: undefined }) };
});

import { ActiveContextProvider } from "@/context/ActiveContextProvider";
import { createQueryClient } from "@/lib/query";
import { Overview } from "@/shell/Overview";
import { ProtectedArea } from "@/shell/ProtectedArea";
import { platformRoutes } from "@/shell/platformRoutes";

function Where(): React.JSX.Element {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function renderAt(path: string, status: number, ctx: unknown): void {
  getActiveContext.mockResolvedValue({ status, data: ctx });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <ActiveContextProvider>
          <Where />
          <Routes>
            <Route path="/signin" element={<h1>sign-in page</h1>} />
            {platformRoutes}
            <Route path="/" element={<ProtectedArea />}>
              <Route index element={<Overview />} />
            </Route>
          </Routes>
        </ActiveContextProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const admin = { id: "u1", email: "ops@kemetra.test", display_name: "Ops", is_platform_admin: true };
const plain = {
  id: "u2",
  email: "amal@northstar.eg",
  display_name: "Amal",
  is_platform_admin: false,
};

beforeEach(() => {
  getActiveContext.mockReset();
  switchActiveTenant.mockReset();
});

describe("/platform entry gate (RT-780)", () => {
  test("platform admin with no membership and no tenant reaches the platform shell", async () => {
    renderAt("/platform", 200, { user: admin, active_tenant: null, memberships: [] });
    expect(await screen.findByRole("heading", { name: "Organizations", level: 1 })).toBeDefined();
    expect(screen.getByTestId("where").textContent).toBe("/platform/tenants");
    // Never the tenant picker, never the generic no-access.
    expect(screen.queryByRole("heading", { name: /select your context/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /no assigned access/i })).toBeNull();
    expect(switchActiveTenant).not.toHaveBeenCalled();
  });

  test("platform admin with memberships and no active tenant is not sent to the picker", async () => {
    renderAt("/platform/tenants", 200, {
      user: admin,
      active_tenant: null,
      memberships: [
        { tenant_id: "t1", tenant_name: "Northstar Retail" },
        { tenant_id: "t2", tenant_name: "Helios Markets" },
      ],
    });
    expect(await screen.findByRole("heading", { name: "Organizations", level: 1 })).toBeDefined();
    expect(screen.queryByText("Helios Markets")).toBeNull();
    expect(screen.queryByRole("heading", { name: /select your context/i })).toBeNull();
  });

  test("the platform shell has a platform label and no tenant scope bar", async () => {
    renderAt("/platform", 200, { user: admin, active_tenant: null, memberships: [] });
    await screen.findByRole("heading", { name: "Organizations", level: 1 });
    expect(screen.getAllByText("Platform").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Northstar/ })).toBeNull();
    const nav = screen.getByRole("navigation", { name: "Platform" });
    expect(nav.querySelectorAll("a")).toHaveLength(1);
    expect(nav.querySelector("[aria-disabled]")).toBeNull();
  });

  test("a non-admin gets the non-disclosing no-access state", async () => {
    renderAt("/platform", 200, {
      user: plain,
      active_tenant: { id: "t1", name: "Northstar Retail" },
      memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail" }],
    });
    expect(await screen.findByRole("heading", { name: "Not available" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Organizations", level: 1 })).toBeNull();
  });

  test("not-admin and route-does-not-exist render identical copy", async () => {
    renderAt("/platform/tenants", 200, { user: plain, active_tenant: null, memberships: [] });
    const denied = await screen.findByRole("heading", { name: "Not available" });
    const deniedBody = denied.parentElement?.textContent;
    document.body.innerHTML = "";
    renderAt("/platform/nope", 200, { user: admin, active_tenant: null, memberships: [] });
    const missing = await screen.findByRole("heading", { name: "Not available" });
    expect(missing.parentElement?.textContent).toBe(deniedBody);
  });

  test("a missing is_platform_admin flag is not an admin", async () => {
    renderAt("/platform", 200, {
      user: { id: "u3", email: "x@y.z" },
      active_tenant: null,
      memberships: [],
    });
    expect(await screen.findByRole("heading", { name: "Not available" })).toBeDefined();
  });

  test("unauthenticated redirects to sign-in", async () => {
    renderAt("/platform", 401, null);
    expect(await screen.findByRole("heading", { name: "sign-in page" })).toBeDefined();
  });
});

describe("tenant routes are unchanged (regression)", () => {
  test("multi-membership with no active tenant still gets the scope gate at /", async () => {
    renderAt("/", 200, {
      user: admin,
      active_tenant: null,
      memberships: [
        { tenant_id: "t1", tenant_name: "Northstar Retail" },
        { tenant_id: "t2", tenant_name: "Helios Markets" },
      ],
    });
    expect(await screen.findByRole("heading", { name: /select your context/i })).toBeDefined();
  });

  test("zero memberships still gets no-access at /, even for a platform admin", async () => {
    renderAt("/", 200, { user: admin, active_tenant: null, memberships: [] });
    expect(await screen.findByRole("heading", { name: /no assigned access/i })).toBeDefined();
  });
});
