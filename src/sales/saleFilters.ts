/**
 * RT-587 sales filters (spec 012 J1): parsed from and written to the URL,
 * validated, and turned into the `consoleListSales` request. A store and an
 * inclusive business-date range are required before anything is read
 * (FR-004). The 31-business-day cap is checked here before the request, and
 * the server's 400 stays the truth if it still happens (AC-2).
 *
 * Business dates are calendar days in the store's zone, fixed at capture: they
 * are sent as typed and never converted to instants.
 */
import type { MessageKey } from "@/i18n";
import { isValidZone } from "@/i18n/format";
import type { ErpPostingState, ReturnState, SaleListQuery, SyncStatus } from "@/lib/sale-queries";
import { isCalendarDate } from "@/shift-closes/shiftCloseDates";

export const PAGE_SIZE = 50;

/** `to - from <= 30` (31 business days, both ends inclusive). */
export const MAX_SPAN_DAYS = 30;

/** The contract's `sale_number` maxLength. */
export const MAX_SALE_NUMBER = 96;

export interface SaleFilters {
  storeId: string;
  fromDate: string;
  toDate: string;
  saleNumber: string;
  syncStatus: SyncStatus | "";
  voided: "true" | "false" | "";
  returnState: ReturnState | "";
  erpState: ErpPostingState | "";
}

export const SYNC_STATUSES: readonly SyncStatus[] = [
  "captured",
  "synced",
  "failed-retryable",
  "failed-needs-repair",
];
export const RETURN_STATES: readonly ReturnState[] = ["none", "partial", "full"];
export const ERP_STATES: readonly ErpPostingState[] = ["posted", "pending", "failed", "unknown"];
const VOIDED_VALUES: readonly string[] = ["true", "false"];

export function emptyFilters(): SaleFilters {
  return {
    storeId: "",
    fromDate: "",
    toDate: "",
    saleNumber: "",
    syncStatus: "",
    voided: "",
    returnState: "",
    erpState: "",
  };
}

/** A value from a closed set, or blank: an unknown code in a hand-edited URL is dropped. */
function oneOf<V extends string>(values: readonly V[], value: string | null): V | "" {
  return values.includes(value as V) ? (value as V) : "";
}

/** URL key per filter, in URL order. */
const URL_KEYS: [keyof SaleFilters, string][] = [
  ["storeId", "store"],
  ["fromDate", "from"],
  ["toDate", "to"],
  ["saleNumber", "number"],
  ["syncStatus", "sync"],
  ["voided", "voided"],
  ["returnState", "returns"],
  ["erpState", "erp"],
];

export function filtersFromSearch(search: URLSearchParams): SaleFilters {
  const get = (key: string) => search.get(key);
  return {
    storeId: get("store") ?? "",
    fromDate: get("from") ?? "",
    toDate: get("to") ?? "",
    saleNumber: get("number") ?? "",
    syncStatus: oneOf(SYNC_STATUSES, get("sync")),
    voided: oneOf(VOIDED_VALUES, get("voided")) as SaleFilters["voided"],
    returnState: oneOf(RETURN_STATES, get("returns")),
    erpState: oneOf(ERP_STATES, get("erp")),
  };
}

export function filtersToSearch(filters: SaleFilters): URLSearchParams {
  const pairs = URL_KEYS.map(([field, key]): [string, string] => [key, filters[field]]);
  return new URLSearchParams(pairs.filter(([, value]) => value !== ""));
}

/** A store and both dates are set: the list may be read (FR-004). */
export function isQueryReady(filters: SaleFilters): boolean {
  return filters.storeId !== "" && filters.fromDate !== "" && filters.toDate !== "";
}

const DAY_MS = 86_400_000;

function utcDay(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Calendar days from `from` to `to` (0 for one day), counted in UTC so no zone shifts it. */
export function spanDays(from: string, to: string): number {
  return Math.round((utcDay(to) - utcDay(from)) / DAY_MS);
}

export type FilterErrors = Partial<Record<"date" | "range" | "saleNumber", MessageKey>>;

function rangeError(filters: SaleFilters): FilterErrors {
  const dates = [filters.fromDate, filters.toDate];
  if (dates.some((date) => date !== "" && !isCalendarDate(date))) {
    return { date: "sales.filter.dateInvalid" };
  }
  if (filters.fromDate === "" || filters.toDate === "") return {};
  const span = spanDays(filters.fromDate, filters.toDate);
  if (span < 0) return { range: "sales.filter.rangeReversed" };
  return span > MAX_SPAN_DAYS ? { range: "sales.filter.spanTooWide" } : {};
}

export function validateFilters(filters: SaleFilters): FilterErrors {
  const errors: FilterErrors = rangeError(filters);
  if (filters.saleNumber.trim().length > MAX_SALE_NUMBER) {
    errors.saleNumber = "sales.filter.saleNumberTooLong";
  }
  return errors;
}

/** The list query for ready, valid filters. The cursor is added by the caller. */
export function buildListQuery(filters: SaleFilters): SaleListQuery {
  const query: SaleListQuery = {
    store_id: filters.storeId,
    from: filters.fromDate,
    to: filters.toDate,
    page_size: PAGE_SIZE,
  };
  const saleNumber = filters.saleNumber.trim();
  if (saleNumber) query.sale_number = saleNumber;
  if (filters.syncStatus) query.sync_status = filters.syncStatus;
  if (filters.voided) query.voided = filters.voided === "true";
  if (filters.returnState) query.return_state = filters.returnState;
  if (filters.erpState) query.erp_posting_state = filters.erpState;
  return query;
}

/** Today's calendar day in an IANA zone (UTC when the zone is unknown). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const zone = isValidZone(timeZone) ? timeZone : "UTC";
  // en-CA formats a date as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
