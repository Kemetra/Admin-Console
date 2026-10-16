/**
 * RT-18 query hooks. A read-only infinite query over `consoleListShiftCloses`,
 * a detail query over `consoleGetShiftClose`, and the store roster that gives
 * each row its name and time zone. Scope-keyed by the active tenant AND active
 * store (a store_manager's readable closes follow the active store server-side),
 * and the list key carries the whole query: a keyset cursor is only valid with
 * the filters that issued it, so a filter change restarts at page 1.
 *
 * Errors are typed, never raw: a 404 is the API's uniform non-disclosing
 * refusal, a 401 an expired session, a 400 a rejected filter.
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import {
  type ShiftCloseDetail,
  type ShiftCloseListQuery,
  type ShiftClosePage,
  consoleGetShiftClose,
  consoleListShiftCloses,
} from "@/lib/shift-close-queries";
import { useStoreDetail, useStoreList } from "@/stores/useStoreQueries";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  flattenShiftClosePages,
  isShiftId,
  nextShiftCloseCursor,
  requestIdOf,
} from "./shiftCloseLogic";

export type ShiftCloseError = {
  kind: "not-found" | "session" | "rejected" | "generic";
  requestId?: string;
};

export interface ScopeKey {
  tenantId: string | null;
  activeStoreId: string | null;
}

export interface ShiftCloseScope extends ScopeKey {
  tenantName: string | null;
}

/** Active tenant + store (the query scope) from RF-1's provider. */
export function useShiftCloseScope(): ShiftCloseScope {
  const { context } = useActiveContextValue();
  return {
    tenantId: context?.active_tenant?.id ?? null,
    tenantName: context?.active_tenant?.name ?? null,
    activeStoreId: context?.active_store?.id ?? null,
  };
}

export const shiftCloseQueryKeys = {
  list: (scope: ScopeKey, query: ShiftCloseListQuery) =>
    ["shift-closes", "list", scope.tenantId, scope.activeStoreId, query] as const,
  detail: (scope: ScopeKey, shiftId: string | undefined) =>
    ["shift-closes", "detail", scope.tenantId, scope.activeStoreId, shiftId] as const,
};

class ShiftCloseFetchError extends Error {
  constructor(readonly detail: ShiftCloseError) {
    super("shift-closes");
  }
}

const STATUS_KINDS: Record<number, ShiftCloseError["kind"]> = {
  400: "rejected",
  401: "session",
  404: "not-found",
};

function toError(status: number, error: unknown): ShiftCloseFetchError {
  return new ShiftCloseFetchError({
    kind: STATUS_KINDS[status] ?? "generic",
    requestId: requestIdOf(error),
  });
}

function errorOf(error: unknown): ShiftCloseError | undefined {
  if (!error) return undefined;
  return error instanceof ShiftCloseFetchError ? error.detail : { kind: "generic" };
}

interface ApiResult<P> {
  status: number;
  data?: P;
  error?: unknown;
}

/** Unwrap one wrapper result: its payload, or the typed error. */
function dataOrThrow<P>(res: ApiResult<P>): P {
  if (res.status >= 400 || !res.data) throw toError(res.status, res.error);
  return res.data;
}

const FIRST_PAGE: string | undefined = undefined;

export interface ShiftCloseListState {
  rows: ShiftClosePage["items"];
  /** Waiting on the first page (or on the roster a date filter needs). */
  isLoading: boolean;
  /** A failure with nothing loaded yet: the surface shows its error view. */
  error?: ShiftCloseError;
  /**
   * A failure after rows were loaded (a failed "Load more" or re-read): the
   * loaded rows stay and the pager shows this error with a Retry.
   */
  inlineError?: ShiftCloseError;
  /** Retries whatever failed: the next page, or the re-read. */
  retry: () => void;
  hasMore: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => void;
}

/**
 * The caller's gate beyond the tenant: `run` (read now), `wait` (a date filter
 * needs the store's zone from the roster) or `block` (the filters are invalid:
 * nothing is read and nothing is loading).
 */
export type ListGate = "run" | "wait" | "block";

