/**
 * RT-178 query hooks. Read-only infinite queries over the two RT-177 ops, plus
 * the refresh mutation over `triggerReconciliationRun`. Scope-keyed by the
 * active tenant AND active store: a store_manager's readable stores follow the
 * active store server-side, so a store switch must not reuse a cached page.
 * A 404 is the API's non-disclosing refusal and renders as not-found.
 */
import {
  type StoreNegativeOnHandPage,
  type StoreNegativeOnHandSummaryPage,
  listErpnextNegativeOnHand,
  listErpnextNegativeOnHandStores,
  triggerReconciliationRun,
} from "@/lib/stock-discrepancy-queries";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type TriggerOutcome,
  classifyTriggerOutcome,
  newSnapshotRequestKey,
  requestIdOf,
} from "./stockDiscrepancyLogic";

export type StockDiscrepancyError = { kind: "not-found" | "generic"; requestId?: string };

export interface ScopeKey {
  tenantId: string | null;
  activeStoreId: string | null;
}

export const stockDiscrepancyQueryKeys = {
  all: ["stock-discrepancies"] as const,
  stores: (scope: ScopeKey) =>
    ["stock-discrepancies", "stores", scope.tenantId, scope.activeStoreId] as const,
  store: (scope: ScopeKey, storeId: string | undefined) =>
    ["stock-discrepancies", "store", scope.tenantId, scope.activeStoreId, storeId] as const,
};

class StockDiscrepancyFetchError extends Error {
  constructor(readonly detail: StockDiscrepancyError) {
    super("stock-discrepancies");
  }
}

function toError(status: number, error: unknown): StockDiscrepancyFetchError {
  const requestId = requestIdOf(error);
  return new StockDiscrepancyFetchError(
    status === 404 ? { kind: "not-found", requestId } : { kind: "generic", requestId },
  );
}

function errorOf(error: unknown): StockDiscrepancyError | undefined {
  if (!error) return undefined;
  return error instanceof StockDiscrepancyFetchError ? error.detail : { kind: "generic" };
}

const FIRST_PAGE: string | undefined = undefined;

export function useNegativeOnHandStores(scope: ScopeKey) {
  const query = useInfiniteQuery({
    queryKey: stockDiscrepancyQueryKeys.stores(scope),
    enabled: Boolean(scope.tenantId),
    initialPageParam: FIRST_PAGE,
    queryFn: async ({ pageParam }): Promise<StoreNegativeOnHandSummaryPage> => {
      const res = await listErpnextNegativeOnHandStores({ cursor: pageParam });
      if (res.status >= 400 || !res.data) throw toError(res.status, res.error);
      return res.data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: false,
  });

  return {
    stores: (query.data?.pages ?? []).flatMap((p) => p.items),
    isLoading: query.isLoading && Boolean(scope.tenantId),
    error: errorOf(query.error),
    hasMore: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    refetch: () => void query.refetch(),
  };
}

export function useStoreNegativeOnHand(scope: ScopeKey, storeId: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: stockDiscrepancyQueryKeys.store(scope, storeId),
    enabled: Boolean(scope.tenantId && storeId),
    initialPageParam: FIRST_PAGE,
    queryFn: async ({ pageParam }): Promise<StoreNegativeOnHandPage> => {
      const res = await listErpnextNegativeOnHand(storeId ?? "", { cursor: pageParam });
      if (res.status >= 400 || !res.data) throw toError(res.status, res.error);
      return res.data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: false,
  });

  const pages = query.data?.pages ?? [];
  return {
    // The snapshot block is per store; the first page's block is the one the
    // operator saw first, so later pages do not silently swap the "as of" time.
    snapshot: pages[0]?.snapshot,
    items: pages.flatMap((p) => p.items),
    isLoading: query.isLoading && Boolean(scope.tenantId && storeId),
    error: errorOf(query.error),
    hasMore: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
  };
}

/**
 * "Request fresh snapshot". Each click is a new logical request, so each gets a
 * new Idempotency-Key. On success the store's queries are invalidated so the
 * API's `pendingRequest` shows up.
 */
export function useRequestSnapshot(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<TriggerOutcome> => {
      const res = await triggerReconciliationRun(storeId ?? "", newSnapshotRequestKey());
      return classifyTriggerOutcome(res);
    },
    onSuccess: (outcome) => {
      if (outcome.kind === "requested") {
        void qc.invalidateQueries({ queryKey: stockDiscrepancyQueryKeys.all });
      }
    },
  });
}
