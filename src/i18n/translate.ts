/**
 * RT-399 message lookup (RT-266 plan §3.2). Whole sentences with named
 * `{param}` placeholders; plural maps resolve on the `count` param with
 * `Intl.PluralRules`. Numeric params render with Western digits and grouping in
 * both locales (UX-12). No string concatenation happens at call sites, so word
 * order, agreement and bidi stay the translator's call.
 *
 * Kept free of React and of the `@/` path alias, so the e2e suites can import it
 * to select by the same copy the app renders.
 */
import { type Locale, getLocale, intlTag } from "./locale";
import { ar } from "./messages/ar";
import { en } from "./messages/en";
import type { Message, Messages } from "./messages/types";

export type MessageKey = keyof typeof ar;

export type Params = Record<string, string | number>;

const CATALOGS: Record<Locale, Messages> = { ar, en };

const numberFormats = new Map<Locale, Intl.NumberFormat>();
const pluralRules = new Map<Locale, Intl.PluralRules>();

/** A count or plain number with Western digits and grouping (`1,284`). */
export function formatNumber(value: number, locale: Locale = getLocale()): string {
  let nf = numberFormats.get(locale);
  if (!nf) {
    nf = new Intl.NumberFormat(intlTag(locale));
    numberFormats.set(locale, nf);
  }
  return nf.format(value);
}

function pluralCategory(locale: Locale, count: number): Intl.LDMLPluralRule {
  let pr = pluralRules.get(locale);
  if (!pr) {
    pr = new Intl.PluralRules(intlTag(locale));
    pluralRules.set(locale, pr);
  }
  return pr.select(count);
}

/** The template for a message: the plural branch for `count`, else `other`. */
function template(locale: Locale, message: Message, params?: Params): string {
  if (typeof message === "string") return message;
  const count = params?.count;
  if (typeof count !== "number") return message.other;
  return message[pluralCategory(locale, count)] ?? message.other;
}

const PLACEHOLDER = /\{(\w+)\}/g;

/** Split a template into literal text and `{param}` names (odd indexes). */
export function splitTemplate(text: string): string[] {
  return text.split(PLACEHOLDER);
}

/** Resolve a key to its template in `locale`, before params are filled. */
export function templateFor(locale: Locale, key: MessageKey, params?: Params): string {
  return template(locale, CATALOGS[locale][key] as Message, params);
}

/** The localized string for `key` in `locale`, with params filled in. */
export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  return templateFor(locale, key, params).replace(PLACEHOLDER, (whole, name: string) => {
    const value = params?.[name];
    if (value === undefined) return whole;
    return typeof value === "number" ? formatNumber(value, locale) : value;
  });
}

/** `translate` in the active locale. React components use `useT()` instead. */
export function t(key: MessageKey, params?: Params): string {
  return translate(getLocale(), key, params);
}
