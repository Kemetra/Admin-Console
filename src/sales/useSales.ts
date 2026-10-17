/**
 * RT-587 query hooks: a read-only infinite query over `consoleListSales` and a
 * detail query over `consoleGetSale`. Scope-keyed by the active tenant AND
 * active store (a store_manager's readable sales follow the active store
 * server-side), and the list key carries the whole query: a keyset cursor is
 * bound to the filters that issued it, so a filter change restarts at page 1
 * and a cursor is never reused (spec 012 FR-006).
 *
 * Errors are typed, never raw: a 404 is the API's uniform non-disclosing
 * refusal, a 401 an expired session, a 400 a rejected query.
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import {
  type SaleDetail,
  type SaleListQuery,
  type SalePage,
  consoleGetSale,
  consoleListSales,
} from "@/lib/sale-queries";
import { requestIdOf } from "@/shift-closes/shiftCloseLogic";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { isSaleRef, listEnded, nextSaleCursor } from "./saleLogic";

export type SaleError = {
  kind: "not-found" | "session" | "rejected" | "generic";
  requestId?: string;
};

export interface SaleScope {
  tenantId: string | null;
  tenantName: string | null;
  activeStoreId: string | null;
  role: string | null;
}

/** Active tenant and store (the query scope) from RF-1's provider. */
export function useSaleScope(): SaleScope {
  const { context } = useActiveContextValue();
  return {
    tenantId: context?.active_tenant?.id ?? null,
    tenantName: context?.active_tenant?.name ?? null,
    activeStoreId: context?.active_store?.id ?? null,
    role: context?.active_role_code ?? null,
  };
}

type ScopeKey = Pick<SaleScope, "tenantId" | "activeStoreId">;

export const saleQueryKeys = {
  list: (scope: ScopeKey, query: SaleListQuery | null) =>
    ["sales", "list", scope.tenantId, scope.activeStoreId, query] as const,
  detail: (scope: ScopeKey, saleRef: string | undefined) =>
    ["sales", "detail", scope.tenantId, scope.activeStoreId, saleRef] as const,
};

class SaleFetchError extends Error {
  constructor(readonly detail: SaleError) {
    super("sales");
  }
}

const STATUS_KINDS: Record<number, SaleError["kind"]> = {
  400: "rejected",
  401: "session",
  404: "not-found",
};

function errorOf(error: unknown): SaleError | undefined {
  if (!error) return undefined;
  return error instanceof SaleFetchError ? error.detail : { kind: "generic" };
}

interface ApiResult<P> {
  status: number;
  data?: P;
  error?: unknown;
}

/** Unwrap one wrapper result: its payload, or the typed error. */
function dataOrThrow<P>(res: ApiResult<P>): P {
  if (res.status >= 400 || !res.data) {
    throw new SaleFetchError({
      kind: STATUS_KINDS[res.status] ?? "generic",
      requestId: requestIdOf(res.error),
    });
  }
  return res.data;
}

const FIRST_PAGE: string | undefined = undefined;

export interface SaleListState {
  rows: SalePage["items"];
  /** The server time of the latest page read, and the store zone it reports. */
  asOf?: string;
  storeTimezone?: string;
  /** At least one page has been read. */
  hasPages: boolean;
  /** The last loaded page had `nextCursor: null`: the walk is over. */
  ended: boolean;
  isLoading: boolean;
  /** A failure with nothing loaded yet: the surface shows its error view. */
  error?: SaleError;
  /** A failure after a page was read: the loaded rows stay, with a Retry. */
  inlineError?: SaleError;
  retry: () => void;
  /**
   * Starts the walk again from the first page. For a continuation the server
   * refused (400): the cursor is the problem, so retrying it cannot succeed.
   */
  restart: () => void;
  hasMore: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => void;
}

type PagesState = Pick<
  SaleListState,
  "rows" | "asOf" | "storeTimezone" | "hasPages" | "ended" | "error" | "inlineError"
>;

/**
 * What the loaded pages say. With a page on screen a failure is inline (the
 * rows stay); with none it is the error view.
 */
function pagesState(pages: readonly SalePage[], failure: SaleError | undefined): PagesState {
  const last = pages.at(-1);
  const failureSlot = pages.length > 0 ? { inlineError: failure } : { error: failure };
  return {
    rows: pages.flatMap((p) => p.items),
    asOf: last?.asOf,
    storeTimezone: last?.storeTimezone,
    hasPages: pages.length > 0,
    ended: listEnded(pages),
    ...failureSlot,
  };
}

/** The list for a ready query; `null` (no store or range yet) reads nothing. */
export function useSaleList(scope: SaleScope, query: SaleListQuery | null): SaleListState {
  const active = Boolean(scope.tenantId) && query !== null;
  const queryClient = useQueryClient();
  const queryKey = saleQueryKeys.list(scope, query);
  const result = useInfiniteQuery({
    queryKey,
    enabled: active,
    initialPageParam: FIRST_PAGE,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      consoleListSales({ ...(query as SaleListQuery), cursor: pageParam }).then(dataOrThrow),
    getNextPageParam: nextSaleCursor,
    retry: false,
  });

  const loadMore = () => {
    if (result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage();
  };
  return {
    ...pagesState(result.data?.pages ?? [], errorOf(result.error)),
    isLoading: active && result.isLoading,
    retry: () => (result.isFetchNextPageError ? loadMore() : void result.refetch()),
    restart: () => void queryClient.resetQueries({ queryKey, exact: true }),
    hasMore: result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    loadMore,
  };
}

export interface SaleDetailState {
  detail?: SaleDetail;
  isLoading: boolean;
  error?: SaleError;
  retry: () => void;
}

const INVALID_REF: SaleError = { kind: "not-found" };

export function useSaleDetail(scope: SaleScope, saleRef: string | undefined): SaleDetailState {
  const validRef = isSaleRef(saleRef);
  const enabled = Boolean(scope.tenantId) && validRef;
  const result = useQuery<SaleDetail>({
    queryKey: saleQueryKeys.detail(scope, saleRef),
    enabled,
    queryFn: () => consoleGetSale(String(saleRef)).then(dataOrThrow),
    retry: false,
  });
  return {
    detail: result.data,
    isLoading: result.isLoading && enabled,
    // A malformed route ref would be a contract 400: it renders as not-found.
    error: validRef ? errorOf(result.error) : INVALID_REF,
    retry: () => void result.refetch(),
  };
}
