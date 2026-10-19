/**
 * RT-728 shared pieces for the inventory read views: machine data and
 * exact-decimal quantities (LTR-isolated, rendered verbatim), the Unknown
 * marker, the read error banner (429 with the server's wait), the stale
 * (inline) error and the gated Load more. Every user-initiated read control is
 * a GatedButton, so a running Retry-After cannot be hammered (RT-621).
 */
import { BackArrow } from "@/components/BackArrow";
import { Banner } from "@/components/Banner";
import { GatedButton } from "@/components/GatedButton";
import { type MessageKey, type T, useT } from "@/i18n";
import { Link } from "react-router";
import type { InventoryError } from "./useInventory";

/** Machine data (references, codes, ids): monospace and LTR-isolated. */
export function Machine({ value }: Readonly<{ value: string }>): React.JSX.Element {
  return (
    <bdi dir="ltr" className="inventory__machine">
      {value}
    </bdi>
  );
}

/**
 * An exact-decimal quantity string from the API, rendered as sent (sign
 * included, never parsed or float-formatted), LTR-isolated so the minus sign
 * stays in front in an RTL table.
 */
export function Quantity({ value }: Readonly<{ value: string }>): React.JSX.Element {
  return (
    <bdi dir="ltr" className="inventory__qty">
      {value}
    </bdi>
  );
}

/** A value the API did not send, or could not be read: Unknown, never zero. */
export function Unknown(): React.JSX.Element {
  const t = useT();
  return <span className="inventory__unknown">{t("inventory.value.unknown")}</span>;
}

export function BackLink({ to, label }: Readonly<{ to: string; label: string }>) {
  return (
    <Link to={to} className="surface__back">
      <BackArrow /> {label}
    </Link>
  );
}

function RetryButton({ onRetry }: Readonly<{ onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  return (
    <GatedButton type="button" className="btn-secondary" onClick={onRetry}>
      {t("inventory.retry")}
    </GatedButton>
  );
}

/** The copy for a rate-limited read: with the server's wait when it sent one. */
function rateLimitedMessage(t: T, error: InventoryError): string {
  return error.retryAfter
    ? t("inventory.error.rateLimitedFor", { count: error.retryAfter })
    : t("inventory.error.rateLimited");
}

const PLAIN_KEYS: Partial<Record<InventoryError["kind"], MessageKey>> = {
  session: "inventory.error.session",
  forbidden: "inventory.error.forbidden",
  rejected: "inventory.error.rejected",
};

/** A read that failed with nothing on screen. */
export function ReadError({
  error,
  failedKey,
  notFoundKey,
  onRetry,
}: Readonly<{
  error: InventoryError;
  failedKey: MessageKey;
  notFoundKey: MessageKey;
  onRetry: () => void;
}>): React.JSX.Element {
  const t = useT();
  const { requestId, kind } = error;
  if (kind === "not-found") {
    return <Banner variant="warning" message={t(notFoundKey)} requestId={requestId} />;
  }
  if (kind === "rate-limited") {
    return (
      <Banner
        variant="warning"
        message={rateLimitedMessage(t, error)}
        requestId={requestId}
        action={<RetryButton onRetry={onRetry} />}
      />
    );
  }
  const plain = PLAIN_KEYS[kind];
  if (plain) return <Banner variant="danger" message={t(plain)} requestId={requestId} />;
  return (
    <Banner
      variant="danger"
      message={t(failedKey)}
      requestId={requestId}
      action={<RetryButton onRetry={onRetry} />}
    />
  );
}

/** A re-read or a later page failed: the rows already shown stay, and this says so. */
export function StaleError({
  error,
  onRetry,
}: Readonly<{ error: InventoryError | undefined; onRetry: () => void }>): React.JSX.Element | null {
  const t = useT();
  if (!error) return null;
  const message =
    error.kind === "rate-limited" ? rateLimitedMessage(t, error) : t("inventory.inlineError");
  return (
    <Banner
      variant="warning"
      message={message}
      requestId={error.requestId}
      action={<RetryButton onRetry={onRetry} />}
    />
  );
}

export function LoadMore({
  hasMore,
  isFetching,
  label,
  onLoadMore,
}: Readonly<{
  hasMore: boolean;
  isFetching: boolean;
  label: string;
  onLoadMore: () => void;
}>): React.JSX.Element | null {
  const t = useT();
  if (!hasMore) return null;
  return (
    <div>
      <GatedButton
        type="button"
        className="btn-secondary"
        onClick={onLoadMore}
        disabled={isFetching}
      >
        {isFetching ? t("common.loading") : label}
      </GatedButton>
    </div>
  );
}
