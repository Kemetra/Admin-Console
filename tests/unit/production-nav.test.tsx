import { cleanup, render, screen, within } from "@testing-library/react";
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
      "Sales",
      "Stock discrepancies",
      "Unknown items",
      "Shift closes",
      "Connection & sync",
      "Devices",
      "Payer accounts",
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

  // RT-587 (spec 012 FR-012 / OD-556-3): Sales, in its own "Transactions"
  // section, only for the roles the console sales read serves.
  test.each(["owner", "tenant_admin", "store_manager"])(
    "RT-587: %s sees Sales in its section",
    (role) => {
      const nav = renderShell(role, false);
      expect(within(nav).getByRole("link", { name: "Sales" }).getAttribute("href")).toBe("/sales");
      expect(within(nav).getByText("Transactions").className).toBe("nav-section");
    },
  );

  test.each(["store_staff", "cashier", "auditor"])("RT-587: %s has no Sales entry", (role) => {
    const nav = renderShell(role, false);
    expect(entryLabels(nav)).not.toContain("Sales");
    expect(within(nav).queryByText("Transactions")).toBeNull();
  });

  // RT-421: payer accounts, in their own "Payers" section, for owner / tenant_admin
  // only (both payer routes are `@Roles("owner", "tenant_admin")`).
  test.each(["owner", "tenant_admin"])("RT-421: %s sees Payer accounts in its section", (role) => {
    const nav = renderShell(role, false);
    expect(within(nav).getByRole("link", { name: "Payer accounts" }).getAttribute("href")).toBe(
      "/payer-accounts",
    );
    expect(within(nav).getByText("Payers").className).toBe("nav-section");
  });

  test.each(["store_manager", "store_staff", "cashier", "auditor"])(
    "RT-421: %s has no Payer accounts entry",
    (role) => {
      const nav = renderShell(role, false);
      expect(entryLabels(nav)).not.toContain("Payer accounts");
      expect(within(nav).queryByText("Payers")).toBeNull();
    },
  );

  test("RT-421: no navigation entry leads to the retired receivables screens", () => {
    for (const role of ["owner", "tenant_admin", "store_manager"]) {
      const nav = renderShell(role, true);
      expect(entryLabels(nav).join("|")).not.toMatch(/receivable|claim|remittance|apply payment/i);
      for (const link of within(nav).queryAllByRole("link")) {
        expect(link.getAttribute("href")).not.toMatch(/receivables|claims|apply-payment/);
      }
      cleanup();
    }
  });

  test("dev builds keep the gated placeholders, marked disabled", () => {
    const nav = renderShell("owner", true);
    expect(entryLabels(nav)).toContain("Catalog");
    expect(within(nav).getByText("RF-3")).toBeDefined();
    expect(nav.querySelectorAll("[aria-disabled='true']")).toHaveLength(1);
    expect(within(nav).queryByText("RF-4")).toBeNull();
  });

  // RT-724: the unknown-items queue left the RF-4 gate, in its own "Catalog"
  // section, for the roles the list API serves.
  test.each(["owner", "tenant_admin", "store_manager"])(
    "RT-724: %s sees Unknown items in its section",
    (role) => {
      const nav = renderShell(role, false);
      expect(within(nav).getByRole("link", { name: "Unknown items" }).getAttribute("href")).toBe(
        "/unknown-items",
      );
      expect(within(nav).getByText("Catalog").className).toBe("nav-section");
    },
  );

  test.each(["store_staff", "cashier", "auditor"])(
    "RT-724: %s has no Unknown items entry",
    (role) => {
      const nav = renderShell(role, false);
      expect(entryLabels(nav)).not.toContain("Unknown items");
    },
  );
});
