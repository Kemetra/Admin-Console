/**
 * RT-560 shared pieces for the ERP status panels: the status pill (a dot plus
 * a text label, so colour is never the only cue; a hollow dot marks "no
 * signal" style states), the panel frame, the as-of line, the panel error and
 * the stale (inline) error, and the Load more pager.
 */
import { Banner } from "@/components/Banner";
import { DateTime, useT } from "@/i18n";
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
