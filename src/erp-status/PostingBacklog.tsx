/**
 * RT-560 posting backlog (spec 016 §4.3): the tenant's permanently rejected
 * (dead-lettered) postings, cursor-paged, read-only. Each row shows its kind,
 * POS reference, source, rejection class ("not recorded" when null) and when it
 * was rejected. There is no reason text in the contract (RT-410), so none is
 * shown or inferred, and there is no repair action (Phase C) (A-5).
 */
import { DateTime, type T, useT } from "@/i18n";
import type { PostingBacklogItem } from "@/lib/erp-status-queries";
import { postingKindKey } from "./erpStatusLogic";
import { AsOf, CursorTable, Panel, StaleError } from "./parts";
import type { ListState as CursorListState } from "./useErpStatus";

type BacklogList = CursorListState<PostingBacklogItem>;

function headers(t: T): { key: string; header: string }[] {
  return [
    { key: "kind", header: t("erp.backlog.col.kind") },
    { key: "externalId", header: t("erp.backlog.col.externalId") },
    { key: "source", header: t("erp.backlog.col.source") },
    { key: "rejectionClass", header: t("erp.backlog.col.rejectionClass") },
    { key: "deadLetteredAt", header: t("erp.backlog.col.deadLetteredAt") },
  ];
}

function BacklogRow({ item }: Readonly<{ item: PostingBacklogItem }>): React.JSX.Element {
  const t = useT();
  return (
    <tr className="data-table__row erp-row">
      <td>{t(postingKindKey(item.kind))}</td>
      <th scope="row" className="data-table__cell--mono erp-row__name">
        <bdi dir="ltr">{item.externalId}</bdi>
      </th>
      <td className="data-table__cell--mono">
        <bdi dir="ltr">{item.sourceSystem}</bdi>
      </td>
      <td>
        {item.rejectionClass ? (
          <bdi dir="ltr" className="data-table__cell--mono">
            {item.rejectionClass}
          </bdi>
        ) : (
          <span className="muted">{t("erp.backlog.notRecorded")}</span>
        )}
      </td>
      <td>
        <DateTime value={item.deadLetteredAt} />
      </td>
    </tr>
  );
}

export function PostingBacklog({ list }: Readonly<{ list: BacklogList }>): React.JSX.Element {
  const t = useT();
  return (
    <Panel id="erp-backlog" title={t("erp.backlog.title")}>
      <p className="content__sub">{t("erp.backlog.sub")}</p>
      <p className="erp-note">{t("erp.backlog.reasonNote")}</p>
      <StaleError panel={list} />
      <CursorTable
        list={list}
        caption={t("erp.backlog.caption")}
        columns={headers(t)}
        loadingNoun={t("erp.backlog.loadingNoun")}
        failedMessage={t("erp.backlog.loadFailed")}
        emptyMessage={t("erp.backlog.empty")}
        rowKey={(item) => item.postingStatusId}
        renderRow={(item) => <BacklogRow item={item} />}
      />
      <AsOf at={list.asOf} />
    </Panel>
  );
}
