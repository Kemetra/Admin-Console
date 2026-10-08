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
      <AppShell onSignOut={() => {}} />
    </MemoryRouter>,
  );
}

/**
 * RT-178 AC6: the sidebar entry is role-gated the same way as the API
 * (`owner` / `tenant_admin` / `store_manager` may read; everyone else gets a
 * non-disclosing 404, so the entry is not shown to them).
 */
describe("ERPNext stock discrepancies navigation", () => {
  test.each(["owner", "tenant_admin", "store_manager"])("%s sees the nav entry", (role) => {
    renderShell(role);
    const link = screen.getByRole("link", { name: /stock discrepancies/i });
    expect(link.getAttribute("href")).toBe("/stock-discrepancies");
  });

  test.each(["cashier", "auditor", null])("%s does not see the nav entry", (role) => {
    renderShell(role);
    expect(screen.queryByRole("link", { name: /stock discrepancies/i })).toBeNull();
  });
});
