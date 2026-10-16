/**
 * RT-18 calendar days in a store's time zone. A date filter is a calendar day,
 * and the API wants an instant with an explicit offset, so a day is converted
 * with the zone it is read in (the selected store's, else UTC), never the
 * browser's.
 */
import { isValidZone } from "@/i18n/format";

/** A `YYYY-MM-DD` calendar day, read in an IANA time zone. */
export interface ZonedDay {
  date: string;
  timeZone: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/** A real calendar day (no rollover: Feb 31 is not one) in a sane year. */
export function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y < MIN_YEAR || y > MAX_YEAR) return false;
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === value;
}

/** An instant and the zone to read it in. */
interface ZonedInstant {
  instantMs: number;
  timeZone: string;
}

/** The zone's offset from UTC at an instant, in ms (positive east of UTC). */
function zoneOffsetMs({ instantMs, timeZone }: ZonedInstant): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * The UTC instant at which a calendar day starts in its zone, as an RFC 3339
 * string with an explicit offset (`Z`). An unknown zone is UTC.
 */
export function zonedDayStartIso(day: ZonedDay): string {
  const [y, m, d] = day.date.split("-").map(Number);
  const timeZone = isValidZone(day.timeZone) ? day.timeZone : "UTC";
  const naive = Date.UTC(y, m - 1, d);
  // Two passes settle the offset when the day straddles a daylight change.
  const first = naive - zoneOffsetMs({ instantMs: naive, timeZone });
  const second = naive - zoneOffsetMs({ instantMs: first, timeZone });
  return new Date(second).toISOString();
}

/** The calendar day after this one, in the same zone. */
export function dayAfter(day: ZonedDay): ZonedDay {
  const [y, m, d] = day.date.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { date, timeZone: day.timeZone };
}
