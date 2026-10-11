/**
 * RT-398 opt-in dark theme. Light is the default; a user's choice sets
 * data-theme="dark" on <html>, which remaps the colour roles in tokens.css.
 *
 * Storage is browser-local (there is no Backend-Core user-preference contract):
 *  - `rt.theme.v1:user:<id>` holds each user's own choice, so inside the shell a
 *    shared admin PC keeps one operator's preference from leaking to the next.
 *    Screens before the shell (sign-in, scope gate, no-access) follow the
 *    browser's last choice until the shell mounts;
 *  - `rt.theme.v1:last` mirrors the most recent choice on this browser. The inline
 *    pre-paint script in index.html reads it before the bundle loads, so a dark
 *    user does not see a light flash on reload. Keep THEME_LAST_KEY in step with
 *    that script (tests/unit/theme.test.tsx checks it).
 *
 * Every storage access is guarded: private windows and blocked site data throw,
 * and the theme then simply stays light.
 */

export type Theme = "light" | "dark";

export const THEME_LAST_KEY = "rt.theme.v1:last";
export const themeUserKey = (userId: string): string => `rt.theme.v1:user:${userId}`;

function read(key: string): Theme | null {
  try {
    const v = window.localStorage.getItem(key);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

function write(key: string, theme: Theme): void {
  try {
    window.localStorage.setItem(key, theme);
  } catch {
    // Storage unavailable: the choice holds for this page only.
  }
}

/** The theme currently painted (set by the pre-paint script or a later apply). */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  if (theme === "dark") {
    document.documentElement.dataset.theme = "dark";
  } else {
    delete document.documentElement.dataset.theme;
  }
}

/**
 * The theme for a signed-in user: their own stored choice, else light (the
 * default). Another user's earlier choice on this browser never carries over.
 */
export function storedThemeFor(userId: string): Theme {
  return read(themeUserKey(userId)) ?? "light";
}

/** Persist and apply a user's choice. */
export function saveTheme(userId: string | undefined, theme: Theme): void {
  if (userId) write(themeUserKey(userId), theme);
  write(THEME_LAST_KEY, theme);
  applyTheme(theme);
}
