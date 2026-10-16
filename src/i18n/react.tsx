/**
 * RT-399 React bindings. `useT()` subscribes the calling component to the
 * active locale, so a switch re-renders it in the new language: a component
 * that renders catalog copy calls `useT()` (or `useLocale()`).
 *
 * Rule for state: never keep a translated string in React state or the query
 * cache. Keep the message key (and params) and translate at render, so a
 * switch can't leave one string behind in the old language.
 */
import { Fragment, createElement, useEffect, useSyncExternalStore } from "react";
import { formatDateTime, formatMoney, formatSignedMoney } from "./format";
import { type Locale, applyLocaleToDocument, getLocale, subscribeLocale } from "./locale";
import {
  type MessageKey,
  type Params,
  formatNumber,
  splitTemplate,
  templateFor,
  translate,
} from "./translate";

export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

export type RichParams = Record<string, React.ReactNode>;

export interface T {
  (key: MessageKey, params?: Params): string;
  /**
   * Like `t()`, but params may be React nodes, so machine data and times keep
   * their own element inside a translated sentence (`<bdi>`, `<time>`,
   * `<strong>`). A numeric `count` still selects the plural branch.
   */
  rich: (key: MessageKey, params: RichParams) => React.ReactNode;
  locale: Locale;
}

function richFor(locale: Locale, key: MessageKey, params: RichParams): React.ReactNode {
  const count = typeof params.count === "number" ? { count: params.count } : undefined;
  const parts = splitTemplate(templateFor(locale, key, count));
  const nodes = parts.map((part, i): React.ReactNode => {
    if (i % 2 === 0) return part;
    const value = params[part];
    if (value === undefined) return `{${part}}`;
    return typeof value === "number" ? formatNumber(value, locale) : value;
  });
  // Spread as children, not an array: the parts are positional, so no keys.
  return createElement(Fragment, null, ...nodes);
}

const bound = new Map<Locale, T>();

/** A `t` bound to `locale` (stable per locale). */
export function tFor(locale: Locale): T {
  let fn = bound.get(locale);
  if (!fn) {
    const t = ((key: MessageKey, params?: Params) => translate(locale, key, params)) as T;
    t.rich = (key, params) => richFor(locale, key, params);
    t.locale = locale;
    fn = t;
    bound.set(locale, fn);
  }
  return fn;
}

/** The active locale's `t`; re-renders the caller on a locale switch. */
export function useT(): T {
  return tFor(useLocale());
}

/**
 * Keeps <html lang/dir> and the document title in step with the active
 * locale. Mounted once at the app root.
 */
export function DocumentLocale(): null {
  const t = useT();
  useEffect(() => {
    applyLocaleToDocument(t.locale);
    document.title = t("app.title");
  }, [t]);
  return null;
}

/**
 * An exact `Money` amount as `1,250.00 EGP`, isolated LTR (UX-12). EGP unless
 * the contract gives a `currency` code. `signed` writes an explicit sign
 * (`+12.50 EGP` / `-12.50 EGP`) for a signed difference; direction never implies
 * a colour.
 */
export function Money({
  value,
  currency,
  signed,
  className,
}: Readonly<{
  value: string;
  currency?: string;
  signed?: boolean;
  className?: string;
}>): React.JSX.Element {
  return (
    <bdi dir="ltr" className={className}>
      {signed ? formatSignedMoney(value, currency) : formatMoney(value, currency)}
    </bdi>
  );
}

/**
 * An operational instant in human form, in the Store's time zone when known
 * (RT-401) and labelled UTC otherwise. The exact ISO value stays in
 * `dateTime` and the tooltip.
 */
export function DateTime({
  value,
  timeZone,
  className,
}: Readonly<{
  value: string;
  timeZone?: string;
  className?: string;
}>): React.JSX.Element {
  const locale = useLocale();
  return (
    <time dateTime={value} title={value} className={className}>
      {formatDateTime(value, { timeZone, locale })}
    </time>
  );
}
