/**
 * RT-819 (VIZ-1, RT-751 slice 2) console metric registry: what each sales
 * summary figure means, for presentation only. Every entry cites the field of
 * the Backend-Core contract it shows and never redefines it: the contract
 * (`console-sales-summary.openapi.yaml`, pinned in `contracts/backend-core/PIN`)
 * owns the computation, and this file owns the words.
 *
 * Per figure: label, definition, source op/field, grain, zone rule (RT-751
 * AC 3) and unknown semantics (AC 4). Only the `SalesKpis` figures exist here;
 * net sales, return rate, margin and average order value have no contract and
 * are never added (RT-751 AC 1).
 */
import type { MessageKey } from "@/i18n";
import type { SalesSummary } from "@/lib/sales-summary-queries";

/** One bucket of figures (a day, a store's range, or the scope's range). */
export type SalesKpis = SalesSummary["scopeTotals"]["rangeTotals"];

export type MetricId = keyof SalesKpis;

export const SALES_SUMMARY_SOURCE = {
  contract: "console-sales-summary.openapi.yaml",
  operationId: "consoleGetSalesSummary",
} as const;

/**
 * The zone that cut the business day (RT-751 AC 3):
 *  - `fixed-at-capture`: the sale's stored business date, cut in the store's
 *    zone when it was captured and never recomputed;
 *  - `fixed-at-record`: the void's or return's own stored business date;
 *  - `store-current-zone`: a server or POS instant bucketed by the store's
 *    current zone, so a zone change re-buckets it.
 */
export type ZoneRule = "fixed-at-capture" | "fixed-at-record" | "store-current-zone";

/** How a claim draws the figure; money is per currency and never summed. */
export type MetricShape = "money-facts" | "sync-status" | "erp-posting" | "shift-closes";

export interface MetricDefinition {
  id: MetricId;
  labelKey: MessageKey;
  definitionKey: MessageKey;
  source: { operationId: typeof SALES_SUMMARY_SOURCE.operationId; field: `SalesKpis.${MetricId}` };
  /** Every figure is per store-local business day; scope days add each store's own date. */
  grain: "store-business-day";
  zoneRule: ZoneRule;
  zoneRuleKey: MessageKey;
  shape: MetricShape;
  unknown: {
    /** The contract's own "unknown" bucket, shown as a word; null when it has none. */
    bucket: "unknown" | "approvalMissing.unknown" | null;
    meaningKey: MessageKey;
  };
}

const ZONE_RULE_KEY = {
  "fixed-at-capture": "metrics.zoneRule.fixedAtCapture",
  "fixed-at-record": "metrics.zoneRule.fixedAtRecord",
  "store-current-zone": "metrics.zoneRule.storeCurrentZone",
} as const satisfies Record<ZoneRule, MessageKey>;

function define(
  id: MetricId,
  zoneRule: ZoneRule,
  shape: MetricShape,
  unknownBucket: MetricDefinition["unknown"]["bucket"] = null,
): MetricDefinition {
  return {
    id,
    labelKey: `metrics.${id}.label` as const,
    definitionKey: `metrics.${id}.definition` as const,
    source: { operationId: SALES_SUMMARY_SOURCE.operationId, field: `SalesKpis.${id}` },
    grain: "store-business-day",
    zoneRule,
    zoneRuleKey: ZONE_RULE_KEY[zoneRule],
    shape,
    unknown: {
      bucket: unknownBucket,
      meaningKey: `metrics.${id}.unknown` as const,
    },
  };
}

export const METRICS: Readonly<Record<MetricId, MetricDefinition>> = {
  receivedSales: define("receivedSales", "fixed-at-capture", "money-facts"),
  voids: define("voids", "fixed-at-record", "money-facts"),
  returns: define("returns", "fixed-at-record", "money-facts"),
  legacyRefunds: define("legacyRefunds", "store-current-zone", "money-facts"),
  syncStatus: define("syncStatus", "fixed-at-capture", "sync-status"),
  erpPosting: define("erpPosting", "fixed-at-capture", "erp-posting", "unknown"),
  shiftCloses: define(
    "shiftCloses",
    "store-current-zone",
    "shift-closes",
    "approvalMissing.unknown",
  ),
};

export const METRIC_IDS = Object.keys(METRICS) as readonly MetricId[];

export function metricDefinition(id: MetricId): MetricDefinition {
  return METRICS[id];
}

/** The cited field of one bucket, as returned (no arithmetic). */
export function selectMetric<K extends MetricId>(id: K, kpis: SalesKpis): SalesKpis[K] {
  return kpis[id];
}
