/**
 * RT-399 localization layer (RT-266 plan §3). Built-in `Intl` and TypeScript
 * only; no i18n package.
 */
export {
  DEFAULT_LOCALE,
  DIRECTION,
  LANG_TAG,
  LOCALES,
  type Locale,
  getLocale,
  intlTag,
  saveLocale,
  setLocale,
  storedLocaleFor,
} from "./locale";
export { type MessageKey, type Params, t, translate } from "./translate";
export {
  CURRENCY,
  formatDateTime,
  formatDuration,
  formatEvidenceTime,
  formatMoney,
  formatNumber,
  formatSignedMoney,
} from "./format";
export { roleKey, roleLabel } from "./roles";
export {
  DateTime,
  DocumentLocale,
  Money,
  type T,
  tFor,
  useLocale,
  useT,
} from "./react";
