/**
 * RT-18 filters: parsed from and written to the URL, validated, and turned into
 * the list request. "Exception" means non-zero variance, asked of the server by
 * a floor on `min_abs_variance` and never applied to loaded rows.
 */
import type { MessageKey } from "@/i18n";
import type { ApprovalFilter, CloseKind, ShiftCloseListQuery } from "@/lib/shift-close-queries";
import { dayAfter, isCalendarDate, zonedDayStartIso } from "./shiftCloseDates";

export const PAGE_SIZE = 25;

/**
 * `min_abs_variance` is inclusive over `numeric(19,4)`, so this floor excludes
 * exactly the zero-variance closes. Cursor pages and the dataset-empty state
 * stay truthful because the server, not the page, applies it.
 */
export const MIN_NONZERO_VARIANCE = "0.0001";

export interface ShiftCloseFilters {
  storeId: string;
  fromDate: string;
  toDate: string;
  closeKind: CloseKind | "";
  minVariance: string;
  currency: string;
  approval: ApprovalFilter | "";
}

const CLOSE_KINDS: ReadonlySet<string> = new Set(["normal", "forced"]);
const APPROVALS: ReadonlySet<string> = new Set(["approved", "not_approved"]);

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
    closeKind: CLOSE_KINDS.has(kind) ? (kind as CloseKind) : "",
    minVariance: search.get("min") ?? "",
    currency: search.get("currency") ?? "",
    approval: APPROVALS.has(approval) ? (approval as ApprovalFilter) : "",
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
const ZERO_AMOUNT = /^0*(\.0*)?$/;

/** Pattern-checked fields: a non-blank value that does not match is an error. */
const PATTERN_RULES: {
  field: "minVariance" | "currency";
  pattern: RegExp;
  error: MessageKey;
}[] = [
  { field: "minVariance", pattern: AMOUNT_PATTERN, error: "shift.filter.minVarianceInvalid" },
  { field: "currency", pattern: CURRENCY_PATTERN, error: "shift.filter.currencyInvalid" },
];

/** A given date that is not a real calendar day. */
function hasBadDate(filters: ShiftCloseFilters): boolean {
  return [filters.fromDate, filters.toDate].some((date) => date !== "" && !isCalendarDate(date));
}

/** Both dates given and the end before the start (ISO dates compare as text). */
function isReversedRange(filters: ShiftCloseFilters): boolean {
  const bothGiven = filters.fromDate !== "" && filters.toDate !== "";
  return bothGiven && filters.toDate < filters.fromDate;
}

export function validateFilters(filters: ShiftCloseFilters): FilterErrors {
  const errors: FilterErrors = {};
  for (const rule of PATTERN_RULES) {
    const value = filters[rule.field];
    if (value !== "" && !rule.pattern.test(value)) errors[rule.field] = rule.error;
  }
  if (hasBadDate(filters)) errors.date = "shift.filter.dateInvalid";
  else if (isReversedRange(filters)) errors.range = "shift.filter.rangeInvalid";
  return errors;
}

/** What a list request is built from: the filters, and the zone dates are read in. */
export interface ListRequest {
  filters: ShiftCloseFilters;
  timeZone: string;
}

/**
 * The list query. `closed_from` is the start of the first day and `closed_to` the
 * (exclusive) start of the day after the last, both in `timeZone` (the selected
 * store's, else UTC). The cursor is added by the caller and is only valid with
 * the same filters.
 */
export function buildListQuery({ filters, timeZone }: ListRequest): ShiftCloseListQuery {
  return {
    min_abs_variance: minAbsVariance(filters),
    page_size: PAGE_SIZE,
    ...attributeFilters(filters),
    ...dateBounds({ filters, timeZone }),
  };
}

/** A blank or zero minimum is raised to the non-zero floor. */
function minAbsVariance(filters: ShiftCloseFilters): string {
  const typed = filters.minVariance;
  return typed === "" || ZERO_AMOUNT.test(typed) ? MIN_NONZERO_VARIANCE : typed;
}

function attributeFilters(filters: ShiftCloseFilters): ShiftCloseListQuery {
  const query: ShiftCloseListQuery = {};
  if (filters.storeId) query.store_id = filters.storeId;
  if (filters.closeKind) query.close_kind = filters.closeKind;
  if (filters.currency) query.currency_code = filters.currency.toUpperCase();
  if (filters.approval) query.approval = filters.approval;
  return query;
}

function dateBounds({ filters, timeZone }: ListRequest): ShiftCloseListQuery {
  const query: ShiftCloseListQuery = {};
  if (filters.fromDate) query.closed_from = zonedDayStartIso({ date: filters.fromDate, timeZone });
  if (filters.toDate) {
    query.closed_to = zonedDayStartIso(dayAfter({ date: filters.toDate, timeZone }));
  }
  return query;
}
