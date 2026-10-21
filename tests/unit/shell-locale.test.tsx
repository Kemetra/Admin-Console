import { LOCALE_LAST_KEY, __setFallbackLocaleForTests, localeUserKey } from "@/i18n/locale";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { AppShell } from "@/shell/AppShell";

/**
 * RT-399 in the real shell: Arabic RTL by default, the top-bar switch flips the
 * whole frame to English LTR, the choice is remembered per user, and the role
 * shows as a label in one language, never as a raw code.
 */

function renderShell(userId = "u1"): void {
  activeContext.mockReturnValue({
    context: {
      user: { id: userId, display_name: "Amal Saleh" },
      active_tenant: { id: "t1", name: "Northstar Retail" },
      active_store: null,
      active_role_code: "cashier",
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

const html = () => document.documentElement;

function navLabels(): string[] {
  return Array.from(document.querySelectorAll(".nav-entry__label")).map(
    (el) => el.textContent ?? "",
  );
}

beforeEach(() => {
  // Prove the product default: undo the English pin of tests/unit/setup.ts.
  __setFallbackLocaleForTests("ar");
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("shell locale", () => {
  test("a user with no stored choice gets the Arabic RTL shell", () => {
    renderShell();
    expect(html().lang).toBe("ar-EG");
    expect(html().dir).toBe("rtl");
    expect(screen.getByRole("navigation", { name: "التنقل الرئيسي" })).toBeDefined();
    expect(navLabels()).toEqual([
      "نظرة عامة",
      "المؤسسات",
      "المتاجر",
      "المستخدمون",
      "سجل التدقيق",
      "تسجيل الخروج",
    ]);
    expect(screen.getByText("الكاشير")).toBeDefined(); // role label, not "cashier"
    expect(screen.queryByText("cashier")).toBeNull();
    expect(screen.getByRole("button", { name: "الوضع الداكن" })).toBeDefined();
    expect(screen.getByText("كل المتاجر")).toBeDefined();
  });

  test("the switch flips the frame to English LTR and remembers it for this user", () => {
    renderShell("u1");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Switch to English" }));
    });
    expect(html().lang).toBe("en");
    expect(html().dir).toBe("ltr");
    expect(navLabels()).toEqual([
      "Overview",
      "Tenants",
      "Stores",
      "Operators",
      "Audit",
      "Sign out",
    ]);
    expect(screen.getByText("Cashier")).toBeDefined();
    expect(screen.getByRole("button", { name: "Dark mode" })).toBeDefined();
    expect(window.localStorage.getItem(localeUserKey("u1"))).toBe("en");
    expect(window.localStorage.getItem(LOCALE_LAST_KEY)).toBe("en");
  });

  test("one locale at a time: no frame label mixes Arabic and Latin prose", () => {
    renderShell();
    const latinWord = /[A-Za-z]{2,}/;
    for (const label of navLabels()) expect(latinWord.test(label), label).toBe(false);
    // The only Latin text is the language switch itself (named in its own language).
    const switchButton = screen.getByRole("button", { name: "Switch to English" });
    expect(switchButton.getAttribute("lang")).toBe("en");
  });

  test("a stored English choice is restored for that user when the shell mounts", () => {
    window.localStorage.setItem(localeUserKey("u9"), "en");
    renderShell("u9");
    expect(html().dir).toBe("ltr");
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeDefined();
  });
});
