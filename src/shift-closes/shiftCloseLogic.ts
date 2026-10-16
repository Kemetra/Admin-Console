/**
 * RT-18 pure helpers for the shift-close variance review. No React, no fetch.
 * The view never recomputes money: it renders the API's `variance`, `expectedCash`
 * and `countedCash` as received (variance = counted - expected, signed).
 *
 * RT-399: helpers return catalog message keys, never copy; components translate
 * at render so a locale switch re-renders them.
 */
import type { MessageKey } from "@/i18n";
import type {
  ApprovalFilter,
  CloseKind,
  ShiftCashMovement,
  ShiftCloseListQuery,
  ShiftClosePage,
} from "@/lib/shift-close-queries";

/** Roles the API lets read the shift-close review (RT-383). */
export const READ_ROLES = ["owner", "tenant_admin", "store_manager"] as const;

/** Navigation gate: mirrors the API's read roles. Not an authorization decision. */
export function canReadShiftCloses(role: string | null | undefined): boolean {
  return (READ_ROLES as readonly string[]).includes(role ?? "");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A route id that is not a UUID would be a contract 400: it renders as not-found. */
export function isShiftId(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

// --- Keyset paging -----------------------------------------------------------

export const PAGE_SIZE = 25;

/** getNextPageParam: a null cursor stops paging (undefined in TanStack v5). */
export function nextShiftCloseCursor(page: ShiftClosePage): string | undefined {
  return page.nextCursor ?? undefined;
}

export function flattenShiftClosePages<T>(
  pages: readonly { items: T[]; nextCursor?: string | null }[],
): T[] {
  return pages.flatMap((page) => page.items);
}

// --- Variance ----------------------------------------------------------------

export type VarianceDirection = "over" | "short" | "none";

/**
 * Over (counted > expected), short (counted < expected) or none, read from the
 * exact-decimal string without parsing it as a float.
 */
export function varianceDirection(variance: string): VarianceDirection {
  const trimmed = variance.trim();
  if (/^[+-]?0*(\.0*)?$/.test(trimmed)) return "none";
  return trimmed.startsWith("-") ? "short" : "over";
}

const DIRECTION_KEYS: Record<VarianceDirection, MessageKey> = {
  over: "shift.variance.over",
  short: "shift.variance.short",
  none: "shift.variance.none",
};

export function varianceDirectionKey(variance: string): MessageKey {
  return DIRECTION_KEYS[varianceDirection(variance)];
}

// --- Label keys (machine codes drive copy; they are not copy) -------------------

const CLOSE_KIND_KEYS: Record<CloseKind, MessageKey> = {
  normal: "shift.kind.normal",
  forced: "shift.kind.forced",
};

export function closeKindKey(kind: string): MessageKey {
  return Object.hasOwn(CLOSE_KIND_KEYS, kind)
    ? CLOSE_KIND_KEYS[kind as CloseKind]
    : "shift.kind.unknown";
}

const MOVEMENT_KIND_KEYS: Record<ShiftCashMovement["kind"], MessageKey> = {
  pay_in: "shift.movement.kind.pay_in",
  pay_out: "shift.movement.kind.pay_out",
};

export function movementKindKey(kind: string): MessageKey {
  return Object.hasOwn(MOVEMENT_KIND_KEYS, kind)
    ? MOVEMENT_KIND_KEYS[kind as ShiftCashMovement["kind"]]
    : "shift.movement.kind.unknown";
}

const REASON_KEYS: Record<ShiftCashMovement["reasonCode"], MessageKey> = {
  bank_drop: "shift.movement.reason.bank_drop",
  float_top_up: "shift.movement.reason.float_top_up",
  petty_expense: "shift.movement.reason.petty_expense",
  other: "shift.movement.reason.other",
};

export function reasonCodeKey(code: string): MessageKey {
  return Object.hasOwn(REASON_KEYS, code)
    ? REASON_KEYS[code as ShiftCashMovement["reasonCode"]]
    : "shift.movement.reason.unknown";
}

// --- Time zones --------------------------------------------------------------

function isValidZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The zone's offset from UTC at an instant, in ms (positive east of UTC). */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
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
 * The UTC instant at which a `YYYY-MM-DD` calendar day starts in `timeZone`,
 * as an RFC 3339 string with an explicit offset (`Z`). An unknown zone is UTC,
 * never the browser's zone.
 */
export function zonedDayStartIso(date: string, timeZone: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const zone = isValidZone(timeZone) ? timeZone : "UTC";
  const naive = Date.UTC(y, m - 1, d);
  // Two passes settle the offset when the day straddles a daylight change.
  const first = naive - zoneOffsetMs(naive, zone);
  const second = naive - zoneOffsetMs(first, zone);
  return new Date(second).toISOString();
}

function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

// --- Filters and the URL ---------------------------------------------------------

export interface ShiftCloseFilters {
  storeId: string;
  fromDate: string;
  toDate: string;
  closeKind: CloseKind | "";
  minVariance: string;
  currency: string;
  approval: ApprovalFilter | "";
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
const CLOSE_KINDS: readonly string[] = ["normal", "forced"];
const APPROVALS: readonly string[] = ["approved", "not_approved"];

export function filtersFromSearch(search: URLSearchParams): ShiftCloseFilters {
  const kind = search.get("kind") ?? "";
  const approval = search.get("approval") ?? "";
  const date = (key: string) => {
    const value = search.get(key) ?? "";
    return isCalendarDate(value) ? value : "";
  };
  return {
    storeId: search.get("store") ?? "",
    fromDate: date("from"),
    toDate: date("to"),
    closeKind: CLOSE_KINDS.includes(kind) ? (kind as CloseKind) : "",
    minVariance: search.get("min") ?? "",
    currency: search.get("currency") ?? "",
    approval: APPROVALS.includes(approval) ? (approval as ApprovalFilter) : "",
  };
}

export function filtersToSearch(filters: ShiftCloseFilters): URLSearchParams {
  const pairs: [string, string][] = [
    ["store", filters.storeId],
    ["from", filters.fromDate],
    ["to", filters.toDate],
    ["kind", filters.closeKind],
    ["min", filters.minVariance],
    ["currency", filters.currency],
    ["approval", filters.approval],
  ];
  return new URLSearchParams(pairs.filter(([, value]) => value !== ""));
}

export type FilterErrors = Partial<
  Record<"minVariance" | "currency" | "range" | "date", MessageKey>
>;

const AMOUNT_PATTERN = /^\d{1,15}(\.\d{1,4})?$/;
const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;

/** A non-blank value that does not match its pattern. */
function isMalformed(value: string, pattern: RegExp): boolean {
  return value !== "" && !pattern.test(value);
}

/** Both dates given and the end before the start (ISO dates compare as text). */
function isReversedRange(filters: ShiftCloseFilters): boolean {
  const bothGiven = filters.fromDate !== "" && filters.toDate !== "";
  return bothGiven && filters.toDate < filters.fromDate;
}

/** A non-blank date that is not a real calendar day. */
function isBadDate(value: string): boolean {
  return value !== "" && !isCalendarDate(value);
}

export function validateFilters(filters: ShiftCloseFilters): FilterErrors {
  const errors: FilterErrors = {};
  if (isBadDate(filters.fromDate) || isBadDate(filters.toDate)) {
    errors.date = "shift.filter.dateInvalid";
  }
  if (isMalformed(filters.minVariance, AMOUNT_PATTERN)) {
    errors.minVariance = "shift.filter.minVarianceInvalid";
  }
  if (isMalformed(filters.currency, CURRENCY_PATTERN)) {
    errors.currency = "shift.filter.currencyInvalid";
  }
  if (!errors.date && isReversedRange(filters)) errors.range = "shift.filter.rangeInvalid";
  return errors;
}

// --- The list request ----------------------------------------------------------

/**
 * "Exception" means non-zero variance. The contract has no such filter, but
 * `min_abs_variance` is inclusive over `numeric(19,4)`, so its floor excludes
 * exactly the zero-variance closes. It is asked of the server, never applied
 * to loaded rows: cursor pages and the dataset-empty state stay truthful.
 */
export const MIN_NONZERO_VARIANCE = "0.0001";

function isZeroAmount(value: string): boolean {
  return /^0*(\.0*)?$/.test(value);
}

/**
 * The list query for a filter set. `timeZone` is the zone the date filters are
 * read in (the selected store's, else UTC): `closed_from` is the start of the
 * first day and `closed_to` the (exclusive) start of the day after the last.
 * The cursor is added by the caller and is only valid with the same filters.
 */
export function buildListQuery(filters: ShiftCloseFilters, timeZone: string): ShiftCloseListQuery {
  return {
    min_abs_variance: minAbsVariance(filters.minVariance),
    page_size: PAGE_SIZE,
    ...attributeFilters(filters),
    ...dateBounds(filters, timeZone),
  };
}

/** A blank or zero minimum is raised to the non-zero floor. */
function minAbsVariance(typed: string): string {
  return typed === "" || isZeroAmount(typed) ? MIN_NONZERO_VARIANCE : typed;
}

function attributeFilters(filters: ShiftCloseFilters): ShiftCloseListQuery {
  const query: ShiftCloseListQuery = {};
  if (filters.storeId) query.store_id = filters.storeId;
  if (filters.closeKind) query.close_kind = filters.closeKind;
  if (filters.currency) query.currency_code = filters.currency.toUpperCase();
  if (filters.approval) query.approval = filters.approval;
  return query;
}

function dateBounds(filters: ShiftCloseFilters, timeZone: string): ShiftCloseListQuery {
  const query: ShiftCloseListQuery = {};
  if (filters.fromDate) query.closed_from = zonedDayStartIso(filters.fromDate, timeZone);
  if (filters.toDate) query.closed_to = zonedDayStartIso(nextDay(filters.toDate), timeZone);
  return query;
}

// --- Errors --------------------------------------------------------------------

export function requestIdOf(error: unknown): string | undefined {
  return (error as { error?: { request_id?: string } } | undefined)?.error?.request_id;
}
