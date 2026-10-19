/**
 * RT-727 product-master reconciliation runs: the run history
 * (`listProductReconciliationRuns`, newest first, cursor-paged) and the
 * explicit "Start a run" action (`triggerProductReconciliationRun`). Starting a
 * run is a two-step confirmed action with one Idempotency-Key per
 * confirmation; it is never retried by the console. The started run is shown
 * as the server returned it. An unavailable or partial ERPNext view is a
 * reported condition of the run, not a failure (FR-007).
 */
import { AsOf, Panel, StatusPill } from "@/erp-status/parts";
import { DateTime, type T, useT } from "@/i18n";
import type { ProductReconciliationRun } from "@/lib/product-reconciliation-queries";
import { useState } from "react";
import { Link } from "react-router";
import { OutcomeBanner, Received, ReconTable, RefusalBanner } from "./parts";
import {
  type TriggerOutcome,
  newIdempotencyKey,
  runStatusView,
  runTriggerKey,
  summaryEntries,
  viewStatusView,
} from "./productReconLogic";
import { type ListState, type ReconScope, useTriggerRun } from "./useProductReconciliation";

function headers(t: T): { key: string; header: string }[] {
  return [
    { key: "startedAt", header: t("productRecon.runs.col.startedAt") },
    { key: "trigger", header: t("productRecon.runs.col.trigger") },
    { key: "status", header: t("productRecon.runs.col.status") },
    { key: "view", header: t("productRecon.runs.col.view") },
    { key: "finishedAt", header: t("productRecon.runs.col.finishedAt") },
    { key: "summary", header: t("productRecon.runs.col.summary") },
    { key: "results", header: t("productRecon.runs.col.results") },
  ];
}

function RunRow({ run }: Readonly<{ run: ProductReconciliationRun }>): React.JSX.Element {
  const t = useT();
  return (
    <tr className="data-table__row erp-row">
      <th scope="row">
        <DateTime value={run.startedAt} />
      </th>
      <td>{t(runTriggerKey(run.trigger))}</td>
      <td className="nowrap">
        <StatusPill view={runStatusView(run.status)} />
      </td>
      <td className="nowrap">
        <StatusPill view={viewStatusView(run.erpnextViewStatus)} />
      </td>
      <td>
        {run.finishedAt ? (
          <DateTime value={run.finishedAt} />
        ) : (
          <span className="muted">{t("productRecon.runs.notFinished")}</span>
        )}
      </td>
      <td>
        <Received entries={summaryEntries(run.summary)} emptyKey="productRecon.runs.noSummary" />
      </td>
      <td>
        <Link to={`/product-reconciliation/runs/${run.id}`}>
          {t("productRecon.runs.viewResults")}
        </Link>
      </td>
    </tr>
  );
}

function StartedRun({ run }: Readonly<{ run: ProductReconciliationRun }>): React.JSX.Element {
  const t = useT();
  return (
    <OutcomeBanner
      view={{ variant: "success", messageKey: "productRecon.trigger.started" }}
      message={t("productRecon.trigger.started", {
        status: t(runStatusView(run.status).labelKey),
        view: t(viewStatusView(run.erpnextViewStatus).labelKey),
      })}
    />
  );
}

/** "Start a run" → confirm → one request. The outcome stays until the next action. */
function TriggerRun({ scope }: Readonly<{ scope: ReconScope }>): React.JSX.Element {
  const t = useT();
  const trigger = useTriggerRun(scope);
  const [confirming, setConfirming] = useState(false);
  const [outcome, setOutcome] = useState<TriggerOutcome | null>(null);

  async function confirm(): Promise<void> {
    setOutcome(null);
    const result = await trigger.mutateAsync(newIdempotencyKey());
    setConfirming(false);
    setOutcome(result);
  }

  return (
    <div className="recon-trigger">
      {confirming ? (
        <section className="recon-confirm" aria-label={t("productRecon.trigger.confirmLabel")}>
          <p>{t("productRecon.trigger.confirmPrompt")}</p>
          <div className="recon-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={trigger.isPending}
              onClick={() => void confirm()}
            >
              {trigger.isPending ? <span className="spinner" aria-hidden="true" /> : null}
              {t("productRecon.trigger.confirm")}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={trigger.isPending}
              onClick={() => setConfirming(false)}
            >
              {t("common.cancel")}
            </button>
          </div>
        </section>
      ) : (
        <div className="recon-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setOutcome(null);
              setConfirming(true);
            }}
          >
            {t("productRecon.trigger.start")}
          </button>
        </div>
      )}
      {outcome?.kind === "started" ? <StartedRun run={outcome.run} /> : null}
      {outcome?.kind === "refused" ? <RefusalBanner outcome={outcome} /> : null}
    </div>
  );
}

export function RunsPanel({
  scope,
  list,
}: Readonly<{ scope: ReconScope; list: ListState<ProductReconciliationRun> }>): React.JSX.Element {
  const t = useT();
  return (
    <Panel id="recon-runs" title={t("productRecon.runs.title")}>
      <p className="content__sub">{t("productRecon.runs.sub")}</p>
      <TriggerRun scope={scope} />
      <ReconTable
        list={list}
        caption={t("productRecon.runs.caption")}
        columns={headers(t)}
        loadingNoun={t("productRecon.runs.loadingNoun")}
        failedMessage={t("productRecon.runs.loadFailed")}
        emptyMessage={t("productRecon.runs.empty")}
        rowKey={(run) => run.id}
        renderRow={(run) => <RunRow run={run} />}
      />
      <AsOf at={list.asOf} />
    </Panel>
  );
}
