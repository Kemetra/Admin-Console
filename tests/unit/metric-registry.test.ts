import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { ar } from "@/i18n/messages/ar";
import { en } from "@/i18n/messages/en";
import type { SalesSummary } from "@/lib/sales-summary-queries";
import {
  METRICS,
  METRIC_IDS,
  SALES_SUMMARY_SOURCE,
  metricDefinition,
  selectMetric,
} from "@/metrics/metricRegistry";

/**
 * RT-819 (VIZ-1) console metric registry. Presentation metadata only: every
 * figure cites a field of the pinned Backend-Core contract and never redefines
 * it. The drift checks below resolve each cited field against a typed contract
 * fixture and the pinned contract file, so a rename upstream fails here.
 */

type Kpis = SalesSummary["scopeTotals"]["rangeTotals"];

const KPIS: Kpis = {
  receivedSales: {
    count: 3,
    byCurrency: [
      { currencyCode: "EGP", count: 2, total: "150.0000" },
      { currencyCode: "USD", count: 1, total: "10.5000" },
    ],
  },
  voids: { count: 0, byCurrency: [] },
  returns: { count: 1, byCurrency: [{ currencyCode: "EGP", count: 1, total: "20.0000" }] },
  legacyRefunds: { count: 0, byCurrency: [] },
  syncStatus: { captured: 1, synced: 2, failedRetryable: 0, failedNeedsRepair: 0 },
  erpPosting: { posted: 1, pending: 0, failed: 0, unknown: 2 },
  shiftCloses: {
    count: 2,
    normal: 1,
    forced: 1,
    withVariance: 1,
    approvalMissing: { yes: 0, no: 1, unknown: 1 },
  },
};

const PIN = readFileSync(join(process.cwd(), "contracts/backend-core/PIN"), "utf8");

describe("RT-819 metric registry", () => {
  test("covers exactly the SalesKpis figures of the contract, nothing invented", () => {
    expect([...METRIC_IDS].sort()).toEqual(Object.keys(KPIS).sort());
    // Undefined by the contract (RT-751 AC 1): never in the registry.
    for (const id of ["netSales", "returnRate", "margin", "averageOrderValue"]) {
      expect(METRIC_IDS).not.toContain(id);
    }
  });

  test("cites the pinned console-sales-summary contract and its one read op", () => {
    expect(SALES_SUMMARY_SOURCE.operationId).toBe("consoleGetSalesSummary");
    expect(PIN).toContain(`file: ${SALES_SUMMARY_SOURCE.contract} `);
  });

  test.each(METRIC_IDS)("%s: its cited field resolves on the contract shape", (id) => {
    const def = metricDefinition(id);
    expect(def.source.field).toBe(`SalesKpis.${id}`);
    expect(selectMetric(id, KPIS)).toBe(KPIS[id]);
  });

  test.each(METRIC_IDS)("%s: label, definition and notes exist in both locales", (id) => {
    const def = metricDefinition(id);
    for (const key of [def.labelKey, def.definitionKey, def.zoneRuleKey, def.unknown.meaningKey]) {
      expect(ar[key]).toBeTruthy();
      expect(en[key]).toBeTruthy();
    }
  });

  test("every figure is bucketed by the store-local business day", () => {
    for (const id of METRIC_IDS) expect(METRICS[id].grain).toBe("store-business-day");
  });

  test("zone rules follow RT-751 AC 3: stored date for sales/voids/returns, current zone otherwise", () => {
    expect(METRICS.receivedSales.zoneRule).toBe("fixed-at-capture");
    expect(METRICS.voids.zoneRule).toBe("fixed-at-record");
    expect(METRICS.returns.zoneRule).toBe("fixed-at-record");
    expect(METRICS.legacyRefunds.zoneRule).toBe("store-current-zone");
    expect(METRICS.shiftCloses.zoneRule).toBe("store-current-zone");
    expect(METRICS.syncStatus.zoneRule).toBe("fixed-at-capture");
    expect(METRICS.erpPosting.zoneRule).toBe("fixed-at-capture");
  });

  test("unknown semantics: a contract 'unknown' bucket is named, never folded into zero", () => {
    expect(METRICS.erpPosting.unknown.bucket).toBe("unknown");
    expect(METRICS.shiftCloses.unknown.bucket).toBe("approvalMissing.unknown");
    expect(METRICS.receivedSales.unknown.bucket).toBeNull();
    expect(en[METRICS.erpPosting.unknown.meaningKey]).toMatch(/never means not posted/i);
  });

  test("money figures are per currency and never summed across currencies", () => {
    for (const id of ["receivedSales", "voids", "returns", "legacyRefunds"] as const) {
      expect(METRICS[id].shape).toBe("money-facts");
    }
    expect(METRICS.syncStatus.shape).toBe("sync-status");
    expect(METRICS.erpPosting.shape).toBe("erp-posting");
    expect(METRICS.shiftCloses.shape).toBe("shift-closes");
  });

  test("states of sync status are the contract's own, and 'synced' is not 'posted'", () => {
    expect(en[METRICS.syncStatus.definitionKey]).toMatch(/not .*posted to ERPNext/i);
  });
});
