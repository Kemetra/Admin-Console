/**
 * RT-560 shared pieces for the ERP status panels: the status pill (a dot plus
 * a text label, so colour is never the only cue; a hollow dot marks "no
 * signal" style states), the panel frame, the as-of line, the panel error and
 * the stale (inline) error, the Load more pager, and the cursor-paged table
 * shared by the posting backlog and the run history.
 */
import { Banner } from "@/components/Banner";
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { ListState as ListStateView } from "@/components/ListState";
import { DateTime, useT } from "@/i18n";
import { Fragment } from "react";
import type { StatusView } from "./erpStatusLogic";
import type { ErpError, ListState, PanelState } from "./useErpStatus";

export function StatusPill({ view }: Readonly<{ view: StatusView }>): React.JSX.Element {
  const t = useT();
  return (
    <span className={`badge erp-pill erp-pill--${view.tone}`}>
      <span className={view.hollow ? "erp-dot erp-dot--hollow" : "erp-dot"} aria-hidden="true" />
      {t(view.labelKey)}
    </span>
  );
}

export function Panel({
  id,
  title,
  children,
}: Readonly<{ id: string; title: string; children: React.ReactNode }>): React.JSX.Element {
  return (
    <section className="erp-panel" aria-labelledby={id}>
      <h2 className="erp-panel__title" id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** "Last read: …" for the data on screen (A-5 / A-8). */
export function AsOf({ at }: Readonly<{ at: number | undefined }>): React.JSX.Element | null {
  const t = useT();
  if (at === undefined || at === 0) return null;
  return (
    <p className="erp-asof">
      {t.rich("erp.asOf", { time: <DateTime value={new Date(at).toISOString()} /> })}
    </p>
  );
}

function RetryButton({ onRetry }: Readonly<{ onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  return (
    <button type="button" className="btn-secondary" onClick={onRetry}>
      {t("erp.retry")}
    </button>
  );
}

/** A failure with nothing loaded, with the request id and (when useful) a retry. */
export function PanelError({
  error,
  failedMessage,
  onRetry,
}: Readonly<{ error: ErpError; failedMessage: string; onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  const retry = <RetryButton onRetry={onRetry} />;
  switch (error.kind) {
    case "session":
      return (
        <Banner variant="danger" message={t("erp.error.session")} requestId={error.requestId} />
      );
    case "forbidden":
      return (
        <Banner variant="danger" message={t("erp.error.forbidden")} requestId={error.requestId} />
      );
    case "not-found":
      return (
        <Banner variant="warning" message={t("erp.error.notFound")} requestId={error.requestId} />
      );
    case "rejected":
      return (
        <Banner
          variant="warning"
          message={t("erp.error.rejected")}
          requestId={error.requestId}
          action={retry}
        />
      );
    default:
      return (
        <Banner
          variant="danger"
          message={failedMessage}
          requestId={error.requestId}
          action={retry}
        />
      );
  }
}

/** Stale: a re-read failed; the earlier data stays and this says so (A-8). */
export function StaleError({ panel }: Readonly<{ panel: PanelState }>): React.JSX.Element | null {
  const t = useT();
  if (!panel.inlineError) return null;
  return (
    <Banner
      variant="warning"
      message={t("erp.inlineError")}
      requestId={panel.inlineError.requestId}
      action={<RetryButton onRetry={panel.retry} />}
    />
  );
}

export function LoadMore<T>({ list }: Readonly<{ list: ListState<T> }>): React.JSX.Element | null {
  const t = useT();
  if (!list.hasMore) return null;
  return (
    <div>
      <button
        type="button"
        className="btn-secondary"
        onClick={list.loadMore}
        disabled={list.isFetchingNextPage}
      >
        {list.isFetchingNextPage ? <span className="spinner" aria-hidden="true" /> : null}
        {t("erp.loadMore")}
      </button>
    </div>
  );
}

export interface CursorTableProps<T> {
  list: ListState<T>;
  caption: string;
  columns: { key: string; header: string }[];
  loadingNoun: string;
  failedMessage: string;
  emptyMessage: string;
  rowKey: (row: T) => string;
  renderRow: (row: T) => React.ReactNode;
}

/** A cursor-paged read-only table: skeleton, error, empty, or rows with Load more. */
export function CursorTable<T>({
  list,
  caption,
  columns,
  loadingNoun,
  failedMessage,
  emptyMessage,
  rowKey,
  renderRow,
}: Readonly<CursorTableProps<T>>): React.JSX.Element {
  if (list.isLoading) {
    return <DataTableSkeleton caption={caption} columns={columns} label={loadingNoun} />;
  }
  if (list.error) {
    return <PanelError error={list.error} failedMessage={failedMessage} onRetry={list.retry} />;
  }
  if (list.rows.length === 0) return <ListStateView state="empty" emptyMessage={emptyMessage} />;
  return (
    <>
      <div className="table-scroll">
        <table className="data-table">
          <caption className="data-table__caption">{caption}</caption>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} scope="col">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.rows.map((row) => (
              <Fragment key={rowKey(row)}>{renderRow(row)}</Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <LoadMore list={list} />
    </>
  );
}
