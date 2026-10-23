/**
 * RT-821 (VIZ-3) the daily received-sales report body: the context line, then
 * two exact tables over the same business days. They are also the accessible
 * alternative of the later chart (VIZ-5), which links each bar to its row id.
 *
 *   1. received sales, voids, returns, legacy refunds (R2): count, then one
 *      line per currency, never added across currencies;
 *   2. sync state, ERP posting state (R3) and shift closes (R4).
 *
 * Plain semantic tables, not `DataTable`: a report row opens nothing, so no
 * row is a tab stop. The footer is the server's `rangeTotals`, never a sum of
 * the rows. A day missing from the read is the word Unknown, never 0; a day
 * still running is marked in words (and a pattern), never by colour alone.
 */
import { DataTableScroll, useCaptionId } from "@/components/DataTableScroll";
import { DateTime, type MessageKey, Money, formatNumber, useT } from "@/i18n";
import {
  METRIC_IDS,
  type MetricId,
  type SalesKpis,
  metricDefinition,
} from "@/metrics/metricRegistry";
import { BusinessDate } from "@/sales/SaleParts";
import { useId } from "react";
import type { DayRow, DayState, ReportModel } from "./dailyLogic";

type MoneyMetric = "receivedSales" | "voids" | "returns" | "legacyRefunds";
const MONEY_METRICS: readonly MoneyMetric[] = [
  "receivedSales",
  "voids",
  "returns",
  "legacyRefunds",
];
const STATUS_METRICS: readonly MetricId[] = ["syncStatus", "erpPosting", "shiftCloses"];

/** The id of a day's row, for the chart (VIZ-5) to point at. */
export const dayRowId = (date: string) => `sales-daily-day-${date}`;

const STATE_MARK: Record<Exclude<DayState, "complete">, MessageKey> = {
  "so-far": "metrics.context.soFar",
  "not-begun": "salesDaily.row.notBegun",
};

function Unknown(): React.JSX.Element {
  const t = useT();
  return <span className="daily-table__unknown">{t("metrics.claim.unknown")}</span>;
}

function Count({ value }: Readonly<{ value: number }>): React.JSX.Element {
  const t = useT();
  return <span className="daily-table__count">{formatNumber(value, t.locale)}</span>;
}

