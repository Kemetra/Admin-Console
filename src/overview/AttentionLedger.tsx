/**
 * RT-559 attention ledger (spec 009 P-1…P-4, §7 "Precision Ledger"). One row
 * per domain with work waiting in the current scope: label, count or state,
 * and a link to the screen that owns the work. The ledger links; it never acts.
 *
 * Each row owns its loading / error / Unknown state (§6.4), and a refused panel
 * renders no row at all (§6.2). P-1 is one row per store, with the stock
 * screen's own snapshot words (Unknown stays Unknown, AC-4).
 */
import { DateTime, type MessageKey, useT } from "@/i18n";
import type { StoreNegativeOnHandSummary } from "@/lib/stock-discrepancy-queries";
import {
  asOfTime,
  negativeCountLabel,
  statusView,
} from "@/stock-discrepancies/stockDiscrepancyLogic";
import { useId } from "react";
import { Link } from "react-router";
import type { PageCount } from "./overviewLogic";
import {
  type OverviewSession,
  type StockPanel,
  useShiftPanel,
  useStockPanel,
  useUnknownItemsPanel,
} from "./useOverviewPanels";
import type { PanelState } from "./usePanelQuery";

interface RowLink {
  to: string;
  text: string;
}

function LedgerRow({
  label,
  link,
  children,
}: Readonly<{ label: string; link: RowLink; children: React.ReactNode }>): React.JSX.Element {
  // Links repeat ("View store discrepancies" per store): the row label describes each one.
  const labelId = useId();
  return (
    <li className="ledger__row">
      <span id={labelId} className="ledger__label">
        {label}
      </span>
      <span className="ledger__value">{children}</span>
      <Link className="ledger__link" to={link.to} aria-describedby={labelId}>
        {link.text}
      </Link>
    </li>
  );
}

/** The value cell while a read is not ready: an indicator, or a notice with retry. */
function PendingValue({
  state,
}: Readonly<{
  state: Exclude<PanelState<unknown>, { status: "ready" | "hidden" }>;
}>): React.JSX.Element {
  const t = useT();
  if (state.status === "loading") {
    return (
      <span className="ledger__pending" aria-busy="true">
        <span className="spinner" aria-hidden="true" />
        {t("overview.row.loading")}
      </span>
    );
  }
  return (
    <span className="ledger__error" role="alert">
      {t("overview.row.failed")}
      <button type="button" className="btn-secondary ledger__retry" onClick={state.retry}>
        {t("overview.row.retry")}
      </button>
    </span>
  );
}

function CountValue({
  count,
  noun,
}: Readonly<{ count: PageCount; noun: MessageKey }>): React.JSX.Element {
  const t = useT();
  switch (count.kind) {
    case "exact":
      return (
        <span className="ledger__count">
          {t("overview.count.exact", { noun: t(noun), count: count.count })}
        </span>
      );
    case "atLeast":
      return (
        <span className="ledger__count">
          {t("overview.count.atLeast", { noun: t(noun), count: count.count })}
        </span>
      );
    case "none":
      return <span className="ledger__quiet">{t("overview.count.none")}</span>;
    default:
      return <span className="ledger__quiet">{t("overview.count.unproven")}</span>;
  }
}

/** A one-page count row (P-2…P-4). */
function CountRow({
  state,
  label,
  noun,
  link,
}: Readonly<{
  state: PanelState<PageCount>;
  label: string;
  noun: MessageKey;
  link: RowLink;
}>): React.JSX.Element | null {
  if (state.status === "hidden") return null;
  return (
    <LedgerRow label={label} link={link}>
      {state.status === "ready" ? (
        <CountValue count={state.data} noun={noun} />
      ) : (
        <PendingValue state={state} />
      )}
    </LedgerRow>
  );
}

function StoreSnapshot({ row }: Readonly<{ row: StoreNegativeOnHandSummary }>): React.JSX.Element {
  const t = useT();
  const view = statusView(row.snapshot.status);
  const count = negativeCountLabel(row.snapshot.status, row.negativeItemCount);
  const asOf = asOfTime(row.snapshot);
  return (
    <>
      <span className="ledger__count">
        {t("overview.count.exact", {
          noun: t("overview.stock.noun"),
          count: t(count.key, count.params),
        })}
      </span>
      <span className="ledger__meta">
        {/* Healthy stays quiet (§7): a fresh snapshot shows only its as-of time. */}
        {row.snapshot.status === "fresh" ? null : (
          <span className={view.badgeClass}>{t(view.labelKey)}</span>
        )}
        {asOf ? (
          <span>{t.rich("overview.stock.asOf", { asOf: <DateTime value={asOf} /> })}</span>
        ) : null}
      </span>
    </>
  );
}

function StockRows({
  state,
}: Readonly<{ state: PanelState<StockPanel> }>): React.JSX.Element | null {
  const t = useT();
  const all: RowLink = { to: "/stock-discrepancies", text: t("overview.stock.openAll") };
  if (state.status === "hidden") return null;
  if (state.status !== "ready") {
    return (
      <LedgerRow label={t("overview.stock.labelAll")} link={all}>
        <PendingValue state={state} />
      </LedgerRow>
    );
  }
  const { stores, truncated } = state.data;
  if (stores.length === 0) {
    return (
      <LedgerRow label={t("overview.stock.labelAll")} link={all}>
        <span className="ledger__quiet">{t("overview.stock.none")}</span>
      </LedgerRow>
    );
  }
  return (
    <>
      {stores.map((row) => (
        <LedgerRow
          key={row.storeId}
          label={t("overview.stock.label", { store: row.storeName })}
          link={{ to: `/stock-discrepancies/${row.storeId}`, text: t("overview.stock.open") }}
        >
          <StoreSnapshot row={row} />
        </LedgerRow>
      ))}
      {truncated ? (
        <LedgerRow label={t("overview.stock.labelAll")} link={all}>
          <span className="ledger__quiet">{t("overview.stock.more")}</span>
        </LedgerRow>
      ) : null}
    </>
  );
}

export function AttentionLedger({
  session,
  nowMs,
}: Readonly<{ session: OverviewSession; nowMs: number }>): React.JSX.Element {
  const t = useT();
  const stock = useStockPanel(session);
  const shift = useShiftPanel(session, nowMs);
  const unknown = useUnknownItemsPanel(session);
  const allHidden = [stock, shift.state, unknown].every((s) => s.status === "hidden");

  return (
    <section className="overview__section" aria-labelledby="overview-attention">
      <h2 id="overview-attention" className="overview__heading">
        {t("overview.attention.title")}
      </h2>
      {allHidden ? (
        <p className="ledger__quiet">{t("overview.attention.nothingForRole")}</p>
      ) : (
        <ul className="ledger">
          <StockRows state={stock} />
          <CountRow
            state={shift.state}
            label={t("overview.shift.label")}
            noun="overview.shift.noun"
            link={{ to: shift.href, text: t("overview.shift.open") }}
          />
          <CountRow
            state={unknown}
            label={t("overview.unknown.label")}
            noun="overview.unknown.noun"
            link={{ to: "/unknown-items", text: t("overview.unknown.open") }}
          />
        </ul>
      )}
    </section>
  );
}
