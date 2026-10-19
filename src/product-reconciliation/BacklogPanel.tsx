import { AsOf, Panel } from "@/erp-status/parts";
/**
 * RT-727 unmapped-product backlog (`listProductReconciliationBacklog`): the
 * live read of active products with no confirmed-and-active ERPNext mapping,
 * filterable by class, cursor-paged. A product with no mapping at all can be
 * repaired here (`suggest_confirm`). A product with only an unconfirmed
 * suggestion is shown with the suggested reference; confirming it needs the
 * mapping's version, which this surface does not receive, so the row says so.
 */
import { DateTime, type T, useT } from "@/i18n";
import type { BacklogClass, BacklogItem } from "@/lib/product-reconciliation-queries";
import { ClassFilter, ClassPill, Raw, ReconTable } from "./parts";
import { BACKLOG_CLASSES, type RepairTarget, backlogRepairBlock } from "./productReconLogic";
import type { ListState } from "./useProductReconciliation";

function headers(t: T): { key: string; header: string }[] {
  return [
    { key: "product", header: t("productRecon.backlog.col.product") },
    { key: "class", header: t("productRecon.backlog.col.class") },
    { key: "suggestion", header: t("productRecon.backlog.col.suggestion") },
    { key: "observedAt", header: t("productRecon.backlog.col.observedAt") },
    { key: "action", header: t("productRecon.backlog.col.action") },
  ];
}

function Suggestion({ item }: Readonly<{ item: BacklogItem }>): React.JSX.Element {
  const t = useT();
  if (!item.erpnextItemRef) return <span className="muted">{t("productRecon.none")}</span>;
  return (
    <span className="recon-stack">
      <Raw value={item.erpnextItemRef} />
      {item.suggestedAt ? (
        <span className="muted">
          {t.rich("productRecon.backlog.suggestedAt", {
            time: <DateTime value={item.suggestedAt} />,
          })}
        </span>
      ) : null}
    </span>
  );
}

function RowAction({
  item,
  onRepair,
}: Readonly<{ item: BacklogItem; onRepair: (target: RepairTarget) => void }>): React.JSX.Element {
  const t = useT();
  const block = backlogRepairBlock(item);
  if (block === "needs-version") {
    return <span className="muted">{t("productRecon.repair.needsVersion")}</span>;
  }
  if (block !== null) return <span className="muted">{t("productRecon.none")}</span>;
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => onRepair({ tenantProductId: item.tenantProductId })}
    >
      {t("productRecon.repair.open")}
    </button>
  );
}

export interface BacklogPanelProps {
  list: ListState<BacklogItem>;
  cls: BacklogClass | "";
  onClassChange: (next: BacklogClass | "") => void;
  onRepair: (target: RepairTarget) => void;
  /** The open repair panel, rendered under the table. */
  repair?: React.ReactNode;
}

export function BacklogPanel({
  list,
  cls,
  onClassChange,
  onRepair,
  repair,
}: Readonly<BacklogPanelProps>): React.JSX.Element {
  const t = useT();
  return (
    <Panel id="recon-backlog" title={t("productRecon.backlog.title")}>
      <p className="content__sub">{t("productRecon.backlog.sub")}</p>
      <ClassFilter
        id="recon-backlog-class"
        classes={BACKLOG_CLASSES}
        value={cls}
        onChange={onClassChange}
      />
      <ReconTable
        list={list}
        caption={t("productRecon.backlog.caption")}
        columns={headers(t)}
        loadingNoun={t("productRecon.backlog.loadingNoun")}
        failedMessage={t("productRecon.backlog.loadFailed")}
        emptyMessage={t("productRecon.backlog.empty")}
        rowKey={(item) => item.tenantProductId}
        renderRow={(item) => (
          <tr className="data-table__row erp-row">
            <th scope="row">
              <Raw value={item.tenantProductId} />
            </th>
            <td className="nowrap">
              <ClassPill value={item.mismatchClass} />
            </td>
            <td>
              <Suggestion item={item} />
            </td>
            <td>
              <DateTime value={item.observedAt} />
            </td>
            <td>
              <RowAction item={item} onRepair={onRepair} />
            </td>
          </tr>
        )}
      />
      {repair}
      <AsOf at={list.asOf} />
    </Panel>
  );
}
