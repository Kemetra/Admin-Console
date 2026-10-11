import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, test, vi } from "vitest";

// Stub the network boundary so the shell surfaces render from fixed context.
const getActiveContext = vi.fn();
vi.mock("@/lib/client", () => ({
  getActiveContext: (...a: unknown[]) => getActiveContext(...a),
  switchActiveTenant: vi.fn(),
  switchActiveStore: vi.fn(),
  clearActiveStore: vi.fn(),
  signOut: vi.fn(),
  refreshSession: vi.fn(),
}));

import { ActiveContextProvider } from "@/context/ActiveContextProvider";
import { createQueryClient } from "@/lib/query";
import { Overview } from "@/shell/Overview";
import { ProtectedArea } from "@/shell/ProtectedArea";

// ProtectedArea is now the protected LAYOUT route element (RF-2 T009): on the
// authenticated path it renders <AppShell> wrapping <Outlet/>, so the Overview
// index mounts inside the shell. The gating cases (scope-gate / no-access /
// redirect) short-circuit before the Outlet. Render the real route tree so the
// authenticated assertion exercises the layout-route composition.
function renderProtected(ctx: unknown): void {
  getActiveContext.mockResolvedValue({ status: 200, data: ctx });
  const qc = createQueryClient();
  function Tree({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/"]}>
          <ActiveContextProvider>{children}</ActiveContextProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  render(
    <Tree>
      <Routes>
        <Route path="/" element={<ProtectedArea />}>
          <Route index element={<Overview />} />
        </Route>
      </Routes>
    </Tree>,
  );
}

describe("ProtectedArea surface selection (rendering backend truth)", () => {
  test("multi-membership with no active tenant -> scope gate", async () => {
    renderProtected({
      active_tenant: null,
      memberships: [
        { tenant_id: "t1", tenant_name: "Northstar Retail" },
        { tenant_id: "t2", tenant_name: "Helios Markets" },
      ],
    });
    expect(await screen.findByRole("heading", { name: /select your context/i })).toBeDefined();
    expect(screen.getByText("Helios Markets")).toBeDefined();
  });

  test("resolved tenant -> app shell with gold scope header", async () => {
    renderProtected({
      user: { display_name: "Amal Saleh" },
      active_tenant: { id: "t1", name: "Northstar Retail" },
      active_store: { id: "s1", name: "Cairo Festival City" },
      active_role_code: "tenant_admin",
      memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail" }],
    });
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeDefined();
    // The scope header names tenant and store (the Overview subtitle repeats them).
    const scope = screen.getByRole("button", { name: /Northstar Retail/ });
    expect(scope.getAttribute("aria-haspopup")).toBe("menu");
    expect(scope.textContent).toContain("Cairo Festival City");
  });

  test("zero memberships -> no access", async () => {
    renderProtected({ active_tenant: null, memberships: [] });
    expect(await screen.findByRole("heading", { name: /no assigned access/i })).toBeDefined();
  });
});
