/**
 * RT-824 (VIZ-6, RT-751 slice 7, D10) client-side CSV of the daily received-
 * sales report. Pure: no React, no DOM. It exports exactly what the report
 * shows, built from the report model (never the DOM):
 *
 *  - server decimal strings as given: no re-rounding, no derived totals; the
 *    range-total row is the server's `rangeTotals`;
 *  - a date missing from the read is `unknown`, never 0;
 *  - a context header first (scope, stores with zones, range, calendar policy,
 *    `asOf`, `completeness: received_only`, metric definitions), so the file
 *    keeps its analytical context (UX-13 "Export Preserves Analytical Context");
 *  - text cells that start with `=`, `+`, `-`, `@`, a tab or a CR get a `'`
 *    prefix, so a store name cannot run as a spreadsheet formula (server
 *    decimals, which may legitimately start with `-`, are numbers, not text);
 *  - UTF-8 with a BOM and CRLF line ends, so Arabic opens correctly in Excel.
 *
 * Column names are stable English snake_case so a spreadsheet or script can
 * rely on them in both locales; the header block's prose is in the app locale.
 */
import type { Locale } from "@/i18n/locale";
import { type MessageKey, translate } from "@/i18n/translate";
import {
  METRIC_IDS,
  type MetricId,
  type SalesKpis,
  metricDefinition,
} from "@/metrics/metricRegistry";
import type { DayRow, ReportModel } from "./dailyLogic";

export const CSV_BOM = "﻿";
const EOL = "\r\n";

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;
const DECIMAL = /^-?\d+(\.\d+)?$/;

