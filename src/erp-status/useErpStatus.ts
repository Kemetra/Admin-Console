/**
 * RT-560 query hooks for the ERP connection & sync status surface. Read-only
 * queries over the five wrappers in `src/lib/erp-status-queries.ts`, keyed by
 * the active tenant and the store filter. Every hook takes an `enabled` gate:
 * the page passes false for a role that may not read, so nothing is requested.
 *
 * Each panel exposes the same states (A-8): loading, `error` (a failure with
 * nothing loaded), `inlineError` (a re-read failed while earlier data stays on
 * screen: the stale state), and `asOf`, the time of the last successful read.
 * Errors are typed, never raw: a 404 is the API's non-disclosing refusal (an
 * out-of-scope store), a 403 a role refusal, a 401 an ended session.
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import {
  type ConnectorHealthList,
  type PageQuery,
  type PostingBacklogItem,
  type ReconciliationRunView,
  type SyncOpsSummary,
  consoleGetSyncOpsSummary,
  consoleListPostingBacklog,
  consoleListReconciliationRuns,
  listConnectorHealth,
  tenantAdminListConnectorInstances,
} from "@/lib/erp-status-queries";
import { type UseQueryResult, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  type ConnectionRow,
  flattenPages,
  joinConnections,
  nextCursor,
  requestIdOf,
} from "./erpStatusLogic";

export type ErpError = {
  kind: "not-found" | "forbidden" | "session" | "rejected" | "generic";
  requestId?: string;
};

export interface ErpScope {
  tenantId: string | null;
  tenantName: string | null;
  role: string | null;
}

/** The active tenant and role from RF-1's provider. */
export function useErpScope(): ErpScope {
  const { context } = useActiveContextValue();
  return {
    tenantId: context?.active_tenant?.id ?? null,
    tenantName: context?.active_tenant?.name ?? null,
    role: context?.active_role_code ?? null,
  };
}

/** What a panel reads: the tenant, the store filter (`""` = all stores), and the page's gate. */
export interface ErpQuery {
  tenantId: string | null;
  storeId: string;
  /** False for a role that may not read, or a malformed store filter: nothing is requested. */
  enabled: boolean;
}

/** Reads only with a tenant and an open gate. */
function isActive(query: ErpQuery): boolean {
  return query.enabled && Boolean(query.tenantId);
}

/** The store filter is part of every C3 key; the connection reads are tenant-wide. */
export const erpQueryKeys = {
  instances: (q: ErpQuery) => ["erp-status", q.tenantId, "instances"] as const,
  health: (q: ErpQuery) => ["erp-status", q.tenantId, "health"] as const,
  summary: (q: ErpQuery) => ["erp-status", q.tenantId, "summary", q.storeId] as const,
  backlog: (q: ErpQuery) => ["erp-status", q.tenantId, "backlog", q.storeId] as const,
  runs: (q: ErpQuery) => ["erp-status", q.tenantId, "runs", q.storeId] as const,
};

class ErpFetchError extends Error {
  constructor(readonly detail: ErpError) {
    super("erp-status");
  }
}

const STATUS_KINDS: Record<number, ErpError["kind"]> = {
  400: "rejected",
  401: "session",
  403: "forbidden",
  404: "not-found",
};

function errorOf(error: unknown): ErpError | undefined {
  if (!error) return undefined;
  return error instanceof ErpFetchError ? error.detail : { kind: "generic" };
}

interface ApiResult<P> {
  status: number;
  data?: P;
  error?: unknown;
}

/** Unwrap one wrapper result: its payload, or the typed error. */
function dataOrThrow<P>(res: ApiResult<P>): P {
  if (res.status >= 400 || !res.data) {
    throw new ErpFetchError({
      kind: STATUS_KINDS[res.status] ?? "generic",
      requestId: requestIdOf(res.error),
    });
  }
  return res.data;
}

export interface PanelState {
  isLoading: boolean;
  /** A failure with nothing loaded: the panel shows its error view. */
  error?: ErpError;
  /** A re-read failed while earlier data stays on screen (stale). */
  inlineError?: ErpError;
  /** When the data on screen was read (ms since epoch). */
  asOf?: number;
  retry: () => void;
}

/** With data on screen a failure is inline (it stays); with none it is the error view. */
function panelOf(result: UseQueryResult<unknown> | ListResult, enabled: boolean): PanelState {
  const failure = errorOf(result.error);
  const hasData = result.data !== undefined;
  return {
    isLoading: enabled && result.isLoading,
    error: hasData ? undefined : failure,
    inlineError: hasData ? failure : undefined,
    asOf: hasData ? result.dataUpdatedAt : undefined,
    retry: () => void result.refetch(),
  };
}

