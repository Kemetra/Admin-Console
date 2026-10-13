/**
 * Persistent status banner (T011, FR-003-007, VD-4). DESIGN.md rule 4:
 * persistent banners, not toasts. Surfaces the backend `request_id` so an
 * operator can quote it to support (exact and LTR-isolated, RT-399). Never
 * auto-dismisses. `message` is already-translated copy.
 */
import { useT } from "@/i18n";
import "./banner.css";

export type BannerVariant = "danger" | "warning" | "success" | "info";

export interface BannerProps {
  variant: BannerVariant;
  /** Optional one-line headline above `message` (already-translated copy). */
  title?: string;
  message: string;
  /** Backend request_id from a 4xx response (VD-4). Rendered when present. */
  requestId?: string;
  /**
   * Optional inline action (e.g. a Retry button for a retryable 5xx). Rendered
   * at the end of the banner. RF-1 callers omit it; RF-2 list surfaces pass a
   * retry that refetches the query (design-brief §6 "Retry").
   */
  action?: React.ReactNode;
}

export function Banner({
  variant,
  title,
  message,
  requestId,
  action,
}: Readonly<BannerProps>): React.JSX.Element {
  const t = useT();
  return (
    <div className={`rtc-alert rtc-alert--${variant}`} role="alert">
      {title ? <strong className="rtc-alert__title">{title}</strong> : null}
      <span className={title ? "rtc-alert__body" : "rtc-alert__msg"}>{message}</span>
      {requestId ? (
        <span className="rtc-alert__req">
          {t.rich("components.banner.requestRef", { id: <bdi dir="ltr">{requestId}</bdi> })}
        </span>
      ) : null}
      {action ? <span className="rtc-alert__action">{action}</span> : null}
    </div>
  );
}
