/**
 * RT-389 override expiry. The operator types a wall-clock date and time; the
 * API wants an RFC 3339 instant with an offset, so the value is read in the
 * store's zone (never the browser's), reusing the zone-offset helper of the
 * shift-close date filters. An unknown zone is UTC.
 */
import { isValidZone } from "@/i18n/format";
import { zoneOffsetMs } from "@/shift-closes/shiftCloseDates";

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** `YYYY-MM-DDTHH:mm` read in an IANA zone, as a UTC ISO string; undefined if not a real time. */
export function zonedLocalToIso(local: string, timeZone: string): string | undefined {
  const match = LOCAL.exec(local);
  if (!match) return undefined;
  const [y, mo, d, h, mi] = match.slice(1).map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const real = new Date(naive);
  if (
    real.getUTCFullYear() !== y ||
    real.getUTCMonth() !== mo - 1 ||
    real.getUTCDate() !== d ||
    real.getUTCHours() !== h ||
    real.getUTCMinutes() !== mi
  ) {
    return undefined;
  }
  const zone = isValidZone(timeZone) ? timeZone : "UTC";
  // Two passes settle the offset when the time straddles a daylight change.
  const first = naive - zoneOffsetMs({ instantMs: naive, timeZone: zone });
  const second = naive - zoneOffsetMs({ instantMs: first, timeZone: zone });
  return new Date(second).toISOString();
}
