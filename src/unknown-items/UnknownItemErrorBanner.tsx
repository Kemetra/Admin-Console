import { Banner, type BannerVariant } from "@/components/Banner";
import { useT } from "@/i18n";
import { BULK_DISMISS_MAX, type UnknownItemErrorRender } from "@/lib/unknown-items-queries";
/**
 * RT-724 — one persistent banner for a failed review-queue write. The variant
 * follows what happened: a refusal or failure is danger, a state the operator
 * can wait out or refresh past (already resolved, still processing) is a
 * warning, and the non-disclosing not-found is info. Copy comes from the
 * mapped catalog key only, so a conflicting product is never named.
 */

const VARIANT: Record<UnknownItemErrorRender["kind"], BannerVariant> = {
  banner: "danger",
  generic: "danger",
  validation: "danger",
  "alias-conflict": "danger",
  "target-unavailable": "danger",
  "key-conflict": "danger",
  "already-reconciled": "warning",
  "in-progress": "warning",
  "not-found": "info",
};

export function UnknownItemErrorBanner({
  error,
}: Readonly<{ error: UnknownItemErrorRender }>): React.JSX.Element {
  const t = useT();
  return (
    <Banner
      variant={VARIANT[error.kind]}
      message={t(error.messageKey, { max: BULK_DISMISS_MAX })}
      requestId={"requestId" in error ? error.requestId : undefined}
    />
  );
}
