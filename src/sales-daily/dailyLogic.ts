/**
 * RT-821 (VIZ-3, RT-751 slice 4) pure rules of the daily received-sales report.
 * No React, no fetch. The report renders the server's buckets as returned
 * (RT-751 AC 4): it never sums a day into a total, never stitches two reads,
 * and never turns a missing bucket into a zero.
 *
 * Calendar policy (RT-751 AC 3, D3): every figure is per store-local business
 * day; a scope day adds each store's figures for its own date. "Today" is each
 * store's `currentBusinessDate` from the server, never the viewer's clock; the
 * client clock only proposes the default range before the first read.
 */
import type { MessageKey } from "@/i18n";
import {
  type SalesSummary,
  type SalesSummaryQuery,
  salesSummaryRangeProblem,
} from "@/lib/sales-summary-queries";
import type { SalesKpis } from "@/metrics/metricRegistry";
import { todayIn } from "@/sales/saleFilters";
import { isCalendarDate } from "@/shift-closes/shiftCloseDates";

export interface DailyRange {
  from: string;
  to: string;
}

/** Completed days before today in the default range (RT-751 D9). */
export const DEFAULT_COMPLETED_DAYS = 7;

/** One page of stores for a whole scope; later pages are never walked (no stitching). */
export const SCOPE_PAGE_SIZE = 50;

const DAY_MS = 86_400_000;

function dayMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  return new Date(dayMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Every calendar date from `from` to `to`, inclusive and ascending. */
export function datesInRange({ from, to }: DailyRange): string[] {
  const out: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) out.push(day);
  return out;
}

/**
 * The last 7 completed days plus today. With several zones, today is the
 * latest of the stores' todays, so every store's current day is in range.
 */
export function defaultRange(zones: readonly string[], now: Date = new Date()): DailyRange {
  const todays = (zones.length > 0 ? zones : ["UTC"]).map((zone) => todayIn(zone, now));
  const to = todays.reduce((latest, day) => (day > latest ? day : latest), todays[0]);
  return { from: addDays(to, -DEFAULT_COMPLETED_DAYS), to };
}

export function rangeFromSearch(search: URLSearchParams): DailyRange | null {
  const from = search.get("from");
  const to = search.get("to");
  return from && to ? { from, to } : null;
}

export function rangeToSearch(range: DailyRange): URLSearchParams {
  return new URLSearchParams({ from: range.from, to: range.to });
}

export type RangeErrors = Partial<Record<"from" | "to", MessageKey>>;

const RANGE_PROBLEM_KEY = {
  "to-before-from": "sales.filter.rangeReversed",
  "range-too-wide": "sales.filter.spanTooWide",
} as const satisfies Record<string, MessageKey>;

/** The contract's range rule, at the field it belongs to. */
export function validateRange(range: DailyRange): RangeErrors {
  const errors: RangeErrors = {};
  if (!isCalendarDate(range.from)) errors.from = "sales.filter.dateInvalid";
  if (!isCalendarDate(range.to)) errors.to = "sales.filter.dateInvalid";
  if (errors.from || errors.to) return errors;
  const problem = salesSummaryRangeProblem(range);
  return problem ? { to: RANGE_PROBLEM_KEY[problem] } : {};
}

/** The store in the scope header, or the whole scope (`all_in_scope`) when there is none. */
export function buildSummaryQuery(range: DailyRange, storeId: string | null): SalesSummaryQuery {
  return storeId
    ? { from: range.from, to: range.to, store_id: storeId }
    : { from: range.from, to: range.to, page_size: SCOPE_PAGE_SIZE };
}

/**
 * - `complete`: the business day is over for every store it covers;
 * - `so-far`: it is (or may be) still running for at least one store;
 * - `not-begun`: it has not started for any store (client clock ahead).
 */
export type DayState = "complete" | "so-far" | "not-begun";

export interface DayRow {
  date: string;
  state: DayState;
  /** The server's bucket; null when the date is missing from `days[]` (unknown, never 0). */
  kpis: SalesKpis | null;
}

export interface ReportModel {
  scope: SalesSummary["scope"];
  storeRef: string | null;
  rows: DayRow[];
  /** The server's `rangeTotals`; null when the read carries no bucket for the scope. */
  totals: SalesKpis | null;
  /** Some row is not complete, so the totals include a day still running. */
  partial: boolean;
  storeCount: number;
  /** The stores of the page read, each with its zone (the export names them). */
  stores: { storeRef: string; timeZone: string }[];
  /** Each zone once, first seen first. */
  zones: string[];
  /** False when more stores exist than the page returned: zones may be missing. */
  zonesComplete: boolean;
  asOf: string;
}

interface Bounds {
  /** The earliest current day: from it on, a day may still be running. */
  first?: string;
  /** The latest current day, when every store is known: after it nothing has begun. */
  last?: string;
}

function minOf(days: readonly string[]): string | undefined {
  return days.length > 0 ? days.reduce((a, b) => (b < a ? b : a), days[0]) : undefined;
}

function maxOf(days: readonly string[]): string | undefined {
  return days.length > 0 ? days.reduce((a, b) => (b > a ? b : a), days[0]) : undefined;
}

function boundsOf(summary: SalesSummary, utcToday: string): Bounds {
  const current = summary.stores.map((s) => s.currentBusinessDate);
  if (summary.nextCursor === null) return { first: minOf(current), last: maxOf(current) };
  // A store on a page not read may be as far west as UTC-12, where the UTC
  // day before today is still running.
  return { first: minOf([...current, addDays(utcToday, -1)]) };
}

function stateOf(date: string, bounds: Bounds): DayState {
  if (bounds.first === undefined || date < bounds.first) return "complete";
  if (bounds.last !== undefined && date > bounds.last) return "not-begun";
  return "so-far";
}

function bucketsOf(summary: SalesSummary) {
  if (summary.scope === "all_in_scope") return summary.scopeTotals;
  const store = summary.stores[0];
  return store ? { days: store.days, rangeTotals: store.rangeTotals } : null;
}

function zonesOf(summary: SalesSummary): string[] {
  return [...new Set(summary.stores.map((s) => s.storeTimezone))];
}

/** The report of one read. `utcToday` only matters when a later page of stores was not read. */
export function reportModel(
  summary: SalesSummary,
  utcToday: string = new Date().toISOString().slice(0, 10),
): ReportModel {
  const buckets = bucketsOf(summary);
  const byDate = new Map((buckets?.days ?? []).map((d) => [d.businessDate, d.kpis]));
  const bounds = boundsOf(summary, utcToday);
  const rows = datesInRange(summary).map((date) => ({
    date,
    state: stateOf(date, bounds),
    kpis: byDate.get(date) ?? null,
  }));
  return {
    scope: summary.scope,
    storeRef: summary.storeRef,
    rows,
    totals: buckets?.rangeTotals ?? null,
    partial: rows.some((r) => r.state !== "complete"),
    storeCount: summary.scope === "store" ? 1 : summary.scopeTotals.storeCount,
    stores: summary.stores.map((s) => ({ storeRef: s.storeRef, timeZone: s.storeTimezone })),
    zones: zonesOf(summary),
    zonesComplete: summary.nextCursor === null,
    asOf: summary.asOf,
  };
}
