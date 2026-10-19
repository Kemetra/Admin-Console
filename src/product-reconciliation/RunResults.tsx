/**
 * RT-727 one run's classified mismatch report
 * (`getProductReconciliationRunResults`), filterable by class (`?class=`),
 * cursor-paged. Each line shows its class, the product and ERPNext item refs,
 * 021's own result state and the detail as received. An open
 * `unmapped_dp2_product` line can be repaired (`suggest_confirm` with the run
 * and result ids, so the line moves open → repaired on `mapped`). An unknown or
 * out-of-scope run is the API's non-disclosing 404; a malformed run id is
 * never sent and reads the same.
 */
import { BackArrow } from "@/components/BackArrow";
import { AsOf, Panel, StatusPill } from "@/erp-status/parts";
import { type T, useT } from "@/i18n";
import type {
  MismatchClass,
  ProductReconciliationResult,
} from "@/lib/product-reconciliation-queries";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ReconGate } from "./ProductReconciliation";
import { RepairPanel } from "./RepairPanel";
import { ClassFilter, ClassPill, Raw, ReadErrorBanner, Received, ReconTable } from "./parts";
import {
  RESULT_CLASSES,
  type RepairTarget,
  classFilter,
  detailEntries,
  isRunId,
  resultRepairBlock,
  resultStateView,
} from "./productReconLogic";
import { type ReconScope, useRunResults } from "./useProductReconciliation";
import "../shell/surface.css";
import "../erp-status/erp-status.css";
import "./product-reconciliation.css";

function headers(t: T): { key: string; header: string }[] {
  return [
    { key: "class", header: t("productRecon.results.col.class") },
    { key: "product", header: t("productRecon.results.col.product") },
    { key: "erpnext", header: t("productRecon.results.col.erpnext") },
    { key: "state", header: t("productRecon.results.col.state") },
    { key: "detail", header: t("productRecon.results.col.detail") },
    { key: "action", header: t("productRecon.results.col.action") },
  ];
}

function Ref({ value }: Readonly<{ value: string | null }>): React.JSX.Element {
  const t = useT();
  return value ? <Raw value={value} /> : <span className="muted">{t("productRecon.none")}</span>;
}

function RowAction({
  result,
  onRepair,
}: Readonly<{
  result: ProductReconciliationResult;
  onRepair: (target: RepairTarget) => void;
}>): React.JSX.Element {
  const t = useT();
  const block = resultRepairBlock(result);
  if (block === "needs-version") {
    return <span className="muted">{t("productRecon.repair.needsVersion")}</span>;
  }
  if (block !== null || !result.tenantProductId) {
    return <span className="muted">{t("productRecon.none")}</span>;
  }
  const tenantProductId = result.tenantProductId;
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => onRepair({ tenantProductId, runId: result.runId, resultId: result.id })}
    >
      {t("productRecon.repair.open")}
    </button>
  );
}

function BackLink(): React.JSX.Element {
  const t = useT();
  return (
    <Link to="/product-reconciliation" className="surface__back">
      <BackArrow /> {t("productRecon.results.back")}
    </Link>
  );
}

function Results({
  scope,
  runId,
}: Readonly<{ scope: ReconScope; runId: string }>): React.JSX.Element {
  const t = useT();
  const [search, setSearch] = useSearchParams();
  const cls = classFilter<MismatchClass>(search.get("class"), RESULT_CLASSES);
  const list = useRunResults(scope, runId, cls, true);
  const [target, setTarget] = useState<RepairTarget | null>(null);

  return (
    <Panel id="recon-results" title={t("productRecon.results.title")}>
      <p className="content__sub">
        {t.rich("productRecon.results.sub", { run: <Raw value={runId} /> })}
      </p>
      <ClassFilter
        id="recon-results-class"
        classes={RESULT_CLASSES}
        value={cls}
        onChange={(next) => setSearch(next ? new URLSearchParams({ class: next }) : {})}
      />
      <ReconTable
        list={list}
        caption={t("productRecon.results.caption")}
        columns={headers(t)}
        loadingNoun={t("productRecon.results.loadingNoun")}
        failedMessage={t("productRecon.results.loadFailed")}
        notFoundMessage={t("productRecon.results.notFound")}
        emptyMessage={t("productRecon.results.empty")}
        rowKey={(result) => result.id}
        renderRow={(result) => (
          <tr className="data-table__row erp-row">
            <th scope="row" className="nowrap">
              <ClassPill value={result.mismatchClass} />
            </th>
            <td>
              <Ref value={result.tenantProductId} />
            </td>
            <td>
              <Ref value={result.erpnextItemRef} />
            </td>
            <td className="nowrap">
              <StatusPill view={resultStateView(result.resultState)} />
            </td>
            <td>
              <Received entries={detailEntries(result.detail)} emptyKey="productRecon.none" />
            </td>
            <td>
              <RowAction result={result} onRepair={setTarget} />
            </td>
          </tr>
        )}
      />
      {target ? (
        <RepairPanel
          key={target.resultId}
          scope={scope}
          target={target}
          onClose={() => setTarget(null)}
        />
      ) : null}
      <AsOf at={list.asOf} />
    </Panel>
  );
}

function Content({ scope }: Readonly<{ scope: ReconScope }>): React.JSX.Element {
  const t = useT();
  const { runId } = useParams();
  return (
    <div className="surface erp-surface">
      <BackLink />
      <header className="surface__head">
        <h1 className="content__title">{t("productRecon.results.heading")}</h1>
      </header>
      {isRunId(runId) ? (
        <Results scope={scope} runId={runId} />
      ) : (
        <ReadErrorBanner
          error={{ kind: "not-found" }}
          failedMessage={t("productRecon.results.loadFailed")}
          notFoundMessage={t("productRecon.results.notFound")}
          onRetry={() => {}}
        />
      )}
    </div>
  );
}

export function RunResults(): React.JSX.Element {
  return <ReconGate>{(scope) => <Content scope={scope} />}</ReconGate>;
}
