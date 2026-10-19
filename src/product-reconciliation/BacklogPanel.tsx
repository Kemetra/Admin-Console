import { AsOf, Panel } from "@/erp-status/parts";
/**
 * RT-727 unmapped-product backlog (`listProductReconciliationBacklog`): the
 * live read of active products with no confirmed-and-active ERPNext mapping,
 * filterable by class, cursor-paged. A product with no mapping at all can be
 * repaired here (`suggest_confirm`). A product with only an unconfirmed
 * suggestion is shown with the suggested reference and is `confirm`ed with the
 * `suggestionMappingId` + `suggestionMappingVersion` the row carries (RT-733);
 * a row without both links to the item mappings screen instead.
 */
import { DateTime, type T, useT } from "@/i18n";
import type { BacklogClass, BacklogItem } from "@/lib/product-reconciliation-queries";
import { ClassFilter, ClassPill, Raw, ReconTable, RepairAction } from "./parts";
import { BACKLOG_CLASSES, type RepairTarget, backlogRepair } from "./productReconLogic";
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
              <RepairAction plan={backlogRepair(item)} onRepair={onRepair} />
            </td>
          </tr>
        )}
      />
      {repair}
      <AsOf at={list.asOf} />
    </Panel>
  );
}
