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
import { useEffect, useState } from "react";
import {
  type TriggerOutcome,
  classifyTriggerOutcome,
  isStoreId,
  pagesShareSnapshot,
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
  isFetchNextPageError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  refetch: () => Promise<unknown>;
}

export interface PagerState {
  isLoading: boolean;
  /** A failure with nothing loaded yet: the surface shows its error view. */
  error?: StockDiscrepancyError;
  /**
   * A failure after rows were loaded (a failed "Load more" or re-read): the
   * loaded rows stay and the pager shows this error with a Retry.
   */
  inlineError?: StockDiscrepancyError;
  /** Retries whatever failed inline: the next page, or the re-read. */
  retryInline: () => void;
  hasMore: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => void;
}

/** The loading / error / paging view shared by both reads. */
function pagerState(query: InfiniteLike, enabled: boolean, hasData: boolean): PagerState {
  const error = errorOf(query.error);
  return {
    isLoading: query.isLoading && enabled,
    error: hasData ? undefined : error,
    inlineError: hasData ? error : undefined,
    retryInline: () => retryFailed(query),
    hasMore: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    loadMore: () => loadNextPage(query),
  };
}

function loadNextPage(query: InfiniteLike): void {
  if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
}

function retryFailed(query: InfiniteLike): void {
  if (query.isFetchNextPageError) loadNextPage(query);
  else void query.refetch();
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

  const pages = query.data?.pages ?? [];
  return {
    ...pagerState(query, enabled, pages.length > 0),
    stores: flattenItems(pages),
    refetch: () => void query.refetch(),
  };
}

function storePageFetcher(storeId: string | undefined) {
  return ({ pageParam }: { pageParam: string | undefined }): Promise<StoreNegativeOnHandPage> =>
    listErpnextNegativeOnHand(String(storeId), { cursor: pageParam }).then(pageOrThrow);
}

/**
 * Guards against mixing snapshots while paging. If a later page was computed
 * from a different snapshot than page 1, the query is reset (it reloads from
 * page 1) and `snapshotChanged` stays true for this store so the view can say
 * so. Until the reset lands, only page 1's rows are exposed.
 */
function useSnapshotConsistency(
  pages: readonly StoreNegativeOnHandPage[],
  queryKey: readonly unknown[],
  storeId: string | undefined,
) {
  const qc = useQueryClient();
  const [changedFor, setChangedFor] = useState<string | undefined>(undefined);
  const consistent = pagesShareSnapshot(pages);

  useEffect(() => {
    if (consistent) return;
    setChangedFor(storeId);
    void qc.resetQueries({ queryKey, exact: true });
  }, [consistent, qc, queryKey, storeId]);

  return {
    visiblePages: consistent ? pages : pages.slice(0, 1),
    snapshotChanged: changedFor !== undefined && changedFor === storeId,
  };
}

const INVALID_STORE: StockDiscrepancyError = { kind: "not-found" };

export function useStoreNegativeOnHand(scope: ScopeKey, storeId: string | undefined) {
  const validStore = isStoreId(storeId);
  const enabled = Boolean(scope.tenantId) && validStore;
  const queryKey = stockDiscrepancyQueryKeys.store(scope, storeId);
  const query = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: FIRST_PAGE,
    queryFn: storePageFetcher(storeId),
    getNextPageParam: nextCursorOf,
    retry: false,
  });
  const { visiblePages, snapshotChanged } = useSnapshotConsistency(
    query.data?.pages ?? [],
    queryKey,
    storeId,
  );
  const pager = pagerState(query, enabled, visiblePages.length > 0);

  return {
    ...pager,
    // A malformed route id would be a contract 400: render it as not-found.
    error: validStore ? pager.error : INVALID_STORE,
    // Every visible page shares page 1's snapshot (see useSnapshotConsistency).
    snapshot: visiblePages[0]?.snapshot,
    items: flattenItems(visiblePages),
    snapshotChanged,
  };
}

/**
 * "Request fresh snapshot". The caller mints the Idempotency-Key per click and
 * passes it as the mutation variable, so a retry of the same mutation reuses
 * the same key. On success the store's queries are invalidated so the API's
 * `pendingRequest` shows up.
 */
export function useRequestSnapshot(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idempotencyKey: string): Promise<TriggerOutcome> => {
      const res = await triggerReconciliationRun(storeId ?? "", idempotencyKey);
      return classifyTriggerOutcome(res);
    },
    onSuccess: (outcome) => {
      if (outcome.kind === "requested") {
        void qc.invalidateQueries({ queryKey: stockDiscrepancyQueryKeys.all });
      }
    },
  });
}
