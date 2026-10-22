import { Banner } from "@/components/Banner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { DataTable } from "@/components/DataTable";
import { ListState } from "@/components/ListState";
import { SelectionSummary } from "@/components/SelectionSummary";
import { Icon } from "@/components/icons/Icon";
import { useRowSelection } from "@/components/useRowSelection";
import { DateTime, type MessageKey, type T, useT } from "@/i18n";
import {
  BULK_DISMISS_MAX,
  type BulkDismissOutcome,
  type ListUnknownItemsParams,
  type ReviewQueueItem,
  type UnknownItemErrorRender,
  identifierTypeKey,
} from "@/lib/unknown-items-queries";
/**
 * SF-4a-1 — Unknown-items review queue (T006). The backend-scoped pending page
 * rendered as a table (tables-over-cards); no client-side authorization filter.
 * Zero rows is a successful empty state. Errors route through the persistent
 * Banner (403 forbidden, retryable 5xx) — never toasts.
 *
 * A local control row drives the 007 list params (source_system filter, sort,
 * group_by). Changing a control re-keys the query (the params are part of the
 * query key), so the queue re-fetches structurally. Row activation opens the
 * inspect drawer (SF-4a-2). No role-hiding of any action (VG-5).
 * RT-399: column headers are built per render from the active locale; the
 * identifier and store id are machine values (LTR-isolated) and
 * `encountered_at` is an operational instant (`<DateTime>`).
 *
 * RT-724 (RF-4b): a status filter reaches dismissed items (to reopen them) and
 * resolved ones; on the pending queue a bulk action dismisses the explicit,
 * counted selection (≤ BULK_DISMISS_MAX, never clamped). Write outcomes stay on
 * the queue as persistent banners.
 *
 * RT-771 (UX-10, owner decision RT-752 D1): the first adopter of the shared
 * selection model. The checkbox column, the page toggle and the count are the
 * shared `DataTable` selection + `useRowSelection` + `SelectionSummary`; in
 * selection mode a row opens through its explicit «Open» button (RT-756). The
 * selection scope is tenant + store + filters + sort, so any change to them
 * empties it. It is the visible page only: there is no "select all matching"
 * (no authoritative total and no handler exist for this queue).
 */
import { useMemo, useState } from "react";
import { UnknownItemErrorBanner } from "./UnknownItemErrorBanner";
import { UnknownItemInspectDrawer } from "./UnknownItemInspectDrawer";
import { useUnknownItemBulkDismiss, useUnknownItemList } from "./useUnknownItemQueries";
import { useUnknownItemScope } from "./useUnknownItemScope";
import "./unknown-items.css";

/** Identifier type label; an out-of-contract value shows verbatim. */
function identifierTypeLabel(t: T, type: ReviewQueueItem["identifier_type"]): string {
  const key = identifierTypeKey(type);
  return key ? t(key) : type;
}

type Status = NonNullable<ListUnknownItemsParams["status"]>;

/** Per-outcome counts of a bulk dismiss, for the result banners. */
interface BulkSummary {
  dismissed: number;
  alreadyReconciled: number;
  notFound: number;
}

function summarize(outcomes: ReadonlyArray<BulkDismissOutcome>): BulkSummary {
  const count = (o: BulkDismissOutcome["outcome"]) =>
    outcomes.filter((x) => x.outcome === o).length;
  return {
    dismissed: count("dismissed"),
    alreadyReconciled: count("already_reconciled"),
    notFound: count("not_found"),
  };
}

function columns(t: T) {
  return [
    {
      key: "identifier",
      header: t("unknownItems.col.identifier"),
      cell: (r: ReviewQueueItem) => <bdi dir="ltr">{r.identifier_value}</bdi>,
      mono: true,
    },
    {
      key: "type",
      header: t("unknownItems.col.type"),
      cell: (r: ReviewQueueItem) => identifierTypeLabel(t, r.identifier_type),
    },
    {
      key: "store",
      header: t("unknownItems.col.store"),
      cell: (r: ReviewQueueItem) => <bdi dir="ltr">{r.store_id}</bdi>,
      mono: true,
    },
    {
      key: "source",
      header: t("unknownItems.col.source"),
      cell: (r: ReviewQueueItem) =>
        r.source_system ? <bdi dir="ltr">{r.source_system}</bdi> : "—",
    },
    {
      key: "encountered",
      header: t("unknownItems.col.encountered"),
      cell: (r: ReviewQueueItem) => <DateTime value={r.encountered_at} />,
    },
  ];
}

