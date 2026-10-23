/**
 * RT-820 (VIZ-2, RT-751 slice 3) pure helpers for Overview P-6, today's received
 * sales per store (spec 009 OD-009-1 / AC-11). No React, no fetch.
 *
 * "Today" is per store (RT-751 D4): each store at its own `currentBusinessDate`,
 * taken from a UTC -1..+1 day read window (which covers every IANA offset). The
 * server's figures are shown as returned: this file selects, it never adds.
 *   - a store whose date is missing from `days[]` is `unknown`, never zero;
 *   - a scope total exists only when every store of the scope is on this page
 *     and all of them share one date, and it is the server's `scopeTotals` day.
 */
import type { SalesSummary } from "@/lib/sales-summary-queries";
import type { SalesKpis } from "@/metrics/metricRegistry";
import { emptyFilters, filtersToSearch } from "@/sales/saleFilters";

type StoreSummary = SalesSummary["stores"][number];

const DAY_MS = 86_400_000;

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** UTC date -1 .. +1 of `nowMs`: every store's current business date is inside it. */
export function readWindow(nowMs: number): { from: string; to: string } {
  const utcMidnight = Math.floor(nowMs / DAY_MS) * DAY_MS;
  return { from: isoDay(utcMidnight - DAY_MS), to: isoDay(utcMidnight + DAY_MS) };
}

export type StoreToday =
  | { state: "ready"; storeRef: string; date: string; timeZone: string; kpis: SalesKpis }
  | { state: "unknown"; storeRef: string; date: string; timeZone: string };

/** One store at its own current business date; a date absent from `days[]` is unknown. */
export function storeToday(store: StoreSummary): StoreToday {
  const base = {
    storeRef: store.storeRef,
    date: store.currentBusinessDate,
    timeZone: store.storeTimezone,
  };
  const day = store.days.find((d) => d.businessDate === store.currentBusinessDate);
  return day ? { state: "ready", ...base, kpis: day.kpis } : { state: "unknown", ...base };
}

export interface ScopeToday {
  date: string;
  kpis: SalesKpis;
  storeCount: number;
  timeZones: readonly string[];
}

/**
 * The scope's "today" when it is honest to state one, else null: the read is the
 * whole scope (no further page, every store listed), at least two stores are in
 * it, they all share one `currentBusinessDate`, and the server has that day.
 */
export function scopeToday(summary: SalesSummary): ScopeToday | null {
  const { stores, nextCursor, scopeTotals } = summary;
  if (summary.scope !== "all_in_scope" || nextCursor !== null) return null;
  if (stores.length < 2 || stores.length !== scopeTotals.storeCount) return null;
  const date = stores[0].currentBusinessDate;
  if (stores.some((s) => s.currentBusinessDate !== date)) return null;
  const day = scopeTotals.days.find((d) => d.businessDate === date);
  if (!day) return null;
  return {
    date,
    kpis: day.kpis,
    storeCount: stores.length,
    timeZones: stores.map((s) => s.storeTimezone),
  };
}

/** `/sales?store=…&from=…&to=…` for one store and its business date (per store, never a total). */
export function salesDrillDown(storeRef: string, date: string): string {
  const search = filtersToSearch({
    ...emptyFilters(),
    storeId: storeRef,
    fromDate: date,
    toDate: date,
  });
  return `/sales?${search.toString()}`;
}

function isStoreSummary(store: unknown): boolean {
  const s = store as Partial<StoreSummary> | null | undefined;
  return Array.isArray(s?.days) && typeof s.currentBusinessDate === "string";
}

function hasScopeTotals(totals: Partial<SalesSummary["scopeTotals"]> | undefined): boolean {
  return Array.isArray(totals?.days) && typeof totals.storeCount === "number";
}

/** A body the panel can render: a store list and scope totals; anything else is malformed. */
export function asSalesSummary(data: unknown): SalesSummary | undefined {
  const body = data as Partial<SalesSummary> | null | undefined;
  const ok = Array.isArray(body?.stores) && body.stores.every(isStoreSummary);
  return ok && hasScopeTotals(body.scopeTotals) ? (body as SalesSummary) : undefined;
}
