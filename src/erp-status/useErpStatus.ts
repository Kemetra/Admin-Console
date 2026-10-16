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

/** The store filter value (`""` = all stores) is part of every C3 key. */
export const erpQueryKeys = {
  all: (tenantId: string | null) => ["erp-status", tenantId] as const,
  instances: (tenantId: string | null) => ["erp-status", tenantId, "instances"] as const,
  health: (tenantId: string | null) => ["erp-status", tenantId, "health"] as const,
  summary: (tenantId: string | null, storeId: string) =>
    ["erp-status", tenantId, "summary", storeId] as const,
  backlog: (tenantId: string | null, storeId: string) =>
    ["erp-status", tenantId, "backlog", storeId] as const,
  runs: (tenantId: string | null, storeId: string) =>
    ["erp-status", tenantId, "runs", storeId] as const,
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

const pageQuery = (storeId: string, cursor: string | undefined): PageQuery => ({
  ...(storeId ? { store_id: storeId } : {}),
  ...(cursor ? { cursor } : {}),
});

// --- Connection panel: C1 joined with C2 -------------------------------------------

export interface ConnectionsState extends PanelState {
  rows: ConnectionRow[];
  /** C2 could not be read at all: every row is at no signal (never healthy). */
  healthFailed: boolean;
}

export function useConnections(tenantId: string | null, enabled: boolean): ConnectionsState {
  const active = enabled && Boolean(tenantId);
  const instances = useQuery({
    queryKey: erpQueryKeys.instances(tenantId),
    enabled: active,
    queryFn: () => tenantAdminListConnectorInstances().then(dataOrThrow),
    retry: false,
  });
  const health = useQuery<ConnectorHealthList>({
    queryKey: erpQueryKeys.health(tenantId),
    enabled: active,
    queryFn: () => listConnectorHealth().then(dataOrThrow),
    retry: false,
  });
  const panel = panelOf(instances, active);
  const healthPanel = panelOf(health, active);
  return {
    ...panel,
    isLoading: panel.isLoading || healthPanel.isLoading,
    // A failed C2 re-read over loaded rows is stale, like a failed C1 re-read.
    inlineError: panel.inlineError ?? healthPanel.inlineError,
    rows: joinConnections(instances.data?.items ?? [], health.data),
    healthFailed: Boolean(healthPanel.error),
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

export function useSyncSummary(
  tenantId: string | null,
  storeId: string,
  enabled: boolean,
): SummaryState {
  const active = enabled && Boolean(tenantId);
  const result = useQuery({
    queryKey: erpQueryKeys.summary(tenantId, storeId),
    enabled: active,
    queryFn: () => consoleGetSyncOpsSummary(storeId ? { store_id: storeId } : {}).then(dataOrThrow),
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
  active: boolean,
  fetchPage: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor: string | null }>,
): ListState<T> {
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

export function usePostingBacklog(
  tenantId: string | null,
  storeId: string,
  enabled: boolean,
): ListState<PostingBacklogItem> {
  return useCursorList(erpQueryKeys.backlog(tenantId, storeId), enabled && Boolean(tenantId), (c) =>
    consoleListPostingBacklog(pageQuery(storeId, c)).then(dataOrThrow),
  );
}

export function useReconciliationRuns(
  tenantId: string | null,
  storeId: string,
  enabled: boolean,
): ListState<ReconciliationRunView> {
  return useCursorList(erpQueryKeys.runs(tenantId, storeId), enabled && Boolean(tenantId), (c) =>
    consoleListReconciliationRuns(pageQuery(storeId, c)).then(dataOrThrow),
  );
}
