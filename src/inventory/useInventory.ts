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
  type PageQuery,
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

/** One store's inventory, read within the active scope. */
export interface StoreTarget {
  scope: InventoryScope;
  storeId: string;
}

/** One product at one store, reached from a movement row. */
export interface ProductTarget extends StoreTarget {
  productId: string;
}

function scopeKey({ scope }: StoreTarget) {
  return ["inventory", scope.tenantId, scope.activeStoreId] as const;
}

export const inventoryQueryKeys = {
  movements: (t: StoreTarget) => [...scopeKey(t), "movements", t.storeId] as const,
  locations: (t: StoreTarget) => [...scopeKey(t), "locations", t.storeId] as const,
  onHand: (t: ProductTarget) => [...scopeKey(t), "on-hand", t.storeId, t.productId] as const,
  // Identities are tenant-wide, not store-scoped.
  tracking: (t: ProductTarget) => [...scopeKey(t), "tracking", t.productId] as const,
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

/** One read: requested only with a tenant, never retried on its own. */
function useInventoryRead<T>(read: {
  queryKey: readonly unknown[];
  scope: InventoryScope;
  load: () => Promise<ApiResult<T>>;
}): ReadState<T> {
  const result = useQuery({
    queryKey: read.queryKey,
    enabled: Boolean(read.scope.tenantId),
    queryFn: () => read.load().then(dataOrThrow),
    retry: false,
  });
  return readState(result);
}

export function useStockLocations(target: StoreTarget): ReadState<StockLocationList> {
  return useInventoryRead({
    queryKey: inventoryQueryKeys.locations(target),
    scope: target.scope,
    load: () => listStockLocations(target.storeId),
  });
}

export function useOnHand(target: ProductTarget): ReadState<OnHand> {
  return useInventoryRead({
    queryKey: inventoryQueryKeys.onHand(target),
    scope: target.scope,
    load: () => getOnHand(target.storeId, target.productId),
  });
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

/** A keyset-paged read: Load more follows `nextCursor`; a null cursor ends it. */
function useInventoryPages<T, P extends { items: T[]; nextCursor?: string | null }>(read: {
  queryKey: readonly unknown[];
  scope: InventoryScope;
  fetchPage: (query: PageQuery) => Promise<ApiResult<P>>;
}): PagedState<T> {
  const result = useInfiniteQuery({
    queryKey: read.queryKey,
    enabled: Boolean(read.scope.tenantId),
    initialPageParam: FIRST_PAGE,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      read.fetchPage(pageParam ? { cursor: pageParam } : {}).then(dataOrThrow<P>),
    getNextPageParam: nextCursorOf,
    retry: false,
  });
  return pagedState<T, P>(result);
}

/** The store's whole ledger (`scope=all`), newest first. */
export function useStoreMovements(target: StoreTarget): PagedState<StockMovement> {
  return useInventoryPages<StockMovement, StockMovementList>({
    queryKey: inventoryQueryKeys.movements(target),
    scope: target.scope,
    fetchPage: (query) => listStoreMovements(target.storeId, query),
  });
}

/** The product's tracking identities; only mounted for owner / tenant_admin. */
export function useTrackingIdentities(target: ProductTarget): PagedState<TrackingIdentity> {
  return useInventoryPages<TrackingIdentity, TrackingIdentityList>({
    queryKey: inventoryQueryKeys.tracking(target),
    scope: target.scope,
    fetchPage: (query) => listTrackingIdentities(target.productId, query),
  });
}
