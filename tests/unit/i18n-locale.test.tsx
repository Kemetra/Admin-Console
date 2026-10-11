import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import {
  LOCALE_LAST_KEY,
  __setFallbackLocaleForTests,
  adoptUserLocale,
  getLocale,
  lastLocale,
  localeUserKey,
  saveLocale,
  setLocale,
  storedLocaleFor,
} from "@/i18n/locale";
import { useT } from "@/i18n/react";
import { roleLabel } from "@/i18n/roles";
import { t, translate } from "@/i18n/translate";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * RT-399: the Arabic default, per-user persistence, the pre-paint key, the
 * top-bar switch, and message lookup.
 */

beforeEach(() => {
  // This file proves the product default, so undo the English pin of setup.ts.
  __setFallbackLocaleForTests("ar");
  setLocale("ar");
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

const html = () => document.documentElement;

describe("default and document direction", () => {
  test("Arabic is the default for a user with no stored choice", () => {
    expect(storedLocaleFor("u1")).toBe("ar");
    expect(lastLocale()).toBe("ar");
  });

  test("switching paints lang and dir on <html>", () => {
    setLocale("en");
    expect(html().lang).toBe("en");
    expect(html().dir).toBe("ltr");
    setLocale("ar");
    expect(html().lang).toBe("ar-EG");
    expect(html().dir).toBe("rtl");
  });

  test("index.html ships Arabic RTL and restores English from the same key the app writes", () => {
    const page = readFileSync(join(process.cwd(), "index.html"), "utf8");
    expect(page).toContain('<html lang="ar-EG" dir="rtl">');
    expect(page).toContain(`localStorage.getItem("${LOCALE_LAST_KEY}") === "en"`);
    expect(page).toContain('document.documentElement.dir = "ltr"');
  });
});

describe("per-user persistence", () => {
  test("saving stores the user's choice and the last-choice mirror, and switches", () => {
    saveLocale("u1", "en");
    expect(window.localStorage.getItem(localeUserKey("u1"))).toBe("en");
    expect(window.localStorage.getItem(LOCALE_LAST_KEY)).toBe("en");
    expect(getLocale()).toBe("en");
    expect(storedLocaleFor("u1")).toBe("en");
  });

  test("another user's choice on this browser does not carry over", () => {
    saveLocale("u1", "en");
    expect(storedLocaleFor("u2")).toBe("ar");
    adoptUserLocale("u2");
    expect(getLocale()).toBe("ar");
    // The mirror follows the user now on screen, so a reload paints Arabic.
    expect(window.localStorage.getItem(LOCALE_LAST_KEY)).toBe("ar");
  });

  test("blocked storage never throws; the choice still applies to the page", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(storedLocaleFor("u1")).toBe("ar");
    expect(() => saveLocale("u1", "en")).not.toThrow();
    expect(getLocale()).toBe("en");
  });
});

describe("top-bar switch", () => {
  test("in Arabic it offers «English», in English, with an English name", () => {
    render(<LocaleSwitch userId="u1" />);
    const button = screen.getByRole("button", { name: "Switch to English" });
    expect(button.textContent).toBe("English");
    expect(button.getAttribute("lang")).toBe("en");
    expect(button.className).toContain("btn-ghost");
  });

  test("clicking switches, persists per user, and offers «العربية» back", () => {
    render(<LocaleSwitch userId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to English" }));
    expect(getLocale()).toBe("en");
    expect(html().dir).toBe("ltr");
    expect(window.localStorage.getItem(localeUserKey("u1"))).toBe("en");
    const back = screen.getByRole("button", { name: "التبديل إلى العربية" });
    expect(back.textContent).toBe("العربية");
    expect(back.getAttribute("lang")).toBe("ar-EG");
  });

  test("mounting for a signed-in user applies their stored choice", () => {
    window.localStorage.setItem(localeUserKey("u7"), "en");
    render(<LocaleSwitch userId="u7" />);
    expect(getLocale()).toBe("en");
  });
});

describe("message lookup", () => {
  function Label(): React.JSX.Element {
    const t = useT();
    return <span>{t("shell.nav.stores")}</span>;
  }

  test("useT re-renders its component in the new locale", () => {
    render(<Label />);
    expect(screen.getByText("المتاجر")).toBeTruthy();
    act(() => setLocale("en"));
    expect(screen.getByText("Stores")).toBeTruthy();
    expect(screen.queryByText("المتاجر")).toBeNull();
  });

  test("named params fill whole sentences", () => {
    expect(translate("ar", "shell.mismatch.stay", { store: "فرع المعادي" })).toBe(
      "البقاء في فرع المعادي",
    );
    expect(translate("en", "shell.mismatch.stay", { store: "Maadi" })).toBe("Stay in Maadi");
  });

  test("t() follows the active locale", () => {
    expect(t("common.cancel")).toBe("إلغاء");
    setLocale("en");
    expect(t("common.cancel")).toBe("Cancel");
  });

  test("rich params keep their own elements inside the sentence", () => {
    function Rich(): React.JSX.Element {
      const t = useT();
      return <p>{t.rich("components.banner.requestRef", { id: <bdi dir="ltr">req_42</bdi> })}</p>;
    }
    const { container } = render(<Rich />);
    expect(container.textContent).toBe("المرجع: req_42");
    expect(container.querySelector("bdi")?.getAttribute("dir")).toBe("ltr");
  });

  test("role codes become labels; an unknown code never shows raw", () => {
    expect(roleLabel("cashier", "ar")).toBe("الكاشير");
    expect(roleLabel("tenant_admin", "en")).toBe("Tenant admin");
    expect(roleLabel("auditor_x", "ar")).toBe("دور غير معروف");
    expect(roleLabel("constructor", "en")).toBe("Unknown role");
  });
});
