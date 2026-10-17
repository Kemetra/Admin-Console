/**
 * RT-389 override expiry. The operator types a wall-clock date and time; the
 * API wants an RFC 3339 instant with an offset, so the value is read in the
 * store's zone (never the browser's), reusing the zone-offset helper of the
 * shift-close date filters. An unknown zone is UTC.
 */
import { isValidZone } from "@/i18n/format";
import { zoneOffsetMs } from "@/shift-closes/shiftCloseDates";

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** True when the instant reads back as the same year, month, day, hour and minute (no rollover). */
function roundTrips(instantMs: number, parts: number[]): boolean {
  const real = new Date(instantMs);
  const readBack = [
    real.getUTCFullYear(),
    real.getUTCMonth() + 1,
    real.getUTCDate(),
    real.getUTCHours(),
    real.getUTCMinutes(),
  ];
  return readBack.every((value, i) => value === parts[i]);
}

/** `YYYY-MM-DDTHH:mm` read in an IANA zone, as a UTC ISO string; undefined if not a real time. */
export function zonedLocalToIso(local: string, timeZone: string): string | undefined {
  const match = LOCAL.exec(local);
  if (!match) return undefined;
  const parts = match.slice(1).map(Number);
  const [y, mo, d, h, mi] = parts;
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  if (!roundTrips(naive, parts)) return undefined;
  const zone = isValidZone(timeZone) ? timeZone : "UTC";
  // Two passes settle the offset when the time straddles a daylight change.
  const first = naive - zoneOffsetMs({ instantMs: naive, timeZone: zone });
  const second = naive - zoneOffsetMs({ instantMs: first, timeZone: zone });
  return new Date(second).toISOString();
}
