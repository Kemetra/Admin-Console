import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";

const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { PlatformShell } from "@/platform/PlatformShell";
import { AppShell } from "@/shell/AppShell";

/**
 * RT-825 (RT-785 SHELL-M1, decisions D1/D2): at ≤768px the sidebar is hidden,
 * so the top bar carries a menu button that opens a modal navigation drawer at
 * the inline start. The drawer holds exactly the role's sidebar entries, the
 * user's name and role, the language and theme switches and sign-out. CSS
 * decides which of the two surfaces is visible; these tests prove the drawer's
 * content and behaviour.
 */

const LONG_NAME = "Mohamed Abdel Rahman El Sayed";

function contextFor(role: string, extra: Record<string, unknown> = {}) {
  return {
    context: {
      user: { id: "u1", email: "mohamed@northstar.eg", display_name: LONG_NAME },
      active_tenant: { id: "t1", name: "Northstar Retail" },
      active_store: null,
      active_role_code: role,
      memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail" }],
      ...extra,
    },
    switchTenant: vi.fn(),
    switchStore: vi.fn(),
    clearStore: vi.fn(),
  };
}

function renderShell(role = "tenant_admin", path = "/stores", onSignOut = vi.fn()) {
  activeContext.mockReturnValue(contextFor(role));
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell onSignOut={onSignOut} />
    </MemoryRouter>,
  );
  return onSignOut;
}

const menuButton = () => screen.getByRole("button", { name: "Menu" });
const openDrawer = () => {
  fireEvent.click(menuButton());
  return screen.getByRole("dialog", { name: "Menu" });
};
const labels = (root: Element) =>
  Array.from(root.querySelectorAll("a .nav-entry__label")).map((el) => el.textContent);

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

describe("compact shell menu button", () => {
  test("is collapsed, names the menu and points at nothing until opened", () => {
    renderShell();
    const button = menuButton();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.hasAttribute("aria-controls")).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("opens a modal drawer at the inline start and controls it", () => {
    renderShell();
    const dialog = openDrawer();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.classList.contains("drawer--start")).toBe(true);
    const button = menuButton();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe(dialog.id);
  });
});

describe("compact shell drawer content", () => {
  test.each(["tenant_admin", "cashier", "owner"])(
    "lists exactly the sidebar entries for %s, with their section headings",
    (role) => {
      renderShell(role);
      const sidebar = screen.getByRole("navigation", { name: "Primary" });
      const dialog = openDrawer();
      const drawerNav = within(dialog).getByRole("navigation", { name: "Primary" });
      expect(labels(drawerNav)).toEqual(labels(sidebar));
      const sections = (root: Element) =>
        Array.from(root.querySelectorAll(".nav-section")).map((el) => el.textContent);
      expect(sections(drawerNav)).toEqual(sections(sidebar));
    },
  );

  test("marks the current destination with aria-current", () => {
    renderShell("tenant_admin", "/stores");
    const dialog = openDrawer();
    const current = within(dialog).getByRole("link", { name: "Stores" });
    expect(current.getAttribute("aria-current")).toBe("page");
  });

  test("shows the full name and role, the switches and sign-out", () => {
    renderShell("tenant_admin");
    const dialog = openDrawer();
    expect(within(dialog).getByText(LONG_NAME)).toBeDefined();
    expect(within(dialog).getByText("Tenant admin")).toBeDefined();
    expect(within(dialog).getByRole("button", { name: "التبديل إلى العربية" })).toBeDefined();
    expect(within(dialog).getByRole("button", { name: "Dark mode" })).toBeDefined();
    expect(within(dialog).getByRole("button", { name: "Sign out" })).toBeDefined();
  });

  test("sign-out in the drawer signs out", () => {
    const onSignOut = renderShell();
    const dialog = openDrawer();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  test("the drawer's theme switch keeps the top-bar switch in step", async () => {
    renderShell();
    const dialog = openDrawer();
    // The top-bar switch follows the painted theme (a MutationObserver: async).
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Dark mode" }));
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
    const pressed = screen
      .getAllByRole("button", { name: "Dark mode" })
      .map((b) => b.getAttribute("aria-pressed"));
    expect(pressed).toEqual(["true", "true"]);
  });

  test("inside a support session it lists only the platform link", () => {
    activeContext.mockReturnValue(
      contextFor("owner", {
        support_session: {
          id: "11111111-1111-4111-8111-111111111111",
          tenant_id: "t1",
          purpose: "incident",
          ticket_ref: "SUP-1",
          status: "active",
          expires_at: new Date(Date.now() + 40 * 60_000).toISOString(),
          renewal_cap_at: new Date(Date.now() + 8 * 3_600_000).toISOString(),
        },
      }),
    );
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell onSignOut={vi.fn()} />
      </MemoryRouter>,
    );
    const dialog = openDrawer();
    expect(labels(dialog)).toEqual(["Organizations"]);
  });
});

describe("compact shell drawer closing", () => {
  test("Escape closes and returns focus to the menu button", () => {
    renderShell();
    const dialog = openDrawer();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(menuButton());
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
  });

  test("choosing a destination closes it, the current one too", () => {
    renderShell("tenant_admin", "/stores");
    fireEvent.click(within(openDrawer()).getByRole("link", { name: "Audit" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(within(openDrawer()).getByRole("link", { name: "Audit" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("growing past the compact width closes it", () => {
    let listener: ((e: { matches: boolean }) => void) | undefined;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
          listener = fn;
        },
        removeEventListener: vi.fn(),
      })),
    );
    renderShell();
    openDrawer();
    act(() => listener?.({ matches: false }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("platform shell compact menu", () => {
  test("opens a drawer with the platform nav, the switches and sign-out", () => {
    activeContext.mockReturnValue(contextFor("owner", { active_tenant: null, memberships: [] }));
    const onSignOut = vi.fn();
    render(
      <MemoryRouter initialEntries={["/platform/tenants"]}>
        <PlatformShell onSignOut={onSignOut} />
      </MemoryRouter>,
    );
    const dialog = openDrawer();
    const nav = within(dialog).getByRole("navigation", { name: "Platform" });
    expect(labels(nav)).toEqual(["Organizations"]);
    expect(within(dialog).getByText(LONG_NAME)).toBeDefined();
    expect(within(dialog).getByRole("button", { name: "Dark mode" })).toBeDefined();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
