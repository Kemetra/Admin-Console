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

interface PagedPage<T> {
  items: T[];
  nextCursor: string | null;
}

interface ApiResult<P> {
  status: number;
  data?: P;
  error?: unknown;
}

/** Unwrap one wrapper result: a page, or the typed not-found/generic error. */
function pageOrThrow<P>(res: ApiResult<P>): P {
  if (res.status >= 400 || !res.data) throw toError(res.status, res.error);
  return res.data;
}

/** getNextPageParam: a null cursor stops paging (undefined in TanStack v5). */
function nextCursorOf(last: PagedPage<unknown>): string | undefined {
  return last.nextCursor ?? undefined;
}

function flattenItems<T>(pages: readonly PagedPage<T>[]): T[] {
  return pages.flatMap((p) => p.items);
}

interface InfiniteLike {
  isLoading: boolean;
  error: unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
}

export interface PagerState {
  isLoading: boolean;
  error?: StockDiscrepancyError;
  hasMore: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => void;
}

/** The loading / error / paging view shared by both reads. */
function pagerState(query: InfiniteLike, enabled: boolean): PagerState {
  return {
    isLoading: query.isLoading && enabled,
    error: errorOf(query.error),
    hasMore: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    loadMore: () => loadNextPage(query),
  };
}

function loadNextPage(query: InfiniteLike): void {
  if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
}

function fetchStoresPage({
  pageParam,
}: { pageParam: string | undefined }): Promise<StoreNegativeOnHandSummaryPage> {
  return listErpnextNegativeOnHandStores({ cursor: pageParam }).then(pageOrThrow);
}

export function useNegativeOnHandStores(scope: ScopeKey) {
  const enabled = Boolean(scope.tenantId);
  const query = useInfiniteQuery({
    queryKey: stockDiscrepancyQueryKeys.stores(scope),
    enabled,
    initialPageParam: FIRST_PAGE,
    queryFn: fetchStoresPage,
    getNextPageParam: nextCursorOf,
    retry: false,
  });

  return {
    ...pagerState(query, enabled),
    stores: flattenItems(query.data?.pages ?? []),
    refetch: () => void query.refetch(),
  };
}

/** Both a tenant and a route store id are needed before the store read runs. */
function storeReadEnabled(scope: ScopeKey, storeId: string | undefined): boolean {
  return Boolean(scope.tenantId) && Boolean(storeId);
}

function storePageFetcher(storeId: string | undefined) {
  return ({ pageParam }: { pageParam: string | undefined }): Promise<StoreNegativeOnHandPage> =>
    listErpnextNegativeOnHand(String(storeId), { cursor: pageParam }).then(pageOrThrow);
}

export function useStoreNegativeOnHand(scope: ScopeKey, storeId: string | undefined) {
  const enabled = storeReadEnabled(scope, storeId);
  const query = useInfiniteQuery({
    queryKey: stockDiscrepancyQueryKeys.store(scope, storeId),
    enabled,
    initialPageParam: FIRST_PAGE,
    queryFn: storePageFetcher(storeId),
    getNextPageParam: nextCursorOf,
    retry: false,
  });

  const pages = query.data?.pages ?? [];
  return {
    ...pagerState(query, enabled),
    // The snapshot block is per store; the first page's block is the one the
    // operator saw first, so later pages do not silently swap the "as of" time.
    snapshot: pages[0]?.snapshot,
    items: flattenItems(pages),
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
