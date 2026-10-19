/**
 * RT-726 shared pieces for the sale sync-ops surfaces: the sync status badge
 * (text carries the meaning, colour only reinforces it), the read error banner
 * and the stale (inline) error. Machine data is LTR-isolated monospace.
 */
import { Banner } from "@/components/Banner";
import { type MessageKey, type T, useT } from "@/i18n";
import { syncStatusView } from "./saleSyncLogic";
import type { SyncError } from "./useSaleSync";

export function SyncStatusBadge({ code }: Readonly<{ code: string }>): React.JSX.Element {
  const t = useT();
  const view = syncStatusView(code);
  return <span className={view.badge ? `badge ${view.badge}` : "badge"}>{t(view.labelKey)}</span>;
}

/** Machine data (references, codes, ids): monospace and LTR-isolated. */
export function Machine({ value }: Readonly<{ value: string }>): React.JSX.Element {
  return (
    <bdi dir="ltr" className="sale-sync__machine">
      {value}
    </bdi>
  );
}

function RetryButton({ onRetry }: Readonly<{ onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  return (
    <button type="button" className="btn-secondary" onClick={onRetry}>
      {t("saleSync.retry")}
    </button>
  );
}

/** The copy for a rate-limited read: with the server's wait when it sent one. */
function rateLimitedMessage(t: T, error: SyncError): string {
  return error.retryAfter
    ? t("saleSync.error.rateLimitedFor", { count: error.retryAfter })
    : t("saleSync.error.rateLimited");
}

/** A read that failed with nothing on screen. */
export function ReadError({
  error,
  failedKey,
  notFoundKey,
  onRetry,
}: Readonly<{
  error: SyncError;
  failedKey: MessageKey;
  notFoundKey: MessageKey;
  onRetry: () => void;
}>): React.JSX.Element {
  const t = useT();
  const { requestId } = error;
  switch (error.kind) {
    case "session":
      return (
        <Banner variant="danger" message={t("saleSync.error.session")} requestId={requestId} />
      );
    case "forbidden":
      return (
        <Banner variant="danger" message={t("saleSync.error.forbidden")} requestId={requestId} />
      );
    case "not-found":
      return <Banner variant="warning" message={t(notFoundKey)} requestId={requestId} />;
    case "rejected":
      return (
        <Banner variant="warning" message={t("saleSync.error.rejected")} requestId={requestId} />
      );
    case "rate-limited":
      return (
        <Banner
          variant="warning"
          message={rateLimitedMessage(t, error)}
          requestId={requestId}
          action={<RetryButton onRetry={onRetry} />}
        />
      );
    default:
      return (
        <Banner
          variant="danger"
          message={t(failedKey)}
          requestId={requestId}
          action={<RetryButton onRetry={onRetry} />}
        />
      );
  }
}

/** A re-read failed: the earlier answer stays and this says so. */
export function StaleError({
  error,
  onRetry,
}: Readonly<{ error: SyncError | undefined; onRetry: () => void }>): React.JSX.Element | null {
  const t = useT();
  if (!error) return null;
  return (
    <Banner
      variant="warning"
      message={t("saleSync.inlineError")}
      requestId={error.requestId}
      action={<RetryButton onRetry={onRetry} />}
    />
  );
}
