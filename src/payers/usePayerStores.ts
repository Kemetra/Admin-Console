/**
 * The stores a payer can be scoped to in the create form and named in the list:
 * the caller's own roster (`GET /stores`, narrowed by their membership grant —
 * the scope menu's rule, RT-354). Not requested at all when the caller may not
 * read payers. A roster that fails to load reads as empty, so only the
 * tenant-wide scope is offered: create still works, and nothing is invented.
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { type ScopeMembership, scopeMenuStores } from "@/shell/scope-stores";
import { useStoreList } from "@/stores/useStoreQueries";

export interface PayerStore {
  id: string;
  name?: string;
}

export function usePayerStores(tenantId: string | null, enabled: boolean): PayerStore[] {
  const { context } = useActiveContextValue();
  const { result } = useStoreList(enabled ? tenantId : null);
  const rows = result?.kind === "rows" && Array.isArray(result.rows) ? result.rows : [];
  const membership = context?.memberships?.find((m) => m.tenant_id === tenantId) as
    | ScopeMembership
    | undefined;
  return scopeMenuStores(rows, membership, context?.active_store ?? null).map((s) => ({
    id: s.id,
    name: s.name,
  }));
}