/** A text cell: neutralised against formula injection, quoted when it must be. */
export function csvText(text: string): string {
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** A server decimal or count goes out as given; anything else is text. */
function csvValue(value: string): string {
  return DECIMAL.test(value) ? value : csvText(value);
}

const line = (cells: readonly string[]): string => cells.join(",");

type MoneyMetric = "receivedSales" | "voids" | "returns" | "legacyRefunds";

const MONEY: readonly { id: MoneyMetric; name: string }[] = [
  { id: "receivedSales", name: "received_sales" },
  { id: "voids", name: "voids" },
  { id: "returns", name: "returns" },
  { id: "legacyRefunds", name: "legacy_refunds" },
];

/** Currencies of one money metric across the rows and the totals, first seen first. */
function currenciesOf(model: ReportModel, metric: MoneyMetric): string[] {
  const seen = new Set<string>();
  for (const kpis of [...model.rows.map((r) => r.kpis), model.totals]) {
    for (const c of kpis?.[metric].byCurrency ?? []) seen.add(c.currencyCode);
  }
  return [...seen];
}

interface Column {
  name: string;
  /** The server's figure for this bucket, as a string. */
  read: (kpis: SalesKpis) => string;
}

function moneyColumns(model: ReportModel): Column[] {
  return MONEY.flatMap(({ id, name }) => [
    { name: `${name}_count`, read: (k: SalesKpis) => String(k[id].count) },
    ...currenciesOf(model, id).flatMap((code) => [
      {
        name: `${name}_${code}_count`,
        read: (k: SalesKpis) =>
          String(k[id].byCurrency.find((c) => c.currencyCode === code)?.count ?? 0),
      },
      {
        name: `${name}_${code}_total`,
        read: (k: SalesKpis) => k[id].byCurrency.find((c) => c.currencyCode === code)?.total ?? "0",
      },
    ]),
  ]);
}

const STATUS_COLUMNS: readonly Column[] = [
  { name: "sync_captured", read: (k) => String(k.syncStatus.captured) },
  { name: "sync_synced", read: (k) => String(k.syncStatus.synced) },
  { name: "sync_failed_retryable", read: (k) => String(k.syncStatus.failedRetryable) },
  { name: "sync_failed_needs_repair", read: (k) => String(k.syncStatus.failedNeedsRepair) },
  { name: "erp_posted", read: (k) => String(k.erpPosting.posted) },
  { name: "erp_pending", read: (k) => String(k.erpPosting.pending) },
  { name: "erp_failed", read: (k) => String(k.erpPosting.failed) },
  { name: "erp_unknown", read: (k) => String(k.erpPosting.unknown) },
  { name: "shift_closes_count", read: (k) => String(k.shiftCloses.count) },
  { name: "shift_closes_normal", read: (k) => String(k.shiftCloses.normal) },
  { name: "shift_closes_forced", read: (k) => String(k.shiftCloses.forced) },
  { name: "shift_closes_with_variance", read: (k) => String(k.shiftCloses.withVariance) },
  {
    name: "shift_closes_approval_missing_yes",
    read: (k) => String(k.shiftCloses.approvalMissing.yes),
  },
  {
    name: "shift_closes_approval_missing_no",
    read: (k) => String(k.shiftCloses.approvalMissing.no),
  },
  {
    name: "shift_closes_approval_missing_unknown",
    read: (k) => String(k.shiftCloses.approvalMissing.unknown),
  },
];

const STATE_NAME: Record<DayRow["state"], string> = {
  complete: "complete",
  "so-far": "so_far",
  "not-begun": "not_begun",
};

export interface CsvOptions {
  locale: Locale;
  /** The active store's name; null when the read covers a whole scope. */
  storeName: string | null;
}

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

function storeRows(model: ReportModel, storeName: string | null): string[][] {
  return model.stores.map((s) => {
    const named = model.scope === "store" && s.storeRef === model.storeRef && storeName !== null;
    return named ? ["store", s.storeRef, s.timeZone, storeName] : ["store", s.storeRef, s.timeZone];
  });
}

function periodRows(model: ReportModel, t: Translate): string[][] {
  const rows = [
    ["range_from", model.rows[0]?.date ?? ""],
    ["range_to", model.rows.at(-1)?.date ?? ""],
    ["calendar", t("salesDaily.context.calendar")],
    ["as_of_utc", model.asOf],
    ["completeness", "received_only"],
    ["completeness_note", t("metrics.context.completeness")],
  ];
  if (model.partial) rows.push(["includes_days_so_far", t("salesDaily.context.soFar")]);
  return rows;
}

function definitionRows(t: Translate): string[][] {
  return METRIC_IDS.map((id) => {
    const def = metricDefinition(id as MetricId);
    const text = [def.definitionKey, def.zoneRuleKey, def.unknown.meaningKey].map((k) => t(k));
    return ["definition", t(def.labelKey), text.join(" ")];
  });
}

function headerBlock(model: ReportModel, { locale, storeName }: CsvOptions): string[] {
  const t: Translate = (key, params) => translate(locale, key, params);
  const partialStores = model.zonesComplete
    ? []
    : [["stores_read", t("salesDaily.context.zonesPartial", { count: model.stores.length })]];
  const rows = [
    ["report", t("salesDaily.title")],
    ["scope", model.scope],
    ...storeRows(model, storeName),
    ...partialStores,
    ...periodRows(model, t),
    ...definitionRows(t),
  ];
  return rows.map((r) => line(r.map(csvValue)));
}

function dataLine(
  label: string,
  state: string,
  columns: readonly Column[],
  kpis: SalesKpis | null,
) {
  const cells = columns.map((c) => (kpis === null ? "unknown" : c.read(kpis)));
  return line([label, state, ...cells].map(csvValue));
}

/** The whole CSV, BOM first. */
export function buildCsv(model: ReportModel, options: CsvOptions): string {
  const columns = [...moneyColumns(model), ...STATUS_COLUMNS];
  const head = line(["business_date", "day_state", ...columns.map((c) => c.name)]);
  const days = model.rows.map((row) =>
    dataLine(row.date, row.kpis === null ? "unknown" : STATE_NAME[row.state], columns, row.kpis),
  );
  // The server's range totals; never a sum of the rows above.
  const total = dataLine(
    "range_total",
    model.partial ? "includes_so_far" : "complete",
    columns,
    model.totals,
  );
  return CSV_BOM + [...headerBlock(model, options), "", head, ...days, total].join(EOL) + EOL;
}
