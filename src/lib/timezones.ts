/**
 * Store time zone helpers (RT-477, RT-401). A store's zone is an IANA identity
 * (`IanaTimezone` in the stores contract) and is always shown as that identity,
 * with a city name where one is curated, never as a fixed UTC offset: the
 * offset moves with daylight saving, the identity does not.
 */
import type { Locale } from "@/i18n";
import { isValidZone } from "@/i18n/format";

/** The zone preselected on the create form (owner decision, Jira RT-477 comment 12083). */
export const DEFAULT_STORE_TIMEZONE = "Africa/Cairo";

/**
 * The contract's shape: `UTC`, or an `Area/Location[/Sub]` name under a
 * canonical IANA area. Abbreviations (`EET`), POSIX strings (`UTC+2`), `Etc/*`
 * and the legacy alias trees (`US/Eastern`) do not match.
 */
const IANA_SHAPE =
  /^(?:UTC|(?:Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific)\/[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)?)$/;

/** True when `value` has the contract's shape and the runtime knows the zone. */
export function isIanaTimezone(value: string): boolean {
  return IANA_SHAPE.test(value) && isValidZone(value);
}

interface CommonZone {
  id: string;
  ar: string;
  en: string;
}

/** The zones a retailer in the region is likely to need, named in both locales. */
const COMMON_ZONES: ReadonlyArray<CommonZone> = [
  { id: "Africa/Cairo", ar: "القاهرة", en: "Cairo" },
  { id: "Asia/Riyadh", ar: "الرياض", en: "Riyadh" },
  { id: "Asia/Dubai", ar: "دبي", en: "Dubai" },
  { id: "Asia/Kuwait", ar: "الكويت", en: "Kuwait" },
  { id: "Asia/Qatar", ar: "الدوحة", en: "Doha" },
  { id: "Asia/Bahrain", ar: "المنامة", en: "Manama" },
  { id: "Asia/Muscat", ar: "مسقط", en: "Muscat" },
  { id: "Asia/Baghdad", ar: "بغداد", en: "Baghdad" },
  { id: "Asia/Amman", ar: "عمّان", en: "Amman" },
  { id: "Asia/Beirut", ar: "بيروت", en: "Beirut" },
  { id: "Asia/Damascus", ar: "دمشق", en: "Damascus" },
  { id: "Africa/Khartoum", ar: "الخرطوم", en: "Khartoum" },
  { id: "Africa/Tripoli", ar: "طرابلس", en: "Tripoli" },
  { id: "Africa/Tunis", ar: "تونس", en: "Tunis" },
  { id: "Africa/Algiers", ar: "الجزائر", en: "Algiers" },
  { id: "Africa/Casablanca", ar: "الدار البيضاء", en: "Casablanca" },
  { id: "Europe/Istanbul", ar: "إسطنبول", en: "Istanbul" },
  { id: "Europe/London", ar: "لندن", en: "London" },
];

const COMMON_BY_ID: ReadonlyMap<string, CommonZone> = new Map(COMMON_ZONES.map((z) => [z.id, z]));

/** `Cairo (Africa/Cairo)` / `القاهرة (Africa/Cairo)`; any other zone is its identity alone. */
export function zoneLabel(zone: string, locale: Locale): string {
  const common = COMMON_BY_ID.get(zone);
  return common ? `${common[locale]} (${zone})` : zone;
}

/** The city name of a curated zone, or undefined when there is none. */
export function zoneCity(zone: string, locale: Locale): string | undefined {
  return COMMON_BY_ID.get(zone)?.[locale];
}

function runtimeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone").filter(isIanaTimezone);
  } catch {
    return [];
  }
}

export interface TimezoneOptions {
  /** The curated list, `UTC` last. */
  common: string[];
  /** Every other zone the runtime knows that the contract accepts, sorted. */
  other: string[];
}

/**
 * The options of a zone select. The store's current zone is always present, so
 * an existing value outside both lists is shown rather than silently replaced
 * by the first option.
 */
export function timezoneOptions(current?: string): TimezoneOptions {
  const common = [...COMMON_ZONES.map((z) => z.id), "UTC"];
  const known = new Set(common);
  const other = new Set(runtimeZones().filter((zone) => !known.has(zone)));
  if (current && !known.has(current)) other.add(current);
  return { common, other: [...other].sort((a, b) => a.localeCompare(b)) };
}
