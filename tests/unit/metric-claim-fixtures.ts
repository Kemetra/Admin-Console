import type { SalesKpis } from "@/metrics/metricRegistry";

/**
 * RT-819 shared sales-summary buckets for the KPI claim unit tests and the e2e
 * harness: an all-zero bucket and one with two currencies and every contract
 * "unknown" bucket non-zero. Typed against the generated contract.
 */
export const ZERO_KPIS: SalesKpis = {
  receivedSales: { count: 0, byCurrency: [] },
  voids: { count: 0, byCurrency: [] },
  returns: { count: 0, byCurrency: [] },
  legacyRefunds: { count: 0, byCurrency: [] },
  syncStatus: { captured: 0, synced: 0, failedRetryable: 0, failedNeedsRepair: 0 },
  erpPosting: { posted: 0, pending: 0, failed: 0, unknown: 0 },
  shiftCloses: {
    count: 0,
    normal: 0,
    forced: 0,
    withVariance: 0,
    approvalMissing: { yes: 0, no: 0, unknown: 0 },
  },
};

export const KPIS: SalesKpis = {
  ...ZERO_KPIS,
  receivedSales: {
    count: 14,
    byCurrency: [
      { currencyCode: "EGP", count: 12, total: "1250.5000" },
      { currencyCode: "USD", count: 2, total: "40.0000" },
    ],
  },
  erpPosting: { posted: 9, pending: 2, failed: 1, unknown: 2 },
  shiftCloses: {
    count: 3,
    normal: 2,
    forced: 1,
    withVariance: 1,
    approvalMissing: { yes: 1, no: 1, unknown: 1 },
  },
};