export function useShiftCloseList(
  scope: ScopeKey,
  query: ShiftCloseListQuery,
  gate: ListGate,
): ShiftCloseListState {
  const active = Boolean(scope.tenantId) && gate === "run";
  const result = useInfiniteQuery({
    queryKey: shiftCloseQueryKeys.list(scope, query),
    enabled: active,
    initialPageParam: FIRST_PAGE,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      consoleListShiftCloses({ ...query, cursor: pageParam }).then(dataOrThrow),
    getNextPageParam: nextShiftCloseCursor,
    retry: false,
  });

  const rows = flattenShiftClosePages(result.data?.pages ?? []);
  const loadMore = () => {
    if (result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage();
  };
  return {
    rows,
    isLoading: isListLoading(Boolean(scope.tenantId), gate, active && result.isLoading),
    ...splitFailure(errorOf(result.error), rows.length > 0),
    retry: () => (result.isFetchNextPageError ? loadMore() : void result.refetch()),
    hasMore: result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    loadMore,
  };
}

/** Waiting on the roster, or on the first page of a read that is actually running. */
function isListLoading(hasTenant: boolean, gate: ListGate, reading: boolean): boolean {
  return hasTenant && (gate === "wait" || reading);
}

/** With rows on screen a failure is inline (they stay); with none it is the error view. */
function splitFailure(
  failure: ShiftCloseError | undefined,
  hasRows: boolean,
): Pick<ShiftCloseListState, "error" | "inlineError"> {
  return hasRows ? { inlineError: failure } : { error: failure };
}

export interface ShiftCloseDetailState {
  detail?: ShiftCloseDetail;
  isLoading: boolean;
  error?: ShiftCloseError;
  retry: () => void;
}

const INVALID_ID: ShiftCloseError = { kind: "not-found" };

export function useShiftCloseDetail(
  scope: ScopeKey,
  shiftId: string | undefined,
): ShiftCloseDetailState {
  const validId = isShiftId(shiftId);
  const enabled = Boolean(scope.tenantId) && validId;
  const result = useQuery<ShiftCloseDetail>({
    queryKey: shiftCloseQueryKeys.detail(scope, shiftId),
    enabled,
    queryFn: () => consoleGetShiftClose(String(shiftId)).then(dataOrThrow),
    retry: false,
  });
  return {
    detail: result.data,
    isLoading: result.isLoading && enabled,
    // A malformed route id would be a contract 400: it renders as not-found.
    error: validId ? errorOf(result.error) : INVALID_ID,
    retry: () => void result.refetch(),
  };
}

export interface StoreInfo {
  id: string;
  name: string;
  timezone?: string;
}

export interface StoreDirectory {
  stores: readonly StoreInfo[];
  /** The roster request has settled (read or failed): a fallback is now final. */
  ready: boolean;
  nameOf: (storeId: string) => string | undefined;
  timeZoneOf: (storeId: string) => string | undefined;
}

/**
 * The stores the caller can see, for names and time zones. It shares RF-2's
 * store-list cache. A failed read is not an error here: rows fall back to an
 * unknown store and UTC, labelled as such.
 */
export function useStoreDirectory(tenantId: string | null): StoreDirectory {
  const { result, isLoading } = useStoreList(tenantId);
  const stores: StoreInfo[] = result?.kind === "rows" ? result.rows : [];
  const byId = new Map(stores.map((s) => [s.id, s]));
  return {
    stores,
    ready: !isLoading,
    nameOf: (storeId) => byId.get(storeId)?.name,
    timeZoneOf: (storeId) => byId.get(storeId)?.timezone,
  };
}

/**
 * The store's own name and time zone, for a detail view. `ready` once the read
 * has settled (read or failed), so a time is never shown in UTC just because the
 * zone had not arrived yet.
 */
export function useStoreOf(storeId: string | undefined): {
  name?: string;
  timeZone?: string;
  ready: boolean;
} {
  const { result, isLoading } = useStoreDetail(storeId);
  const store = result?.kind === "store" ? result.store : undefined;
  return { name: store?.name, timeZone: store?.timezone, ready: !isLoading };
}
