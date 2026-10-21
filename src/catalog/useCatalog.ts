/**
 * RT-765 query hooks: a read-only infinite query over `consoleListCatalogProducts`
 * and a query over the flat category list. Scope-keyed by the active tenant AND
 * active store, and the list key carries the whole query: a keyset cursor is
 * bound to the filters that issued it, so a filter or store change restarts at
 * page 1 and a cursor is never reused.
 *
 * Errors are typed, never raw: a 404 is the API's uniform non-disclosing
 * refusal (a store out of scope, or a role the API refuses), a 401 an expired
 * session, a 400 a rejected query. A 429 is the generic retryable error: the
 * shell's rate-limit banner owns the countdown (RT-621).
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import {
  type CatalogCategory,
  type CatalogListQuery,
  type CatalogProductPage,
  consoleListCatalogCategories,
  consoleListCatalogProducts,
} from "@/lib/catalog-queries";
import { requestIdOf } from "@/shift-closes/shiftCloseLogic";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { dedupeProducts, listEnded, nextCatalogCursor } from "./catalogLogic";

export type CatalogError = {
  kind: "not-found" | "session" | "rejected" | "generic";
  requestId?: string;
};

export interface CatalogScope {
  tenantId: string | null;
  tenantName: string | null;
  activeStoreId: string | null;
  activeStoreName: string | null;
  role: string | null;
}

type ActiveContext = ReturnType<typeof useActiveContextValue>["context"];

function tenantScope(context: ActiveContext): Pick<CatalogScope, "tenantId" | "tenantName"> {
  const tenant = context?.active_tenant;
  return { tenantId: tenant?.id ?? null, tenantName: tenant?.name ?? null };
}

function storeScope(
  context: ActiveContext,
): Pick<CatalogScope, "activeStoreId" | "activeStoreName"> {
  const store = context?.active_store;
  return { activeStoreId: store?.id ?? null, activeStoreName: store?.name ?? null };
}

/** Active tenant and store (the query scope) from RF-1's provider. */
export function useCatalogScope(): CatalogScope {
  const { context } = useActiveContextValue();
  return {
    ...tenantScope(context),
    ...storeScope(context),
    role: context?.active_role_code ?? null,
  };
}

type ScopeKey = Pick<CatalogScope, "tenantId" | "activeStoreId">;

export const catalogQueryKeys = {
  list: (scope: ScopeKey, query: CatalogListQuery | null) =>
    ["catalog", "products", scope.tenantId, scope.activeStoreId, query] as const,
  categories: (tenantId: string | null) => ["catalog", "categories", tenantId] as const,
};

class CatalogFetchError extends Error {
  constructor(readonly detail: CatalogError) {
    super("catalog");
  }
}

const STATUS_KINDS: Record<number, CatalogError["kind"]> = {
  400: "rejected",
  401: "session",
  404: "not-found",
};

function errorOf(error: unknown): CatalogError | undefined {
  if (!error) return undefined;
  return error instanceof CatalogFetchError ? error.detail : { kind: "generic" };
}

interface ApiResult<P> {
  status: number;
  data?: P;
  error?: unknown;
}

/** Unwrap one wrapper result: its payload, or the typed error. */
function dataOrThrow<P>(res: ApiResult<P>): P {
  if (res.status >= 400 || !res.data) {
    throw new CatalogFetchError({
      kind: STATUS_KINDS[res.status] ?? "generic",
      requestId: requestIdOf(res.error),
    });
  }
  return res.data;
}

/** A page with no `items` is an empty page: the walk, not the list, decides the end. */
function normalizePage(page: Partial<CatalogProductPage>): CatalogProductPage {
  return { items: page.items ?? [], nextCursor: page.nextCursor ?? null };
}

const FIRST_PAGE: string | undefined = undefined;

export interface CatalogListState {
  rows: CatalogProductPage["items"];
  /** The last loaded page had `nextCursor: null`: the walk is over. */
  ended: boolean;
  isLoading: boolean;
  /** A failure with nothing loaded yet: the surface shows its error view. */
  error?: CatalogError;
  /** A failure after a page was read: the loaded rows stay, with a Retry. */
  inlineError?: CatalogError;
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

type PagesState = Pick<CatalogListState, "rows" | "ended" | "error" | "inlineError">;

/**
 * What the loaded pages say. With a page on screen a failure is inline (the
 * rows stay); with none it is the error view.
 */
function pagesState(
  pages: readonly CatalogProductPage[],
  failure: CatalogError | undefined,
): PagesState {
  const failureSlot = pages.length > 0 ? { inlineError: failure } : { error: failure };
  return {
    rows: dedupeProducts(pages.flatMap((p) => p.items)),
    ended: listEnded(pages),
    ...failureSlot,
  };
}

/** The list for a ready query; `null` (a refused role or filter) reads nothing. */
export function useCatalogList(
  scope: CatalogScope,
  query: CatalogListQuery | null,
): CatalogListState {
  const active = Boolean(scope.tenantId) && query !== null;
  const queryClient = useQueryClient();
  const queryKey = catalogQueryKeys.list(scope, query);
  const result = useInfiniteQuery({
    queryKey,
    enabled: active,
    initialPageParam: FIRST_PAGE,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      consoleListCatalogProducts({ ...query, cursor: pageParam })
        .then(dataOrThrow)
        .then(normalizePage),
    getNextPageParam: nextCatalogCursor,
    retry: false,
  });

  const { data, error, hasNextPage, isFetchingNextPage, isFetchNextPageError } = result;
  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) void result.fetchNextPage();
  };
  // A failed continuation retries the page it stopped at; a failed first page re-reads.
  const retry = () => {
    if (isFetchNextPageError) loadMore();
    else void result.refetch();
  };
  // A new walk drops every loaded page and asks for the first again.
  const restart = () => void queryClient.resetQueries({ queryKey, exact: true });
  return {
    ...pagesState(data?.pages ?? [], errorOf(error)),
    isLoading: active && result.isLoading,
    hasMore: hasNextPage,
    isFetchingNextPage,
    retry,
    restart,
    loadMore,
  };
}

export interface CatalogCategoriesState {
  categories: readonly CatalogCategory[];
  isLoading: boolean;
  /** The list could not be read: the filter keeps working without it. */
  failed: boolean;
}

/** The tenant's flat category list, read once for the filter. */
export function useCatalogCategories(
  tenantId: string | null,
  enabled: boolean,
): CatalogCategoriesState {
  const result = useQuery<readonly CatalogCategory[]>({
    queryKey: catalogQueryKeys.categories(tenantId),
    enabled: enabled && Boolean(tenantId),
    queryFn: () =>
      consoleListCatalogCategories()
        .then(dataOrThrow)
        .then((data) => data.items ?? []),
    retry: false,
  });
  return { categories: result.data ?? [], isLoading: result.isLoading, failed: result.isError };
}
