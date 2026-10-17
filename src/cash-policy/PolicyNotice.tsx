/**
 * RT-389 result of the last publish, shown above the forms: a polite success
 * line, or a persistent banner (DESIGN.md rule 4) with the server's request id.
 * A 409 `cash_variance_policy_changed_concurrently` carries a Refresh action:
 * it re-reads the policy and keeps the operator's draft, so retrying needs no
 * retyping.
 */
import { Banner } from "@/components/Banner";
import { type MessageKey, useT } from "@/i18n";
import type { PublishOutcome } from "./policyLogic";

export type Notice =
  | { kind: "saved"; messageKey: MessageKey }
  | { kind: "error"; outcome: Exclude<PublishOutcome, { kind: "saved" | "regenerate-key" }> };

export function PolicyNotice({
  notice,
  onRefresh,
}: Readonly<{ notice: Notice | undefined; onRefresh: () => void }>): React.JSX.Element | null {
  const t = useT();
  if (!notice) return null;
  if (notice.kind === "saved") {
    return <output className="cash-policy__saved">{t(notice.messageKey)}</output>;
  }
  const { outcome } = notice;
  const requestId = "requestId" in outcome ? outcome.requestId : undefined;
  return (
    <Banner
      variant={outcome.kind === "stale" || outcome.kind === "in-progress" ? "warning" : "danger"}
      message={t(outcome.messageKey)}
      requestId={requestId}
      action={
        outcome.kind === "stale" ? (
          <button type="button" className="btn-secondary" onClick={onRefresh}>
            {t("cashPolicy.refresh")}
          </button>
        ) : undefined
      }
    />
  );
}

/** A publish outcome as a notice; `regenerate-key` never reaches the screen (the hook retries it). */
export function noticeFor(outcome: PublishOutcome, savedKey: MessageKey): Notice {
  if (outcome.kind === "saved") return { kind: "saved", messageKey: savedKey };
  if (outcome.kind === "regenerate-key") {
    return { kind: "error", outcome: { kind: "failed", messageKey: "cashPolicy.error.generic" } };
  }
  return { kind: "error", outcome };
}
