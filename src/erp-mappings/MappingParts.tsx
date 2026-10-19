/**
 * RT-725 shared pieces for the mapping panels: the failure banner (every
 * contract refusal has its own words and keeps the request id) and the inline
 * confirm step every mutation passes through (DESIGN.md: an inline confirm, not
 * a reflexive modal). The confirm names exactly what will change; its primary
 * is disabled while the change is in flight, so one click sends one request,
 * and while a Retry-After runs (RT-621's shared gate).
 */
import { Banner, type BannerVariant } from "@/components/Banner";
import { GatedButton } from "@/components/GatedButton";
import { useT } from "@/i18n";
import { type MappingFailure, type MappingOp, failureKey } from "./mappingLogic";

const VARIANTS: Record<MappingFailure["kind"], BannerVariant> = {
  validation: "warning",
  session: "danger",
  unavailable: "info",
  origin: "danger",
  "not-found": "warning",
  conflict: "warning",
  "rate-limited": "warning",
  unknown: "warning",
  failed: "danger",
};

export function FailureBanner({
  op,
  failure,
  action,
}: Readonly<{
  op: MappingOp;
  failure: MappingFailure;
  action?: React.ReactNode;
}>): React.JSX.Element {
  const t = useT();
  const seconds = failure.kind === "rate-limited" ? failure.retryAfter : undefined;
  const message =
    seconds === undefined ? t(failureKey(op, failure)) : t(failureKey(op, failure), { seconds });
  return (
    <Banner
      variant={VARIANTS[failure.kind]}
      title={failure.kind === "unknown" ? t("erp.map.error.unknownTitle") : undefined}
      message={message}
      requestId={"requestId" in failure ? failure.requestId : undefined}
      action={action}
    />
  );
}

export interface InlineConfirmProps {
  label: string;
  prompt: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  op: MappingOp;
  pending: boolean;
  failure?: MappingFailure;
  onConfirm: () => void;
  onCancel: () => void;
}

/** The explicit second step of every change. A failure stays here; nothing is re-sent. */
export function InlineConfirm({
  label,
  prompt,
  confirmLabel,
  destructive = false,
  op,
  pending,
  failure,
  onConfirm,
  onCancel,
}: Readonly<InlineConfirmProps>): React.JSX.Element {
  const t = useT();
  return (
    <section className="map-confirm" aria-label={label}>
      {failure ? <FailureBanner op={op} failure={failure} /> : null}
      <p className="map-confirm__msg">{prompt}</p>
      <div className="map-confirm__actions">
        <GatedButton
          className={destructive ? "btn-destructive" : "btn-primary"}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {confirmLabel}
        </GatedButton>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </button>
      </div>
    </section>
  );
}

/** Re-read a list. Gated by a running Retry-After (RT-621), like every read control. */
export function RetryButton({ onRetry }: Readonly<{ onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  return (
    <GatedButton className="btn-secondary" onClick={onRetry}>
      {t("erp.retry")}
    </GatedButton>
  );
}

/** An opaque id or reference, shown exactly and isolated left-to-right. */
export function Ref({ value }: Readonly<{ value: string }>): React.JSX.Element {
  return (
    <bdi className="map-ref" dir="ltr">
      {value}
    </bdi>
  );
}
