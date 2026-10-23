/**
 * RT-819 (VIZ-1, RT-751 slice 2) shared KPI claim: one honest way to show a
 * sales-summary figure. A "Precision Ledger" of label / value rows (DESIGN.md
 * §7), never a card wall, with one context line that says what the figures
 * cover: scope, period (partial day marked "so far"), zone, `asOf` and the
 * `received_only` completeness note.
 *
 * Each claim lands in exactly one state (the Overview `PanelState` shape plus
 * `unknown`):
 *   - `loading`: an indicator, no figure;
 *   - `hidden`: a 403/404 refusal, so no row at all (and nothing when every
 *     claim is hidden);
 *   - `error`: an inline notice with the request reference and its own retry;
 *   - `unknown`: the word, never 0 (for example a store whose business date is
 *     missing from `days[]`);
 *   - `ready`: the server's bucket, as returned. A zero is a real 0 with no
 *     invented amount; money is one line per currency, never summed.
 *
 * No delta and no colour in v1 (RT-751 D8): states are words. No motion: the
 * final figure renders at once, never counted up.
 */
import { DateTime, Money, formatNumber, useT } from "@/i18n";
import type { MessageKey } from "@/i18n";
import {
  type MetricDefinition,
  type MetricId,
  SALES_SUMMARY_SOURCE,
  type SalesKpis,
  metricDefinition,
} from "@/metrics/metricRegistry";
import { BusinessDate } from "@/sales/SaleParts";
import { useId } from "react";
import "./metric-claim.css";

export type ClaimState =
  | { status: "loading" }
  | { status: "hidden" }
  | { status: "error"; requestId?: string; retry: () => void }
  | { status: "unknown" }
  | { status: "ready"; data: SalesKpis };

export type ClaimScope =
  | { kind: "store"; storeName: string; timeZone: string }
  | { kind: "all_in_scope"; storeCount: number; timeZones: readonly string[] };

export interface ClaimContext {
  scope: ClaimScope;
  /** Inclusive business dates; `partial` when the range ends on a day not yet over. */
  period: { from: string; to: string; partial?: boolean };
  /** The read's `asOf`; absent until a read has answered. */
  asOf?: string;
  completeness: "received_only";
}

export interface Claim {
  metric: MetricId;
  state: ClaimState;
}

type Part = { labelKey: MessageKey; count: number };

function Parts({ parts }: Readonly<{ parts: Part[] }>): React.JSX.Element {
  const t = useT();
  return (
    <ul className="metric-claim__parts">
      {parts.map((p) => (
        <li key={p.labelKey}>
          {t("metrics.claim.part", { label: t(p.labelKey), count: p.count })}
        </li>
      ))}
    </ul>
  );
}

function Count({ count }: Readonly<{ count: number }>): React.JSX.Element {
  const t = useT();
  return <span className="metric-claim__count">{formatNumber(count, t.locale)}</span>;
}

function ReadyValue({
  def,
  kpis,
}: Readonly<{ def: MetricDefinition; kpis: SalesKpis }>): React.JSX.Element {
  const t = useT();
  switch (def.shape) {
    case "money-facts": {
      const facts = kpis[def.id as "receivedSales"];
      return (
        <>
          <Count count={facts.count} />
          {facts.byCurrency.length === 0 ? (
            <span className="metric-claim__quiet">{t("metrics.claim.noAmount")}</span>
          ) : (
            <ul className="metric-claim__amounts">
              {facts.byCurrency.map((c) => (
                <li key={c.currencyCode}>
                  <Money value={c.total} currency={c.currencyCode} />
                </li>
              ))}
            </ul>
          )}
        </>
      );
    }
    case "sync-status": {
      const s = kpis.syncStatus;
      return (
        <Parts
          parts={[
            { labelKey: "metrics.part.captured", count: s.captured },
            { labelKey: "metrics.part.synced", count: s.synced },
            { labelKey: "metrics.part.failedRetryable", count: s.failedRetryable },
            { labelKey: "metrics.part.failedNeedsRepair", count: s.failedNeedsRepair },
          ]}
        />
      );
    }
    case "erp-posting": {
      const e = kpis.erpPosting;
      return (
        <Parts
          parts={[
            { labelKey: "metrics.part.posted", count: e.posted },
            { labelKey: "metrics.part.pending", count: e.pending },
            { labelKey: "metrics.part.failed", count: e.failed },
            { labelKey: "metrics.part.unknown", count: e.unknown },
          ]}
        />
      );
    }
    default: {
      const c = kpis.shiftCloses;
      return (
        <>
          <Count count={c.count} />
          <Parts
            parts={[
              { labelKey: "metrics.part.normal", count: c.normal },
              { labelKey: "metrics.part.forced", count: c.forced },
              { labelKey: "metrics.part.withVariance", count: c.withVariance },
              { labelKey: "metrics.part.approvalMissing.yes", count: c.approvalMissing.yes },
              { labelKey: "metrics.part.approvalMissing.no", count: c.approvalMissing.no },
              {
                labelKey: "metrics.part.approvalMissing.unknown",
                count: c.approvalMissing.unknown,
              },
            ]}
          />
        </>
      );
    }
  }
}

