/**
 * RT-399 locale state (RT-266 plan §3.1). Arabic is the product default; English
 * is the second locale. Exactly one locale renders at a time (UX-12), and the
 * browser or OS language never picks it ("product locale beats device accident").
 *
 * The active locale lives in a small external store, so any component can read
 * it with `useLocale()` / `useT()` (re-rendering on a switch) and non-React code
 * (error mappers, formatters) can read it with `getLocale()`. Switching applies
 * `lang` and `dir` to <html>; the logical CSS mirrors the layout from there.
 *
 * Storage follows the RT-398 theme pattern (there is no Backend-Core
 * user-preference contract):
 *  - `rt.locale.v1:user:<id>` holds each user's own choice, so a shared admin PC
 *    keeps one operator's language from carrying over to the next;
 *  - `rt.locale.v1:last` mirrors the most recent choice on this browser. The
 *    inline pre-paint script in index.html reads it before the bundle loads, so
 *    an English user never sees an Arabic RTL flash on reload. Keep
 *    LOCALE_LAST_KEY in step with that script (tests/unit/i18n-locale.test.tsx
 *    checks it).
 *
 * Every storage access is guarded: private windows and blocked site data throw,
 * and the choice then holds for this page only.
 */

export type Locale = "ar" | "en";

/** UX-12: Arabic is the primary authored product language. */
export const DEFAULT_LOCALE: Locale = "ar";

export const LOCALES: readonly Locale[] = ["ar", "en"];

/** The BCP 47 tag written to <html lang>. */
export const LANG_TAG: Record<Locale, string> = { ar: "ar-EG", en: "en" };

export const DIRECTION: Record<Locale, "rtl" | "ltr"> = { ar: "rtl", en: "ltr" };

/** The tag every Intl formatter uses: Western digits in both locales (UX-12). */
export function intlTag(locale: Locale): string {
  return `${LANG_TAG[locale]}-u-nu-latn`;
}

export const LOCALE_LAST_KEY = "rt.locale.v1:last";
export const localeUserKey = (userId: string): string => `rt.locale.v1:user:${userId}`;

function isLocale(value: unknown): value is Locale {
  return value === "ar" || value === "en";
}

function read(key: string): Locale | null {
  try {
    const v = window.localStorage.getItem(key);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

function write(key: string, locale: Locale): void {
  try {
    window.localStorage.setItem(key, locale);
  } catch {
    // Storage unavailable: the choice holds for this page only.
  }
}

// --- The product default ---------------------------------------------------

let fallback: Locale = DEFAULT_LOCALE;

/**
 * Test seam only. The unit suites written against English copy pin English as
 * the fallback (tests/unit/setup.ts); the Arabic default is proven by the
 * tests that reset it and by the Arabic e2e project. Production never calls it.
 */
export function __setFallbackLocaleForTests(locale: Locale): void {
  fallback = locale;
}

// --- The active-locale store -----------------------------------------------

/** What the pre-paint script (or a later apply) already painted on <html>. */
function paintedLocale(): Locale {
  const lang = typeof document === "undefined" ? "" : document.documentElement.lang;
  if (lang.startsWith("en")) return "en";
  if (lang.startsWith("ar")) return "ar";
  return fallback;
}

let current: Locale = paintedLocale();
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Paint `lang`/`dir` on <html>. Portals inherit them from the document. */
export function applyLocaleToDocument(locale: Locale): void {
  if (typeof document === "undefined") return; // node-side callers (tests, tooling)
  document.documentElement.lang = LANG_TAG[locale];
  document.documentElement.dir = DIRECTION[locale];
}

/** Switch the active locale for this page (no storage write). */
export function setLocale(locale: Locale): void {
  applyLocaleToDocument(locale);
  if (locale === current) return;
  current = locale;
  for (const listener of listeners) listener();
}

// --- Per-user persistence --------------------------------------------------

/**
 * The locale for a signed-in user: their own stored choice, else the product
 * default (Arabic). Another user's earlier choice on this browser never
 * carries over.
 */
export function storedLocaleFor(userId: string): Locale {
  return read(localeUserKey(userId)) ?? fallback;
}

/** The most recent choice on this browser (what the pre-paint script reads). */
export function lastLocale(): Locale {
  return read(LOCALE_LAST_KEY) ?? fallback;
}

/**
 * Once the signed-in user is known, show their own choice (or the default) and
 * point the last-choice mirror at it, so the next reload paints it directly.
 */
export function adoptUserLocale(userId: string): Locale {
  const mine = storedLocaleFor(userId);
  write(LOCALE_LAST_KEY, mine);
  setLocale(mine);
  return mine;
}

/** Persist a user's choice, update the last-choice mirror, and switch to it. */
export function saveLocale(userId: string | undefined, locale: Locale): void {
  if (userId) write(localeUserKey(userId), locale);
  write(LOCALE_LAST_KEY, locale);
  setLocale(locale);
}
