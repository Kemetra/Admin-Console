/**
 * RT-178 shared pieces for the two stock discrepancy surfaces: the scope read
 * from RF-1's active context, the no-tenant prompt, and the "Load more" pager.
 */
import { Banner } from "@/components/Banner";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { useT } from "@/i18n";
import type { ScopeKey, StockDiscrepancyError } from "./useStockDiscrepancies";

export interface DiscrepancyScope {
  scope: ScopeKey;
  role: string | null;
}

type ActiveContext = ReturnType<typeof useActiveContextValue>["context"];

function idOf(entity: { id?: string } | null | undefined): string | null {
  return entity?.id ?? null;
}

/** Pure projection of the active context onto the query scope and role. */
export function scopeFromContext(context: ActiveContext): DiscrepancyScope {
  return {
    scope: { tenantId: idOf(context?.active_tenant), activeStoreId: idOf(context?.active_store) },
    role: context?.active_role_code ?? null,
  };
}

/** Active tenant + store (the query scope) and the active role, from context. */
export function useDiscrepancyScope(): DiscrepancyScope {
  return scopeFromContext(useActiveContextValue().context);
}

export function TenantScopePrompt(): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      <p className="content__sub">{t("stock.tenantPrompt")}</p>
    </div>
  );
}

export interface LoadMoreProps {
  hasMore: boolean;
  isFetching: boolean;
  /** The translated button label ("Load more items" / "Load more stores"). */
  label: string;
  onLoadMore: () => void;
}

export function LoadMoreButton({
  hasMore,
  isFetching,
  label,
  onLoadMore,
}: Readonly<LoadMoreProps>): React.JSX.Element | null {
  const t = useT();
  if (!hasMore) return null;
  return (
    <div>
      <button type="button" className="btn-secondary" onClick={onLoadMore} disabled={isFetching}>
        {isFetching ? t("common.loading") : label}
      </button>
    </div>
  );
}

export interface InlineErrorProps {
  error: StockDiscrepancyError | undefined;
  onRetry: () => void;
}

/** A failed "Load more" or re-read, under rows that stay on screen. */
export function InlineLoadError({
  error,
  onRetry,
}: Readonly<InlineErrorProps>): React.JSX.Element | null {
  const t = useT();
  if (!error) return null;
  return (
    <Banner
      variant="danger"
      message={t("stock.inlineError")}
      requestId={error.requestId}
      action={
        <button type="button" className="btn-secondary" onClick={onRetry}>
          {t("stock.retry")}
        </button>
      }
    />
  );
}
