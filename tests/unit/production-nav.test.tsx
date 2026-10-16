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
      "Shift closes",
      "Connection & sync",
      "Devices",
      "Sign out",
    ]);
    expect(nav.querySelector("[aria-disabled='true']")).toBeNull();
    expect(within(nav).queryByText(/^RF-/)).toBeNull();
  });

  test.each(["owner", "tenant_admin", "store_manager"])(
    "RT-18: the shift-close review is listed for %s",
    (role) => {
      expect(entryLabels(renderShell(role, false))).toContain("Shift closes");
    },
  );

  test("RT-18: the shift-close review is hidden from roles the API refuses", () => {
    expect(entryLabels(renderShell("cashier", false))).not.toContain("Shift closes");
  });

  // RT-560 / RT-557 OD-2: one entry in its own "Integration" section, for the
  // roles the API lets read the ERP connection & sync status.
  test.each(["owner", "tenant_admin"])(
    "RT-560: %s sees Connection & sync in its section",
    (role) => {
      const nav = renderShell(role, false);
      expect(
        within(nav).getByRole("link", { name: "Connection & sync" }).getAttribute("href"),
      ).toBe("/erp-connection");
      expect(within(nav).getByText("Integration").className).toBe("nav-section");
    },
  );

  test.each(["store_manager", "cashier", "auditor"])("RT-560: %s has no entry", (role) => {
    const nav = renderShell(role, false);
    expect(entryLabels(nav)).not.toContain("Connection & sync");
    expect(within(nav).queryByText("Integration")).toBeNull();
  });

  // RT-371: the device registry, in its own "Point of sale" section, for the
  // roles the RT-365 API lets read it.
  test.each(["owner", "tenant_admin", "store_manager"])(
    "RT-371: %s sees Devices in its section",
    (role) => {
      const nav = renderShell(role, false);
      expect(within(nav).getByRole("link", { name: "Devices" }).getAttribute("href")).toBe(
        "/devices",
      );
      expect(within(nav).getByText("Point of sale").className).toBe("nav-section");
    },
  );

  test.each(["store_staff", "cashier", "auditor"])("RT-371: %s has no Devices entry", (role) => {
    const nav = renderShell(role, false);
    expect(entryLabels(nav)).not.toContain("Devices");
    expect(within(nav).queryByText("Point of sale")).toBeNull();
  });

  test("dev builds keep the gated placeholders, marked disabled", () => {
    const nav = renderShell("owner", true);
    expect(entryLabels(nav)).toContain("Catalog");
    expect(within(nav).getByText("RF-3")).toBeDefined();
    expect(nav.querySelectorAll("[aria-disabled='true']")).toHaveLength(2);
  });
});