type ListResult = Pick<
  UseQueryResult<unknown>,
  "error" | "data" | "isLoading" | "dataUpdatedAt" | "refetch"
>;

/** The oldest of the read times that exist. */
function oldest(times: readonly (number | undefined)[]): number | undefined {
  const known = times.filter((time): time is number => time !== undefined);
  return known.length > 0 ? Math.min(...known) : undefined;
}

const storeFilter = (query: ErpQuery) => (query.storeId ? { store_id: query.storeId } : {});

const pageQuery = (query: ErpQuery, cursor: string | undefined): PageQuery => ({
  ...storeFilter(query),
  ...(cursor ? { cursor } : {}),
});

// --- Connection panel: C1 joined with C2 -------------------------------------------

export interface ConnectionsState extends PanelState {
  rows: ConnectionRow[];
  /** C2 could not be read at all: every row is at no signal (never healthy). */
  healthFailed: boolean;
}

export function useConnections(query: ErpQuery): ConnectionsState {
  const active = isActive(query);
  const instances = useQuery({
    queryKey: erpQueryKeys.instances(query),
    enabled: active,
    queryFn: () => tenantAdminListConnectorInstances().then(dataOrThrow),
    retry: false,
  });
  const health = useQuery<ConnectorHealthList>({
    queryKey: erpQueryKeys.health(query),
    enabled: active,
    queryFn: () => listConnectorHealth().then(dataOrThrow),
    retry: false,
  });
  const panel = panelOf(instances, active);
  const healthPanel = panelOf(health, active);
  // Liveness is time-bound: once a C2 read fails (first read or re-read), the
  // earlier verdict is no longer evidence, so every row drops to no signal.
  const healthFailed = health.isError;
  return {
    ...panel,
    isLoading: panel.isLoading || healthPanel.isLoading,
    rows: joinConnections(instances.data?.items ?? [], healthFailed ? undefined : health.data),
    healthFailed,
    // The pills come from C2, so "last read" is the older of the two reads.
    asOf: oldest([panel.asOf, healthFailed ? undefined : healthPanel.asOf]),
    retry: () => {
      void instances.refetch();
      void health.refetch();
    },
  };
}

// --- Sync summary ------------------------------------------------------------------

export interface SummaryState extends PanelState {
  summary?: SyncOpsSummary;
}

export function useSyncSummary(query: ErpQuery): SummaryState {
  const active = isActive(query);
  const result = useQuery({
    queryKey: erpQueryKeys.summary(query),
    enabled: active,
    queryFn: () => consoleGetSyncOpsSummary(storeFilter(query)).then(dataOrThrow),
    retry: false,
  });
  return { ...panelOf(result, active), summary: result.data };
}

// --- Cursor lists: posting backlog and reconciliation runs ---------------------------

export interface ListState<T> extends PanelState {
  rows: T[];
  hasMore: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => void;
}

const FIRST_PAGE: string | undefined = undefined;

function useCursorList<T>(
  queryKey: readonly unknown[],
  query: ErpQuery,
  fetchPage: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor: string | null }>,
): ListState<T> {
  const active = isActive(query);
  const result = useInfiniteQuery({
    queryKey,
    enabled: active,
    initialPageParam: FIRST_PAGE,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => fetchPage(pageParam),
    getNextPageParam: nextCursor,
    retry: false,
  });
  const loadMore = () => {
    if (result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage();
  };
  const panel = panelOf(result, active);
  return {
    ...panel,
    // A failed "Load more" retries the page; a failed re-read retries the read.
    retry: () => (result.isFetchNextPageError ? loadMore() : panel.retry()),
    rows: flattenPages(result.data?.pages ?? []),
    hasMore: result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    loadMore,
  };
}

export function usePostingBacklog(query: ErpQuery): ListState<PostingBacklogItem> {
  return useCursorList(erpQueryKeys.backlog(query), query, (cursor) =>
    consoleListPostingBacklog(pageQuery(query, cursor)).then(dataOrThrow),
  );
}

export function useReconciliationRuns(query: ErpQuery): ListState<ReconciliationRunView> {
  return useCursorList(erpQueryKeys.runs(query), query, (cursor) =>
    consoleListReconciliationRuns(pageQuery(query, cursor)).then(dataOrThrow),
  );
}
