/**
 * RT-820 Overview P-6 (spec 009 OD-009-1 / AC-11): today's received-sale count and
 * gross per currency, per store in scope, as text. Each store is shown at its own
 * `currentBusinessDate` through the shared `MetricClaims` (RT-819), so its date,
 * zone, `asOf` and the received-only note travel with the figure. A store whose
 * date the read does not carry is `unknown`, never zero. A scope total appears only
 * when every store is on one date; it has no link, because `/sales` needs a store.
 * No chart on the Overview (NG-2).
 */
import { MetricClaims } from "@/components/MetricClaim";
import { useT } from "@/i18n";
import type { SalesSummary } from "@/lib/sales-summary-queries";
import { useId } from "react";
import { Link } from "react-router";
import { type StoreToday, salesDrillDown, scopeToday, storeToday } from "./salesTodayLogic";
import type { OverviewSession } from "./useOverviewPanels";
import type { PanelState } from "./usePanelQuery";
import { type SalesTodayPanel, useSalesTodayPanel } from "./useSalesTodayPanel";

function StoreRow({
  today,
  name,
  asOf,
}: Readonly<{ today: StoreToday; name: string | undefined; asOf: string }>): React.JSX.Element {
  const t = useT();
  // Links repeat ("View store sales" per store): the store's name describes each one.
  const labelId = useId();
  const machine = name === undefined;
  const label = name ?? today.storeRef;
  return (
    <li className="sales-today__row">
      <div className="sales-today__head">
        <span id={labelId} className="ledger__label">
          <bdi dir={machine ? "ltr" : undefined}>{label}</bdi>
        </span>
        <Link
          className="ledger__link"
          to={salesDrillDown(today.storeRef, today.date)}
          aria-describedby={labelId}
        >
          {t("overview.sales.open")}
        </Link>
      </div>
      <MetricClaims
        context={{
          scope: { kind: "store", storeName: label, timeZone: today.timeZone, machine },
          period: { from: today.date, to: today.date, partial: true },
          asOf,
          completeness: "received_only",
        }}
        claims={[
          {
            metric: "receivedSales",
            state:
              today.state === "ready"
                ? { status: "ready", data: today.kpis }
                : { status: "unknown" },
          },
        ]}
      />
    </li>
  );
}

function ScopeRow({ summary }: Readonly<{ summary: SalesSummary }>): React.JSX.Element | null {
  const t = useT();
  const total = scopeToday(summary);
  if (!total) return null;
  return (
    <li className="sales-today__row">
      <div className="sales-today__head">
        <span className="ledger__label">{t("overview.sales.total")}</span>
      </div>
      <MetricClaims
        context={{
          scope: { kind: "all_in_scope", storeCount: total.storeCount, timeZones: total.timeZones },
          period: { from: total.date, to: total.date, partial: true },
          asOf: summary.asOf,
          completeness: "received_only",
        }}
        claims={[{ metric: "receivedSales", state: { status: "ready", data: total.kpis } }]}
      />
    </li>
  );
}

function Pending({
  state,
}: Readonly<{
  state: Exclude<PanelState<unknown>, { status: "ready" | "hidden" }>;
}>): React.JSX.Element {
  const t = useT();
  if (state.status === "loading") {
    return (
      <p className="ledger__pending" aria-busy="true">
        <span className="spinner" aria-hidden="true" />
        {t("overview.row.loading")}
      </p>
    );
  }
  return (
    <p className="ledger__error" role="alert">
      {t("overview.row.failed")}
      <button type="button" className="btn-secondary ledger__retry" onClick={state.retry}>
        {t("overview.row.retry")}
      </button>
    </p>
  );
}

function Body({ panel }: Readonly<{ panel: SalesTodayPanel }>): React.JSX.Element | null {
  const t = useT();
  const { state, names } = panel;
  if (state.status === "hidden") return null;
  if (state.status !== "ready") return <Pending state={state} />;
  const summary = state.data;
  if (summary.stores.length === 0) {
    return <p className="ledger__quiet">{t("overview.sales.none")}</p>;
  }
  const stores = summary.stores.map(storeToday);
  const mixed = new Set(stores.map((s) => s.date)).size > 1;
  return (
    <>
      <ul className="sales-today">
        <ScopeRow summary={summary} />
        {stores.map((s) => (
          <StoreRow key={s.storeRef} today={s} name={names.get(s.storeRef)} asOf={summary.asOf} />
        ))}
      </ul>
      {mixed ? <p className="ledger__quiet">{t("overview.sales.mixedDays")}</p> : null}
      {summary.nextCursor === null ? null : (
        <p className="ledger__quiet">
          {t("overview.sales.more")}{" "}
          <Link className="ledger__link" to="/sales">
            {t("overview.sales.openSales")}
          </Link>
        </p>
      )}
    </>
  );
}

export function SalesToday({
  session,
  nowMs,
}: Readonly<{ session: OverviewSession; nowMs: number }>): React.JSX.Element | null {
  const t = useT();
  const panel = useSalesTodayPanel(session, nowMs);
  if (panel.state.status === "hidden") return null;
  return (
    <section className="overview__section" aria-labelledby="overview-sales">
      <h2 id="overview-sales" className="overview__heading">
        {t("overview.sales.title")}
      </h2>
      <Body panel={panel} />
    </section>
  );
}
