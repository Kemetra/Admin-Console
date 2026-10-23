import type { SalesSummary } from "@/lib/sales-summary-queries";
import type { SalesKpis } from "@/metrics/metricRegistry";
import { ZERO_KPIS } from "./metric-claim-fixtures";

/**
 * RT-821 (VIZ-3) sales-summary payloads for the daily report tests, typed
 * against the generated contract. Every day is dense and zero-filled, as the
 * contract promises; a test removes or overrides days to probe the edges.
 */

export const CAIRO = "0190f000-0000-7000-8000-0000000005a1";
export const NEW_YORK = "0190f000-0000-7000-8000-0000000005a2";
export const AS_OF = "2026-10-23T09:15:00Z";

type Day = SalesSummary["scopeTotals"]["days"][number];

export function dates(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export function zeroDays(from: string, to: string, over: Record<string, SalesKpis> = {}): Day[] {
  return dates(from, to).map((businessDate) => ({
    businessDate,
    kpis: over[businessDate] ?? ZERO_KPIS,
  }));
}

export const EGP_USD_DAY: SalesKpis = {
  ...ZERO_KPIS,
  receivedSales: {
    count: 5,
    byCurrency: [
      { currencyCode: "EGP", count: 4, total: "1250.5000" },
      { currencyCode: "USD", count: 1, total: "40.0000" },
    ],
  },
  voids: { count: 1, byCurrency: [{ currencyCode: "EGP", count: 1, total: "30.0000" }] },
  syncStatus: { captured: 1, synced: 3, failedRetryable: 1, failedNeedsRepair: 0 },
  erpPosting: { posted: 2, pending: 1, failed: 0, unknown: 2 },
  shiftCloses: {
    count: 2,
    normal: 1,
    forced: 1,
    withVariance: 1,
    approvalMissing: { yes: 0, no: 1, unknown: 1 },
  },
};

/** Range totals no single day has, so a client-side sum would show something else. */
export const RANGE_TOTALS: SalesKpis = {
  ...ZERO_KPIS,
  receivedSales: {
    count: 77,
    byCurrency: [
      { currencyCode: "EGP", count: 70, total: "9999.2500" },
      { currencyCode: "USD", count: 7, total: "321.0000" },
    ],
  },
  erpPosting: { posted: 70, pending: 3, failed: 1, unknown: 3 },
};

const DEFAULT_RANGE = { from: "2026-10-16", to: "2026-10-23" };

interface StoreSpec {
  ref: string;
  timeZone: string;
  currentBusinessDate: string;
  days?: Day[];
}

export function storeSummary(
  spec: StoreSpec,
  range = DEFAULT_RANGE,
  days: Record<string, SalesKpis> = {},
): SalesSummary {
  const storeDays = spec.days ?? zeroDays(range.from, range.to, days);
  return {
    scope: "store",
    storeRef: spec.ref,
    ...range,
    asOf: AS_OF,
    completeness: "received_only",
    stores: [
      {
        storeRef: spec.ref,
        storeTimezone: spec.timeZone,
        currentBusinessDate: spec.currentBusinessDate,
        days: storeDays,
        rangeTotals: RANGE_TOTALS,
      },
    ],
    nextCursor: null,
    scopeTotals: { storeCount: 1, days: storeDays, rangeTotals: RANGE_TOTALS },
  };
}

export function scopeSummary(
  specs: StoreSpec[],
  options: {
    range?: { from: string; to: string };
    storeCount?: number;
    nextCursor?: string | null;
    days?: Record<string, SalesKpis>;
  } = {},
): SalesSummary {
  const range = options.range ?? { from: "2026-10-16", to: "2026-10-23" };
  return {
    scope: "all_in_scope",
    storeRef: null,
    ...range,
    asOf: AS_OF,
    completeness: "received_only",
    stores: specs.map((s) => ({
      storeRef: s.ref,
      storeTimezone: s.timeZone,
      currentBusinessDate: s.currentBusinessDate,
      days: zeroDays(range.from, range.to),
      rangeTotals: ZERO_KPIS,
    })),
    nextCursor: options.nextCursor ?? null,
    scopeTotals: {
      storeCount: options.storeCount ?? specs.length,
      days: zeroDays(range.from, range.to, options.days),
      rangeTotals: RANGE_TOTALS,
    },
  };
}
