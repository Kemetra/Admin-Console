/**
 * RT-389 the non-ready states of a policy read, shared by both sections: a
 * loading line, the non-disclosing 404 ("not available to you", one body for
 * every cause), an expired session, and a retryable failure that quotes the
 * request id.
 */
import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { useT } from "@/i18n";
import type { ReadResult } from "./useCashPolicy";

export function PolicyReadState({
  isLoading,
  result,
  onRetry,
}: Readonly<{
  isLoading: boolean;
  result: ReadResult<unknown> | undefined;
  onRetry: () => void;
}>): React.JSX.Element | null {
  const t = useT();
  if (isLoading || !result) {
    return <ListState state="loading" label={t("cashPolicy.loadingNoun")} />;
  }
  if (result.kind === "ok") return null;
  if (result.status === 404) {
    return <p className="field__hint">{t("cashPolicy.unavailable")}</p>;
  }
  return (
    <Banner
      variant="danger"
      message={t(result.status === 401 ? "cashPolicy.sessionExpired" : "cashPolicy.loadFailed")}
      requestId={result.requestId}
      action={
        <button type="button" className="btn-secondary" onClick={onRetry}>
          {t("cashPolicy.retry")}
        </button>
      }
    />
  );
}