function MoneyCell({ kpis, metric }: Readonly<{ kpis: SalesKpis | null; metric: MoneyMetric }>) {
  if (!kpis) return <Unknown />;
  const facts = kpis[metric];
  return (
    <>
      <Count value={facts.count} />
      {facts.byCurrency.length > 0 ? (
        <ul className="daily-table__lines">
          {facts.byCurrency.map((c) => (
            <li key={c.currencyCode}>
              <Money value={c.total} currency={c.currencyCode} />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

type Part = [MessageKey, number];

function partsOf(metric: MetricId, kpis: SalesKpis): Part[] {
  if (metric === "syncStatus") {
    const s = kpis.syncStatus;
    return [
      ["metrics.part.captured", s.captured],
      ["metrics.part.synced", s.synced],
      ["metrics.part.failedRetryable", s.failedRetryable],
      ["metrics.part.failedNeedsRepair", s.failedNeedsRepair],
    ];
  }
  if (metric === "erpPosting") {
    const e = kpis.erpPosting;
    return [
      ["metrics.part.posted", e.posted],
      ["metrics.part.pending", e.pending],
      ["metrics.part.failed", e.failed],
      ["metrics.part.unknown", e.unknown],
    ];
  }
  const c = kpis.shiftCloses;
  return [
    ["metrics.part.normal", c.normal],
    ["metrics.part.forced", c.forced],
    ["metrics.part.withVariance", c.withVariance],
    ["metrics.part.approvalMissing.yes", c.approvalMissing.yes],
    ["metrics.part.approvalMissing.no", c.approvalMissing.no],
    ["metrics.part.approvalMissing.unknown", c.approvalMissing.unknown],
  ];
}

function StatusCell({ kpis, metric }: Readonly<{ kpis: SalesKpis | null; metric: MetricId }>) {
  const t = useT();
  if (!kpis) return <Unknown />;
  return (
    <>
      {metric === "shiftCloses" ? <Count value={kpis.shiftCloses.count} /> : null}
      <ul className="daily-table__lines">
        {partsOf(metric, kpis).map(([labelKey, count]) => (
          <li key={labelKey}>{t("metrics.claim.part", { label: t(labelKey), count })}</li>
        ))}
      </ul>
    </>
  );
}

function DayHeader({ row }: Readonly<{ row: DayRow }>): React.JSX.Element {
  const t = useT();
  return (
    <th scope="row">
      <BusinessDate value={row.date} />
      {row.state === "complete" ? null : (
        <span className="daily-table__mark"> {t(STATE_MARK[row.state])}</span>
      )}
    </th>
  );
}

interface TableSpec {
  captionKey: MessageKey;
  hintKey: MessageKey;
  metrics: readonly MetricId[];
  cell: (kpis: SalesKpis | null, metric: MetricId) => React.ReactNode;
}

const TABLES: readonly TableSpec[] = [
  {
    captionKey: "salesDaily.table.money.caption",
    hintKey: "salesDaily.table.money.hint",
    metrics: MONEY_METRICS,
    cell: (kpis, metric) => <MoneyCell kpis={kpis} metric={metric as MoneyMetric} />,
  },
  {
    captionKey: "salesDaily.table.status.caption",
    hintKey: "salesDaily.table.status.hint",
    metrics: STATUS_METRICS,
    cell: (kpis, metric) => <StatusCell kpis={kpis} metric={metric} />,
  },
];

function DailyTable({
  spec,
  model,
  contextId,
  withRowIds,
}: Readonly<{ spec: TableSpec; model: ReportModel; contextId: string; withRowIds: boolean }>) {
  const t = useT();
  const captionId = useCaptionId();
  const hintId = useId();
  return (
    <section className="daily-report__table">
      <h2 className="daily-report__heading">{t(spec.captionKey)}</h2>
      <p id={hintId} className="daily-report__hint">
        {t(spec.hintKey)}
      </p>
      <DataTableScroll captionId={captionId}>
        <table className="data-table daily-table" aria-describedby={`${hintId} ${contextId}`}>
          <caption id={captionId} className="data-table__caption">
            {t(spec.captionKey)}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t("salesDaily.col.day")}</th>
              {spec.metrics.map((m) => (
                <th key={m} scope="col">
                  {t(metricDefinition(m).labelKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => (
              <tr
                key={row.date}
                id={withRowIds ? dayRowId(row.date) : undefined}
                data-business-date={row.date}
                className={row.state === "complete" ? undefined : "daily-table__row--partial"}
              >
                <DayHeader row={row} />
                {spec.metrics.map((m) => (
                  <td key={m}>{spec.cell(row.kpis, m)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">
                {t(model.partial ? "salesDaily.row.totalSoFar" : "salesDaily.row.total")}
              </th>
              {spec.metrics.map((m) => (
                <td key={m}>{spec.cell(model.totals, m)}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </DataTableScroll>
    </section>
  );
}

function Zones({ zones }: Readonly<{ zones: readonly string[] }>): React.JSX.Element {
  const t = useT();
  const sep = t.locale === "ar" ? "، " : ", ";
  return (
    <>
      {zones.map((z, i) => (
        <span key={z}>
          {i > 0 ? sep : null}
          <bdi dir="ltr">{z}</bdi>
        </span>
      ))}
    </>
  );
}

const SEP = " · ";

/** Scope, calendar, range, zones, `asOf` and completeness: what every figure below covers. */
function ReportContext({
  model,
  storeName,
  readStores,
  id,
}: Readonly<{ model: ReportModel; storeName: string; readStores: number; id: string }>) {
  const t = useT();
  const single = model.scope === "store";
  const zones = model.zones;
  return (
    <p id={id} className="daily-report__context" data-testid="sales-daily-context">
      <span>
        {single
          ? t.rich("metrics.context.store", { store: <bdi>{storeName}</bdi> })
          : t("metrics.context.allInScope", { count: model.storeCount })}
      </span>
      {single ? (
        <>
          {SEP}
          <span>{t("salesDaily.context.calendar")}</span>
        </>
      ) : null}
      {SEP}
      <span>
        {t.rich("metrics.context.range", {
          from: <BusinessDate value={model.rows[0]?.date ?? ""} />,
          to: <BusinessDate value={model.rows.at(-1)?.date ?? ""} />,
        })}
      </span>
      {zones.length > 0 ? (
        <>
          {SEP}
          <span>
            {t.rich(zones.length === 1 ? "metrics.context.zone" : "metrics.context.zones", {
              zone: <Zones zones={zones} />,
              zones: <Zones zones={zones} />,
            })}
            {model.zonesComplete
              ? null
              : ` (${t("salesDaily.context.zonesPartial", { count: readStores })})`}
          </span>
        </>
      ) : null}
      {SEP}
      <span>
        {t.rich("metrics.context.asOf", {
          // One store: its zone (RT-751 D5); a scope: UTC, labelled.
          asOf: <DateTime value={model.asOf} timeZone={single ? zones[0] : undefined} />,
        })}
      </span>
      {SEP}
      <span>{t("metrics.context.completeness")}</span>
      {model.partial ? (
        <>
          {SEP}
          <span>{t("salesDaily.context.soFar")}</span>
        </>
      ) : null}
    </p>
  );
}

/** What each column counts, from the console metric registry (RT-819). */
function Definitions(): React.JSX.Element {
  const t = useT();
  return (
    <details className="daily-report__about">
      <summary>{t("salesDaily.about")}</summary>
      <dl>
        {METRIC_IDS.map((id) => {
          const def = metricDefinition(id);
          return (
            <div key={id}>
              <dt>{t(def.labelKey)}</dt>
              <dd>
                {t(def.definitionKey)} {t(def.zoneRuleKey)} {t(def.unknown.meaningKey)}
              </dd>
            </div>
          );
        })}
      </dl>
    </details>
  );
}

export function DailyReport({
  model,
  storeName,
  readStores,
}: Readonly<{ model: ReportModel; storeName: string; readStores: number }>): React.JSX.Element {
  const contextId = useId();
  return (
    <div className="daily-report">
      <ReportContext model={model} storeName={storeName} readStores={readStores} id={contextId} />
      {TABLES.map((spec, index) => (
        <DailyTable
          key={spec.captionKey}
          spec={spec}
          model={model}
          contextId={contextId}
          withRowIds={index === 0}
        />
      ))}
      <Definitions />
    </div>
  );
}
