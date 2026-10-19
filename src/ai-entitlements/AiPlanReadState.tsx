/**
 * RT-665 the non-ready states of the AI plan read.
 *
 * The runtime (RT-664) is not built yet, so on a real backend the read answers a
 * missing route (404, 501) or `entitlement_unavailable` (503); the contract's
 * non-disclosing 404 is indistinguishable from the first. All three are one
 * neutral line ("not available yet"): no banner, no code, no request id. An
 * expired session and a retryable failure use the console's banner; the failure
 * quotes only the request id, never the server's message.
 */
import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { useT } from "@/i18n";
import type { AiPlanView } from "./aiAccess";
import type { AiPlanResult } from "./useAiPlan";

/** A missing route, a not-yet-served route and a store that cannot be read. */
const NOT_YET_STATUSES: readonly number[] = [404, 501, 503];

export function AiPlanReadState({
  view,
  isLoading,
  result,
  onRetry,
}: Readonly<{
  view: AiPlanView;
  isLoading: boolean;
  result: AiPlanResult | undefined;
  onRetry: () => void;
}>): React.JSX.Element | null {
  const t = useT();
  if (isLoading || !result) {
    return <ListState state="loading" label={t("aiPlan.loadingNoun")} />;
  }
  if (result.kind === "ok") return null;
  if (NOT_YET_STATUSES.includes(result.status)) {
    return <p className="field__hint">{t(`aiPlan.notYet.${view}`)}</p>;
  }
  return (
    <Banner
      variant="danger"
      message={t(result.status === 401 ? "aiPlan.sessionExpired" : "aiPlan.loadFailed")}
      requestId={result.requestId}
      action={
        <button type="button" className="btn-secondary" onClick={onRetry}>
          {t("aiPlan.retry")}
        </button>
      }
    />
  );
}