function ClaimValue({
  def,
  state,
  labelId,
}: Readonly<{
  def: MetricDefinition;
  state: Exclude<ClaimState, { status: "hidden" }>;
  labelId: string;
}>): React.JSX.Element {
  const t = useT();
  switch (state.status) {
    case "loading":
      return (
        <dd className="metric-claim__value" aria-busy="true">
          <span className="spinner" aria-hidden="true" />
          {t("metrics.claim.loading")}
        </dd>
      );
    case "error":
      return (
        <dd className="metric-claim__value">
          <span className="metric-claim__error" role="alert">
            {t("metrics.claim.failed")}
            {state.requestId ? (
              <span className="metric-claim__quiet">
                {t.rich("metrics.claim.reference", {
                  id: (
                    <bdi dir="ltr" className="metric-claim__machine">
                      {state.requestId}
                    </bdi>
                  ),
                })}
              </span>
            ) : null}
            <button
              type="button"
              className="btn-secondary"
              aria-describedby={labelId}
              onClick={state.retry}
            >
              {t("metrics.claim.retry")}
            </button>
          </span>
        </dd>
      );
    case "unknown":
      return (
        <dd className="metric-claim__value">
          <span className="metric-claim__word">{t("metrics.claim.unknown")}</span>
          <span className="metric-claim__quiet">{t("metrics.claim.unknownNote")}</span>
        </dd>
      );
    default:
      return (
        <dd className="metric-claim__value">
          <ReadyValue def={def} kpis={state.data} />
        </dd>
      );
  }
}

/** One figure: label, value in its state, and its registry definition. */
function MetricClaim({
  metric,
  state,
}: Readonly<{ metric: MetricId; state: Exclude<ClaimState, { status: "hidden" }> }>) {
  const t = useT();
  const labelId = useId();
  const def = metricDefinition(metric);
  const label = t(def.labelKey);
  return (
    <div className="metric-claim">
      <dt id={labelId} className="metric-claim__label">
        {label}
      </dt>
      <ClaimValue def={def} state={state} labelId={labelId} />
      <dd className="metric-claim__about">
        <details>
          <summary>{t("metrics.claim.about", { label })}</summary>
          <p>{t(def.definitionKey)}</p>
          <p>{t(def.zoneRuleKey)}</p>
          <p>{t(def.unknown.meaningKey)}</p>
          <p className="metric-claim__quiet">
            {t.rich("metrics.claim.source", {
              source: (
                <bdi dir="ltr" className="metric-claim__machine">
                  {`${SALES_SUMMARY_SOURCE.operationId} · ${def.source.field}`}
                </bdi>
              ),
            })}
          </p>
        </details>
      </dd>
    </div>
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

function ContextLine({
  context,
  id,
}: Readonly<{ context: ClaimContext; id: string }>): React.JSX.Element {
  const t = useT();
  const { scope, period, asOf } = context;
  const single = scope.kind === "store";
  // Several stores often share one zone: name each zone once, first seen first.
  const zones = single ? [scope.timeZone] : [...new Set(scope.timeZones)];
  return (
    <p id={id} className="metric-claims__context" data-testid="metric-claims-context">
      <span>
        {single
          ? t.rich("metrics.context.store", { store: <bdi>{scope.storeName}</bdi> })
          : t("metrics.context.allInScope", { count: scope.storeCount })}
      </span>
      {SEP}
      <span>
        {period.from === period.to
          ? t.rich("metrics.context.day", { date: <BusinessDate value={period.from} /> })
          : t.rich("metrics.context.range", {
              from: <BusinessDate value={period.from} />,
              to: <BusinessDate value={period.to} />,
            })}
        {period.partial ? ` ${t("metrics.context.soFar")}` : null}
      </span>
      {SEP}
      <span>
        {t.rich(zones.length === 1 ? "metrics.context.zone" : "metrics.context.zones", {
          zone: <Zones zones={zones} />,
          zones: <Zones zones={zones} />,
        })}
      </span>
      {asOf ? (
        <>
          {SEP}
          <span>
            {t.rich("metrics.context.asOf", {
              // One store: its zone (D5); a scope: UTC, labelled.
              asOf: <DateTime value={asOf} timeZone={single ? scope.timeZone : undefined} />,
            })}
          </span>
        </>
      ) : null}
      {SEP}
      <span>{t("metrics.context.completeness")}</span>
    </p>
  );
}

/**
 * A KPI row: the claims of one read, then the context they share. Renders
 * nothing when every claim is hidden (a refused read is omitted, never zero).
 */
export function MetricClaims({
  context,
  claims,
}: Readonly<{ context: ClaimContext; claims: readonly Claim[] }>): React.JSX.Element | null {
  const contextId = useId();
  const shown = claims.filter(
    (c): c is { metric: MetricId; state: Exclude<ClaimState, { status: "hidden" }> } =>
      c.state.status !== "hidden",
  );
  if (shown.length === 0) return null;
  return (
    <div className="metric-claims">
      <dl className="metric-claims__list" aria-describedby={contextId}>
        {shown.map((c) => (
          <MetricClaim key={c.metric} metric={c.metric} state={c.state} />
        ))}
      </dl>
      <ContextLine context={context} id={contextId} />
    </div>
  );
}
