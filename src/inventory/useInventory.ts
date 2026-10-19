/**
 * RT-728 query hooks for the inventory read views: a store's movement ledger
 * (keyset paged, newest first), its stock locations, one product's on-hand at
 * the store, and the product's tracking identities. Reads only: there is no
 * mutation here.
 *
 * Keys carry the active tenant and store, so a scope change never shows another
 * scope's rows. Errors are typed, never raw. No read retries on its own
 * (`retry: false`); a 429 carries the server's wait for the banner, and the
 * shared clock gates every Load more / Retry (GatedButton).
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import {
  type OnHand,
  type StockLocationList,
  type StockMovement,
  type StockMovementList,
  type TrackingIdentity,
  type TrackingIdentityList,
  getOnHand,
  listStockLocations,
  listStoreMovements,
  listTrackingIdentities,
} from "@/lib/inventory-queries";
import { type UseQueryResult, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { type ReadErrorKind, nextCursorOf, readErrorKind, requestIdOf } from "./inventoryLogic";

export type InventoryError = { kind: ReadErrorKind; requestId?: string; retryAfter?: number };

export interface InventoryScope {
  tenantId: string | null;
  activeStoreId: string | null;
  role: string | null;
}

/** Active tenant + store (the query scope) and the active role, from RF-1's context. */
export function useInventoryScope(): InventoryScope {
  const { context } = useActiveContextValue();
  return {
    tenantId: context?.active_tenant?.id ?? null,
    activeStoreId: context?.active_store?.id ?? null,
    role: context?.active_role_code ?? null,
  };
}

type ScopeKey = Pick<InventoryScope, "tenantId" | "activeStoreId">;

export const inventoryQueryKeys = {
  all: (scope: ScopeKey) => ["inventory", scope.tenantId, scope.activeStoreId] as const,
  movements: (scope: ScopeKey, storeId: string) =>
    [...inventoryQueryKeys.all(scope), "movements", storeId] as const,
  locations: (scope: ScopeKey, storeId: string) =>
    [...inventoryQueryKeys.all(scope), "locations", storeId] as const,
  onHand: (scope: ScopeKey, storeId: string, productId: string) =>
    [...inventoryQueryKeys.all(scope), "on-hand", storeId, productId] as const,
  tracking: (scope: ScopeKey, productId: string) =>
    [...inventoryQueryKeys.all(scope), "tracking", productId] as const,
};

class InventoryFetchError extends Error {
  constructor(readonly detail: InventoryError) {
    super("inventory");
  }
}

function errorOf(error: unknown): InventoryError | undefined {
  if (!error) return undefined;
  return error instanceof InventoryFetchError ? error.detail : { kind: "generic" };
}

interface ApiResult<P> {
  status: number;
  data?: P;
  error?: unknown;
  retryAfter?: number;
}

function dataOrThrow<P>(res: ApiResult<P>): P {
  if (res.status >= 400 || !res.data) {
    throw new InventoryFetchError({
      kind: readErrorKind(res.status),
      requestId: requestIdOf(res.error),
      retryAfter: res.retryAfter,
    });
  }
  return res.data;
}

// --- Single reads -------------------------------------------------------------------

export interface ReadState<T> {
  data?: T;
  isLoading: boolean;
  /** A failure with nothing on screen. */
  error?: InventoryError;
  /** A re-read failed while the earlier answer stays on screen. */
  inlineError?: InventoryError;
  retry: () => void;
}

function readState<T>(result: UseQueryResult<T>): ReadState<T> {
  const failure = errorOf(result.error);
  const has = result.data !== undefined;
  return {
    data: result.data,
    isLoading: result.isLoading,
    error: has ? undefined : failure,
    inlineError: has ? failure : undefined,
    retry: () => void result.refetch(),
  };
}

export function useStockLocations(
  scope: InventoryScope,
  storeId: string,
  enabled: boolean,
): ReadState<StockLocationList> {
  const result = useQuery({
    queryKey: inventoryQueryKeys.locations(scope, storeId),
    enabled: enabled && Boolean(scope.tenantId),
    queryFn: () => listStockLocations(storeId).then(dataOrThrow),
    retry: false,
  });
  return readState(result);
}

export function useOnHand(
  scope: InventoryScope,
  storeId: string,
  productId: string,
  enabled: boolean,
): ReadState<OnHand> {
  const result = useQuery({
    queryKey: inventoryQueryKeys.onHand(scope, storeId, productId),
    enabled: enabled && Boolean(scope.tenantId),
    queryFn: () => getOnHand(storeId, productId).then(dataOrThrow),
    retry: false,
  });
  return readState(result);
}

// --- Paged reads --------------------------------------------------------------------

export interface PagedState<T> {
  rows: T[];
  isLoading: boolean;
  /** A failure with nothing loaded yet. */
  error?: InventoryError;
  /** A later page (or a re-read) failed: the loaded rows stay. */
  inlineError?: InventoryError;
  /** Retries what failed: the failed page after a Load more, else the read. */
  retry: () => void;
  hasMore: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => void;
}

interface InfiniteLike<P> {
  data?: { pages: P[] };
  error: unknown;
  isLoading: boolean;
  isFetchNextPageError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  refetch: () => Promise<unknown>;
}

function pagedState<T, P extends { items: T[] }>(result: InfiniteLike<P>): PagedState<T> {
  const pages = result.data?.pages ?? [];
  const failure = errorOf(result.error);
  const loadMore = () => {
    if (result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage();
  };
  return {
    rows: pages.flatMap((p) => p.items),
    isLoading: result.isLoading,
    error: pages.length === 0 ? failure : undefined,
    inlineError: pages.length > 0 ? failure : undefined,
    retry: () => (result.isFetchNextPageError ? loadMore() : void result.refetch()),
    hasMore: result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    loadMore,
  };
}

const FIRST_PAGE: string | undefined = undefined;

type PageParam = { pageParam: string | undefined };

/** The store's whole ledger (`scope=all`), newest first; Load more follows `nextCursor`. */
export function useStoreMovements(scope: InventoryScope, storeId: string, enabled: boolean) {
  const result = useInfiniteQuery({
    queryKey: inventoryQueryKeys.movements(scope, storeId),
    enabled: enabled && Boolean(scope.tenantId),
    initialPageParam: FIRST_PAGE,
    queryFn: ({ pageParam }: PageParam) =>
      listStoreMovements(storeId, pageParam ? { cursor: pageParam } : {}).then(
        dataOrThrow<StockMovementList>,
      ),
    getNextPageParam: nextCursorOf,
    retry: false,
  });
  return pagedState<StockMovement, StockMovementList>(result);
}

/** The product's tracking identities; only requested for owner / tenant_admin. */
export function useTrackingIdentities(scope: InventoryScope, productId: string, enabled: boolean) {
  const result = useInfiniteQuery({
    queryKey: inventoryQueryKeys.tracking(scope, productId),
    enabled: enabled && Boolean(scope.tenantId),
    initialPageParam: FIRST_PAGE,
    queryFn: ({ pageParam }: PageParam) =>
      listTrackingIdentities(productId, pageParam ? { cursor: pageParam } : {}).then(
        dataOrThrow<TrackingIdentityList>,
      ),
    getNextPageParam: nextCursorOf,
    retry: false,
  });
  return pagedState<TrackingIdentity, TrackingIdentityList>(result);
}