/** Persistent banner for a list failure; a retryable 5xx also offers a retry. */
function UnknownItemListError({
  error,
  onRetry,
}: Readonly<{ error: UnknownItemErrorRender; onRetry: () => void }>): React.JSX.Element | null {
  const t = useT();
  if (error.kind !== "banner" && error.kind !== "generic") {
    return null;
  }
  const retry =
    error.kind === "banner" && error.retryable ? (
      <button type="button" className="btn-ghost" onClick={onRetry}>
        {t("unknownItems.retry")}
      </button>
    ) : undefined;
  return (
    <Banner
      variant="danger"
      message={t(error.messageKey)}
      requestId={error.requestId}
      action={retry}
    />
  );
}

export function UnknownItemList(): React.JSX.Element {
  const t = useT();
  const { activeTenantId, activeStoreId } = useUnknownItemScope();
  const [sourceSystem, setSourceSystem] = useState("");
  const [sort, setSort] = useState<NonNullable<ListUnknownItemsParams["sort"]>>("age_desc");
  const [groupBy, setGroupBy] = useState<ListUnknownItemsParams["group_by"] | "">("");
  const [status, setStatus] = useState<Status>("pending");
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [notice, setNotice] = useState<MessageKey | null>(null);
  const [bulkSummary, setBulkSummary] = useState<BulkSummary | null>(null);

  // Compose the 007 list params. `status` defaults to `pending` per the
  // contract; an active store narrows the queue (RLS still applies server-side).
  const params: ListUnknownItemsParams = {
    status,
    sort,
    ...(activeStoreId ? { store_id: activeStoreId } : {}),
    ...(sourceSystem ? { source_system: sourceSystem } : {}),
    ...(groupBy ? { group_by: groupBy } : {}),
  };

  const { result, isLoading, refetch } = useUnknownItemList(activeTenantId, params);
  const rows = useMemo(() => (result?.kind === "page" ? result.items : []), [result]);
  const rowKeys = useMemo(() => rows.map((r) => r.id), [rows]);
  const error = result?.kind === "error" ? result.render : undefined;

  // The selection is tied to the scope it was made under (tenant, store,
  // filters AND sort): a change to any of them empties it, and only rows still
  // listed count.
  const scopeKey = JSON.stringify([activeTenantId, params]);
  const selection = useRowSelection(scopeKey, rowKeys);
  const selectedIds = rows.filter((r) => selection.selectedKeys.has(r.id)).map((r) => r.id);
  const selectable = status === "pending" && !error && rows.length > 0;
  const overLimit = selectedIds.length > BULK_DISMISS_MAX;
  const bulk = useUnknownItemBulkDismiss(activeTenantId);
  const bulkError = bulk.data && !bulk.data.ok ? bulk.data.render : undefined;

  // The confirm step belongs to the scope it was opened in and to the exact
  // selection it counted: it is keyed by both, so a scope change, a refresh
  // that drops a row, or a toggle closes it without any explicit reset.
  const confirmKey = JSON.stringify([scopeKey, selectedIds]);
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
  const confirmingBulk = confirmedKey === confirmKey;

  function setSelected(next: ReadonlySet<string>): void {
    setConfirmedKey(null);
    selection.setSelectedKeys(next);
  }

  function onBulkConfirm(): void {
    const ids = selectedIds;
    setNotice(null);
    setBulkSummary(null);
    bulk.mutate(ids, {
      onSuccess: (res) => {
        if (!res.ok) return; // the error renders above the bar; the selection stays
        setBulkSummary(summarize(res.value));
        setSelected(new Set());
      },
    });
  }

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("unknownItems.title")}</h1>
          <p className="content__sub">{t("unknownItems.sub")}</p>
        </div>
      </header>

      <fieldset className="unknown-item-controls">
        <legend className="unknown-item-controls__legend">
          <Icon name="search" size="sm" className="unknown-item-controls__icon" />
          {t("unknownItems.filters.legend")}
        </legend>
        <label className="unknown-item-controls__field">
          <span>{t("unknownItems.filters.status")}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="pending">{t("unknownItems.status.pending")}</option>
            <option value="dismissed">{t("unknownItems.status.dismissed")}</option>
            <option value="resolved">{t("unknownItems.status.resolved")}</option>
          </select>
        </label>
        <label className="unknown-item-controls__field">
          <span>{t("unknownItems.filters.source")}</span>
          <input
            type="text"
            value={sourceSystem}
            onChange={(e) => setSourceSystem(e.target.value)}
            placeholder={t("unknownItems.filters.sourcePlaceholder")}
          />
        </label>
        <label className="unknown-item-controls__field">
          <span>{t("unknownItems.filters.sort")}</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as NonNullable<ListUnknownItemsParams["sort"]>)}
          >
            <option value="age_desc">{t("unknownItems.sort.newest")}</option>
            <option value="age_asc">{t("unknownItems.sort.oldest")}</option>
            <option value="store">{t("unknownItems.sort.store")}</option>
          </select>
        </label>
        <label className="unknown-item-controls__field">
          <span>{t("unknownItems.filters.groupBy")}</span>
          <select
            value={groupBy}
            onChange={(e) =>
              setGroupBy(e.target.value as NonNullable<ListUnknownItemsParams["group_by"]> | "")
            }
          >
            <option value="">{t("unknownItems.group.none")}</option>
            <option value="store">{t("unknownItems.group.store")}</option>
            <option value="source_system">{t("unknownItems.group.source")}</option>
          </select>
        </label>
      </fieldset>

      {error ? <UnknownItemListError error={error} onRetry={refetch} /> : null}
      {notice ? <Banner variant="success" message={t(notice)} /> : null}
      {bulkSummary && bulkSummary.dismissed > 0 ? (
        <Banner
          variant="success"
          message={t("unknownItems.bulk.result.dismissed", { count: bulkSummary.dismissed })}
        />
      ) : null}
      {bulkSummary && bulkSummary.alreadyReconciled > 0 ? (
        <Banner
          variant="warning"
          message={t("unknownItems.bulk.result.alreadyReconciled", {
            count: bulkSummary.alreadyReconciled,
          })}
        />
      ) : null}
      {bulkSummary && bulkSummary.notFound > 0 ? (
        <Banner
          variant="info"
          message={t("unknownItems.bulk.result.notFound", { count: bulkSummary.notFound })}
        />
      ) : null}
      {bulkError ? <UnknownItemErrorBanner error={bulkError} /> : null}
      {bulk.isError ? <Banner variant="danger" message={t("errors.server")} /> : null}

      {isLoading ? <ListState state="loading" label={t("unknownItems.loadingNoun")} /> : null}

      {!isLoading && !error && rows.length === 0 ? (
        <ListState
          state="empty"
          emptyMessage={t(status === "pending" ? "unknownItems.empty" : "unknownItems.emptyStatus")}
        />
      ) : null}

      {!isLoading && selectable ? (
        <section className="unknown-item-bulk" aria-label={t("unknownItems.bulk.action")}>
          <SelectionSummary
            selectedCount={selectedIds.length}
            mode={selection.mode}
            onClear={() => setSelected(new Set())}
          />
          {!confirmingBulk ? (
            <button
              type="button"
              className="btn-danger-quiet"
              disabled={selectedIds.length === 0 || overLimit || bulk.isPending}
              onClick={() => setConfirmedKey(confirmKey)}
            >
              {t("unknownItems.bulk.action")}
            </button>
          ) : null}
          {overLimit ? (
            <Banner
              variant="warning"
              message={t("unknownItems.bulk.overLimit", { max: BULK_DISMISS_MAX })}
            />
          ) : null}
          {confirmingBulk && selectedIds.length > 0 && !overLimit ? (
            <ConfirmDelete
              resourceName={t("unknownItems.bulk.resource", { count: selectedIds.length })}
              confirmLabel={t("unknownItems.bulk.action")}
              pending={bulk.isPending}
              onConfirm={onBulkConfirm}
              onCancel={() => setConfirmedKey(null)}
            />
          ) : null}
        </section>
      ) : null}

      {!isLoading && !error && rows.length > 0 ? (
        <DataTable
          caption={t("unknownItems.caption")}
          columns={columns(t)}
          rows={rows}
          rowKey={(r) => r.id}
          onRowActivate={(r) => setInspectId(r.id)}
          selection={
            selectable
              ? {
                  selectedKeys: selection.selectedKeys,
                  onSelectionChange: setSelected,
                  rowLabel: (r) => r.identifier_value,
                }
              : undefined
          }
        />
      ) : null}

      {inspectId ? (
        <UnknownItemInspectDrawer
          id={inspectId}
          activeTenantId={activeTenantId}
          onClose={() => setInspectId(null)}
          onCompleted={(next) => {
            setInspectId(null);
            setBulkSummary(null);
            setNotice(next);
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}
