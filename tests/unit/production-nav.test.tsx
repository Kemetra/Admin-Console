import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, test, vi } from "vitest";

const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { AppShell } from "@/shell/AppShell";

function renderShell(role: string, showGatedNav: boolean): HTMLElement {
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
      <AppShell onSignOut={() => {}} showGatedNav={showGatedNav} />
    </MemoryRouter>,
  );
  return screen.getByRole("navigation", { name: "Primary" });
}

function entryLabels(nav: HTMLElement): string[] {
  return Array.from(nav.querySelectorAll(".nav-entry__label")).map((el) => el.textContent ?? "");
}

/**
 * RT-270 (UX-09: no dead destinations). A production build lists only live
 * destinations; the RF-* gated placeholders stay available to dev builds.
 */
describe("production navigation", () => {
  test("production nav lists only live destinations", () => {
    const nav = renderShell("owner", false);
    expect(entryLabels(nav)).toEqual([
      "Overview",
      "Tenants",
      "Stores",
      "Operators",
      "Audit",
      "Stock discrepancies",
      "Sign out",
    ]);
    expect(nav.querySelector("[aria-disabled='true']")).toBeNull();
    expect(within(nav).queryByText(/^RF-/)).toBeNull();
  });

  test("dev builds keep the gated placeholders, marked disabled", () => {
    const nav = renderShell("owner", true);
    expect(entryLabels(nav)).toContain("Catalog");
    expect(within(nav).getByText("RF-3")).toBeDefined();
    expect(nav.querySelectorAll("[aria-disabled='true']")).toHaveLength(2);
  });
});
