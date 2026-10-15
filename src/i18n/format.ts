/**
 * RT-399 human formatters (RT-266 plan §3.4, UX-12). Pure, locale-explicit
 * (defaulting to the active locale), and never reading `navigator.language`.
 *
 *  - Money: `1,250.00 EGP` in both locales, from the exact-decimal `Money`
 *    string. No float ever touches the value, and arithmetic is unchanged.
 *  - Operational date/time: «7 أكتوبر 2026، 13:42» / `Oct 7, 2026, 13:42`,
 *    Western digits, 24-hour, in the Store's time zone.
 *  - Evidence timestamps (Audit): exact UTC, locale-independent.
 *  - Durations: whole phrases with plural categories from the catalog.
 */
import { type Locale, getLocale, intlTag } from "./locale";
import { translate } from "./translate";

export { formatNumber } from "./translate";

// --- Money -------------------------------------------------------------------

/**
 * Every Admin `Money` value is EGP (RT-399 scope; RT-266 Q3). The contract
 * carries no currency field, so this is a constant until it does.
 */
export const CURRENCY = "EGP";

const MONEY = /^([+-])?(\d+)(?:\.(\d+))?$/;

// Plain scans rather than regexes: `/0+$/` and lookahead grouping backtrack
// quadratically on long digit runs (RT-510).

function trimTrailingZeros(digits: string): string {
  let end = digits.length;
  while (end > 0 && digits[end - 1] === "0") end--;
  return digits.slice(0, end);
}

/** `1234567` → `1,234,567`. */
function groupThousands(digits: string): string {
  const head = digits.length % 3 || 3;
  const groups = [digits.slice(0, head)];
  for (let i = head; i < digits.length; i += 3) groups.push(digits.slice(i, i + 3));
  return groups.join(",");
}

/**
 * `1250.5000` → `1,250.50 EGP`; `-1250.5` → `-1,250.50 EGP`.
 *
 * Precision (RT-266 Q2, pending the owner's call): `Money` is `numeric(19,4)`.
 * Two minor digits are always shown; a non-zero third or fourth digit is kept
 * rather than rounded away, so the display never misstates the exact value
 * (`10.1250` → `10.125 EGP`). Anything that is not a plain decimal string is
 * returned unchanged instead of guessed at.
 */
export function formatMoney(amount: string): string {
  const match = MONEY.exec(amount.trim());
  if (!match) return amount;
  const [, sign, intDigits, fracDigits = ""] = match;
  const int = intDigits.replace(/^0+(?=\d)/, "");
  let frac = trimTrailingZeros(fracDigits);
  if (frac.length < 2) frac = frac.padEnd(2, "0");
  const grouped = groupThousands(int);
  const isZero = /^0+$/.test(int) && /^0*$/.test(fracDigits);
  const minus = sign === "-" && !isZero ? "-" : "";
  return `${minus}${grouped}.${frac} ${CURRENCY}`;
}

// --- Operational date/time ---------------------------------------------------

const dateFormats = new Map<string, Intl.DateTimeFormat>();

function dateTimeFormat(
  locale: Locale,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${timeZone}|${JSON.stringify(options)}`;
  let f = dateFormats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(intlTag(locale), { ...options, timeZone });
    dateFormats.set(key, f);
  }
  return f;
}

function isValidZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export interface DateTimeOptions {
  /**
   * The Store's IANA time zone. Backend-Core does not expose it yet (RT-401),
   * so callers pass nothing today and the value is shown in UTC, labelled as
   * such, instead of guessing a zone.
   */
  timeZone?: string;
  locale?: Locale;
}

/**
 * «7 أكتوبر 2026، 13:42» / `Oct 7, 2026, 13:42` in the Store's time zone; with
 * no known zone, the same in UTC with a `UTC` label. An unparseable value is
 * returned unchanged.
 */
export function formatDateTime(iso: string, options: DateTimeOptions = {}): string {
  const locale = options.locale ?? getLocale();
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const zone = options.timeZone && isValidZone(options.timeZone) ? options.timeZone : undefined;
  const tz = zone ?? "UTC";
  const day = dateTimeFormat(locale, tz, {
    day: "numeric",
    month: locale === "ar" ? "long" : "short",
    year: "numeric",
  }).format(date);
  const time = dateTimeFormat(locale, tz, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return translate(locale, zone ? "format.dateTime" : "format.dateTimeUtc", { date: day, time });
}

// --- Evidence timestamps -----------------------------------------------------

/**
 * Audit and request evidence: the exact recorded instant, UTC, locale-
 * independent (`2026-10-07 13:42:05 UTC`). Reformats the ISO string as-is, so
 * no precision is gained or lost.
 */
export function formatEvidenceTime(iso: string): string {
  return iso.replace("T", " ").replace("Z", " UTC");
}

// --- Durations ---------------------------------------------------------------

/** A whole-unit duration phrase: «24 ساعة» / `24 hours`. */
export function formatDuration(seconds: number, locale: Locale = getLocale()): string {
  if (seconds % 3600 === 0) {
    return translate(locale, "format.duration.hours", { count: seconds / 3600 });
  }
  if (seconds % 60 === 0) {
    return translate(locale, "format.duration.minutes", { count: seconds / 60 });
  }
  return translate(locale, "format.duration.seconds", { count: seconds });
}
