/**
 * RT-621 (RT-574 D8): the non-blocking "too many requests" banner. Shown on any
 * 429 from Backend-Core (the shared clock in src/lib/rate-limit.ts), with a
 * countdown, a manual retry once Retry-After has elapsed, and a dismiss. It
 * never blocks the page and never shows a raw error string.
 *
 * Accessibility: an always-mounted polite live region (`<output>`, role status) announces the state
 * once per change ("try again in N seconds", then "you can try again now");
 * the visible countdown ticks every second and is hidden from assistive tech
 * so it is not read out each second.
 */
import { useT } from "@/i18n";
import { useRateLimit } from "@/lib/useRateLimit";
import { QueryClientContext } from "@tanstack/react-query";
import { useContext, useRef, useState } from "react";
import "./banner.css";

export interface RateLimitBannerProps {
  /**
   * False where the banner is the whole page (the protected area with no
   * context yet): dismissing it there would leave a blank page with no retry.
   */
  dismissible?: boolean;
}

export function RateLimitBanner({
  dismissible = true,
}: Readonly<RateLimitBannerProps>): React.JSX.Element {
  const t = useT();
  // Optional: a shell rendered without a query client (tests) still shows the banner.
  const qc = useContext(QueryClientContext);
  const { active, secondsLeft, seq, since } = useRateLimit();
  const [dismissedSeq, setDismissedSeq] = useState(0);
  // The seconds announced for this 429, fixed so the live region speaks once.
  const announced = useRef({ seq: 0, seconds: 0 });
  if (announced.current.seq !== seq) announced.current = { seq, seconds: secondsLeft };

  const visible = seq > 0 && (!dismissible || seq !== dismissedSeq);
  const message = (count: number) =>
    active ? t("rateLimit.wait", { count }) : t("rateLimit.ready");

  const retry = () => {
    setDismissedSeq(seq);
    // Re-read what the 429 left behind: failed reads, and reads that returned
    // their refusal as data during this window. Mutations are never replayed.
    void qc?.refetchQueries({
      type: "active",
      predicate: (q) => q.state.status === "error" || q.state.dataUpdatedAt >= since,
    });
  };

  return (
    <div className="rate-limit-banner">
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {visible ? message(announced.current.seconds) : ""}
      </output>
      {visible ? (
        <RateLimitAlert
          message={message(secondsLeft)}
          waiting={active}
          onRetry={retry}
          onDismiss={dismissible ? () => setDismissedSeq(seq) : undefined}
        />
      ) : null}
    </div>
  );
}

/** The visible part of the banner; the live region above carries the announcement. */
function RateLimitAlert({
  message,
  waiting,
  onRetry,
  onDismiss,
}: Readonly<{
  message: string;
  waiting: boolean;
  onRetry: () => void;
  /** Omitted where the banner must stay (the full-page state). */
  onDismiss?: () => void;
}>): React.JSX.Element {
  const t = useT();
  return (
    <div className="rtc-alert rtc-alert--warning">
      <strong className="rtc-alert__title">{t("rateLimit.title")}</strong>
      <span className="rtc-alert__body" aria-hidden="true">
        {message}
      </span>
      <span className="rtc-alert__action rate-limit-banner__actions">
        <button type="button" className="btn-secondary" disabled={waiting} onClick={onRetry}>
          {t("common.tryAgain")}
        </button>
        {onDismiss ? (
          <button type="button" className="btn-ghost" onClick={onDismiss}>
            {t("rateLimit.dismiss")}
          </button>
        ) : null}
      </span>
    </div>
  );
}

/**
 * The countdown a gated control shows beside its label while a Retry-After
 * runs (the repeat-submit gate). Renders nothing outside a window.
 */
export function RateLimitCountdown(): React.JSX.Element | null {
  const t = useT();
  const { active, secondsLeft } = useRateLimit();
  if (!active) return null;
  return (
    <span className="rate-limit-countdown">{t("rateLimit.gate", { count: secondsLeft })}</span>
  );
}
