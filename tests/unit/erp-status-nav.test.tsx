import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, test, vi } from "vitest";

const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { AppShell } from "@/shell/AppShell";

function renderShell(role: string | null): void {
  activeContext.mockReturnValue({
    context: {
      user: { display_name: "Amal Saleh" },
      active_tenant: { id: "t1", name: "Northstar Retail" },
      active_store: null,
      active_role_code: role,
      memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail" }],
    },
    switchTenant: vi.fn(),
    switchStore: vi.fn(),
    clearStore: vi.fn(),
  });
  render(
    <MemoryRouter>
      <AppShell onSignOut={() => {}} showGatedNav={false} />
    </MemoryRouter>,
  );
}

/**
 * RT-560 / RT-557 OD-2: one role-gated entry in its own "Integration" section,
 * shown only to the roles the API lets read (owner / tenant_admin).
 */
describe("ERP connection navigation", () => {
  test.each(["owner", "tenant_admin"])("%s sees the entry in its own section", (role) => {
    renderShell(role);
    const link = screen.getByRole("link", { name: "Connection & sync" });
    expect(link.getAttribute("href")).toBe("/erp-connection");
    expect(screen.getByText("Integration").className).toBe("nav-section");
  });

  test.each(["store_manager", "cashier", "auditor", null])("%s has no entry", (role) => {
    renderShell(role);
    expect(screen.queryByRole("link", { name: "Connection & sync" })).toBeNull();
    expect(screen.queryByText("Integration")).toBeNull();
  });
});
