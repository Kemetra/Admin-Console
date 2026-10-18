import { Banner } from "@/components/Banner";
import { DataTable } from "@/components/DataTable";
import { ListState } from "@/components/ListState";
import { Icon } from "@/components/icons/Icon";
import { DateTime, type T, useT } from "@/i18n";
import {
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
 */
import { useState } from "react";
import { UnknownItemInspectDrawer } from "./UnknownItemInspectDrawer";
import { useUnknownItemList } from "./useUnknownItemQueries";
import { useUnknownItemScope } from "./useUnknownItemScope";
import "./unknown-items.css";

/** Identifier type label; an out-of-contract value shows verbatim. */
function identifierTypeLabel(t: T, type: ReviewQueueItem["identifier_type"]): string {
  const key = identifierTypeKey(type);
  return key ? t(key) : type;
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
  const [inspectId, setInspectId] = useState<string | null>(null);

  // Compose the 007 list params. `status` defaults to `pending` per the
  // contract; an active store narrows the queue (RLS still applies server-side).
  const params: ListUnknownItemsParams = {
    status: "pending",
    sort,
    ...(activeStoreId ? { store_id: activeStoreId } : {}),
    ...(sourceSystem ? { source_system: sourceSystem } : {}),
    ...(groupBy ? { group_by: groupBy } : {}),
  };

  const { result, isLoading, refetch } = useUnknownItemList(activeTenantId, params);
  const rows = result?.kind === "page" ? result.items : [];
  const error = result?.kind === "error" ? result.render : undefined;

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

      {isLoading ? <ListState state="loading" label={t("unknownItems.loadingNoun")} /> : null}

      {!isLoading && !error && rows.length === 0 ? (
        <ListState state="empty" emptyMessage={t("unknownItems.empty")} />
      ) : null}

      {!isLoading && !error && rows.length > 0 ? (
        <DataTable
          caption={t("unknownItems.caption")}
          columns={columns(t)}
          rows={rows}
          rowKey={(r) => r.id}
          onRowActivate={(r) => setInspectId(r.id)}
        />
      ) : null}

      {inspectId ? (
        <UnknownItemInspectDrawer
          id={inspectId}
          activeTenantId={activeTenantId}
          onClose={() => setInspectId(null)}
          onDismissed={() => {
            setInspectId(null);
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}
