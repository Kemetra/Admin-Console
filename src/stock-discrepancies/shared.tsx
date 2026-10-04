import { useActiveContextValue } from "@/context/ActiveContextProvider";
/**
 * RT-178 shared pieces for the two stock discrepancy surfaces: the scope read
 * from RF-1's active context, the no-tenant prompt, and the "Load more" pager.
 */
import type { ScopeKey } from "./useStockDiscrepancies";

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
  return (
    <div className="surface">
      <p className="content__sub">Select a tenant to view ERPNext stock discrepancies.</p>
    </div>
  );
}

export interface LoadMoreProps {
  hasMore: boolean;
  isFetching: boolean;
  label: string;
  onLoadMore: () => void;
}

export function LoadMoreButton({
  hasMore,
  isFetching,
  label,
  onLoadMore,
}: LoadMoreProps): React.JSX.Element | null {
  if (!hasMore) return null;
  return (
    <div>
      <button type="button" className="btn-secondary" onClick={onLoadMore} disabled={isFetching}>
        {isFetching ? "Loading…" : label}
      </button>
    </div>
  );
}
