import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ThemeToggle } from "@/theme/ThemeToggle";
import {
  THEME_LAST_KEY,
  applyTheme,
  currentTheme,
  saveTheme,
  storedThemeFor,
  themeUserKey,
} from "@/theme/theme";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

/** RT-398: theme storage, the pre-paint key, and the top-bar toggle. */

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

describe("theme storage", () => {
  test("light is the default for a user with no stored choice", () => {
    expect(storedThemeFor("u1")).toBe("light");
  });

  test("saving stores the user's choice and the last-choice mirror, and paints it", () => {
    saveTheme("u1", "dark");
    expect(window.localStorage.getItem(themeUserKey("u1"))).toBe("dark");
    expect(window.localStorage.getItem(THEME_LAST_KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(storedThemeFor("u1")).toBe("dark");
  });

  test("another user's choice on this browser does not carry over", () => {
    saveTheme("u1", "dark");
    expect(storedThemeFor("u2")).toBe("light");
  });

  test("light removes the attribute instead of writing data-theme=light", () => {
    applyTheme("dark");
    applyTheme("light");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(currentTheme()).toBe("light");
  });

  test("blocked storage never throws; the theme still applies to the page", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(storedThemeFor("u1")).toBe("light");
    expect(() => saveTheme("u1", "dark")).not.toThrow();
    expect(currentTheme()).toBe("dark");
  });

  test("an unknown stored value reads as light", () => {
    window.localStorage.setItem(themeUserKey("u1"), "sepia");
    expect(storedThemeFor("u1")).toBe("light");
  });

  test("index.html's pre-paint script reads the same key as THEME_LAST_KEY", () => {
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
    expect(html).toContain(`localStorage.getItem("${THEME_LAST_KEY}") === "dark"`);
  });
});

describe("ThemeToggle", () => {
  test("a constant label; aria-pressed and <html> follow each press", () => {
    render(<ThemeToggle userId="u1" />);
    const button = screen.getByRole("button", { name: "Dark mode" });
    expect(button.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Dark mode" })).toBe(button);

    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(storedThemeFor("u1")).toBe("light");
  });

  test("starts from what is painted, then the user's own choice wins", async () => {
    // The pre-paint script painted dark (last user on this browser chose dark)...
    document.documentElement.dataset.theme = "dark";
    window.localStorage.setItem(THEME_LAST_KEY, "dark");
    // ...but this user never chose, so they get the light default.
    await act(async () => {
      render(<ThemeToggle userId="u2" />);
    });
    expect(screen.getByRole("button", { name: "Dark mode" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(currentTheme()).toBe("light");
    expect(window.localStorage.getItem(THEME_LAST_KEY)).toBe("light");
  });

  test("a user who chose dark keeps it on the next mount", async () => {
    window.localStorage.setItem(themeUserKey("u1"), "dark");
    await act(async () => {
      render(<ThemeToggle userId="u1" />);
    });
    expect(screen.getByRole("button", { name: "Dark mode" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(currentTheme()).toBe("dark");
  });
});
