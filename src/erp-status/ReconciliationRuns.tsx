/**
 * RT-560 reconciliation run history (spec 016 §4.4): stock runs newest first,
 * cursor-paged, with trigger, status, timing and the per-class mismatch counts
 * as received. Mismatch detail and the Refresh action stay in the shipped Stock
 * discrepancies screen (RT-178): each store links there instead of duplicating it.
 */
import { DateTime, type T, useT } from "@/i18n";
import type { ReconciliationRunView } from "@/lib/erp-status-queries";
import { Link } from "react-router";
import { mismatchEntries, runStatusView, runTriggerKey } from "./erpStatusLogic";
import { AsOf, CursorTable, Panel, StaleError, StatusPill } from "./parts";
import type { ListState as CursorListState } from "./useErpStatus";

type RunList = CursorListState<ReconciliationRunView>;

/** Store names for the run rows; a store the roster lacks reads "unknown store". */
export type StoreNameOf = (storeId: string) => string | undefined;

function headers(t: T): { key: string; header: string }[] {
  return [
    { key: "store", header: t("erp.runs.col.store") },
    { key: "trigger", header: t("erp.runs.col.trigger") },
    { key: "status", header: t("erp.runs.col.status") },
    { key: "startedAt", header: t("erp.runs.col.startedAt") },
    { key: "finishedAt", header: t("erp.runs.col.finishedAt") },
    { key: "mismatches", header: t("erp.runs.col.mismatches") },
  ];
}

function Mismatches({ run }: Readonly<{ run: ReconciliationRunView }>): React.JSX.Element {
  const t = useT();
  const entries = mismatchEntries(run.mismatchSummary);
  if (entries.length === 0) return <span className="muted">{t("erp.runs.noMismatches")}</span>;
  return (
    <ul className="erp-mismatches">
      {entries.map(([kind, count]) => (
        <li key={kind}>
          {t.rich("erp.runs.mismatch", {
            kind: (
              <bdi dir="ltr" className="data-table__cell--mono">
                {kind}
              </bdi>
            ),
            count,
          })}
        </li>
      ))}
    </ul>
  );
}

function RunRow({
  run,
  nameOf,
}: Readonly<{ run: ReconciliationRunView; nameOf: StoreNameOf }>): React.JSX.Element {
  const t = useT();
  return (
    <tr className="data-table__row erp-row">
      <th scope="row" className="erp-row__name">
        <Link to={`/stock-discrepancies/${run.storeId}`}>
          {nameOf(run.storeId) ?? t("erp.runs.unknownStore")}
        </Link>
      </th>
      <td>{t(runTriggerKey(run.trigger))}</td>
      <td className="nowrap">
        <StatusPill view={runStatusView(run.status)} />
      </td>
      <td>
        <DateTime value={run.startedAt} />
      </td>
      <td>
        {run.finishedAt ? (
          <DateTime value={run.finishedAt} />
        ) : (
          <span className="muted">{t("erp.runs.notFinished")}</span>
        )}
      </td>
      <td>
        <Mismatches run={run} />
      </td>
    </tr>
  );
}

export function ReconciliationRuns({
  list,
  nameOf,
}: Readonly<{ list: RunList; nameOf: StoreNameOf }>): React.JSX.Element {
  const t = useT();
  return (
    <Panel id="erp-runs" title={t("erp.runs.title")}>
      <p className="content__sub">
        {t.rich("erp.runs.sub", {
          link: <Link to="/stock-discrepancies">{t("shell.nav.stockDiscrepancies")}</Link>,
        })}
      </p>
      <StaleError panel={list} />
      <CursorTable
        list={list}
        caption={t("erp.runs.caption")}
        columns={headers(t)}
        loadingNoun={t("erp.runs.loadingNoun")}
        failedMessage={t("erp.runs.loadFailed")}
        emptyMessage={t("erp.runs.empty")}
        rowKey={(run) => run.runId}
        renderRow={(run) => <RunRow run={run} nameOf={nameOf} />}
      />
      <AsOf at={list.asOf} />
    </Panel>
  );
}
