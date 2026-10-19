/**
 * RT-726 query hooks for the sale sync-ops surfaces: the sync status and the
 * audit timeline of one sale, the NEEDS_REPAIR queue, and the one guarded
 * write (repair). Every read takes an `enabled` gate: a role the API refuses
 * requests nothing. Keys carry the active tenant and store, so a scope change
 * never shows another scope's rows.
 *
 * Errors are typed, never raw. No read retries on its own (`retry: false`) and
 * the repair is sent once per confirmation: never auto-retried, no retry-all.
 */
import {
  type NeedsRepairItem,
  type NeedsRepairPage,
  type NeedsRepairQuery,
  type SaleAuditTimeline,
  type SaleSyncStatus,
  consoleGetSaleAuditTimeline,
  consoleGetSaleSyncStatus,
  consoleListNeedsRepair,
  consoleRepairSaleSync,
} from "@/lib/sale-sync-ops-queries";
import type { SaleScope } from "@/sales/useSales";
import {
  type UseQueryResult,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  type ReadErrorKind,
  type RepairOutcome,
  classifyRepair,
  keepsKey,
  newIdempotencyKey,
  nextRepairCursor,
  readErrorKind,
  requestIdOf,
} from "./saleSyncLogic";

export type SyncError = { kind: ReadErrorKind; requestId?: string; retryAfter?: number };

type ScopeKey = Pick<SaleScope, "tenantId" | "activeStoreId">;

/** One sale, read or repaired within the active scope. */
export interface SaleTarget {
  scope: SaleScope;
  saleRef: string;
}

/** The NEEDS_REPAIR queue: the store filter ("" = all stores) and the page's gate. */
export interface QueueTarget {
  scope: SaleScope;
  storeId: string;
  /** False for a malformed store filter: nothing is requested. */
  enabled: boolean;
}

export const saleSyncQueryKeys = {
  all: (scope: ScopeKey) => ["sale-sync", scope.tenantId, scope.activeStoreId] as const,
  status: ({ scope, saleRef }: SaleTarget) =>
    [...saleSyncQueryKeys.all(scope), "status", saleRef] as const,
  timeline: ({ scope, saleRef }: SaleTarget) =>
    [...saleSyncQueryKeys.all(scope), "timeline", saleRef] as const,
  needsRepair: ({ scope, storeId }: Pick<QueueTarget, "scope" | "storeId">) =>
    [...saleSyncQueryKeys.all(scope), "needs-repair", storeId] as const,
};

class SyncFetchError extends Error {
  constructor(readonly detail: SyncError) {
    super("sale-sync");
  }
}

function errorOf(error: unknown): SyncError | undefined {
  if (!error) return undefined;
  return error instanceof SyncFetchError ? error.detail : { kind: "generic" };
}

interface ApiResult<P> {
  status: number;
  data?: P;
  error?: unknown;
  retryAfter?: number;
}

function dataOrThrow<P>(res: ApiResult<P>): P {
  if (res.status >= 400 || !res.data) {
    throw new SyncFetchError({
      kind: readErrorKind(res.status),
      requestId: requestIdOf(res.error),
      retryAfter: res.retryAfter,
    });
  }
  return res.data;
}

export interface ReadState<T> {
  data?: T;
  isLoading: boolean;
  /** A failure with nothing on screen. */
  error?: SyncError;
  /** A re-read failed while the earlier answer stays on screen. */
  inlineError?: SyncError;
  retry: () => void;
}

/** A disabled query never loads, so `isLoading` needs no separate gate. */
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

/** One per-sale read: with a tenant only, never retried on its own. */
function useSaleRead<T>(
  queryKey: readonly unknown[],
  target: SaleTarget,
  read: (saleRef: string) => Promise<ApiResult<T>>,
): ReadState<T> {
  const result = useQuery({
    queryKey,
    enabled: Boolean(target.scope.tenantId),
    queryFn: () => read(target.saleRef).then(dataOrThrow),
    retry: false,
  });
  return readState(result);
}

export function useSaleSyncStatus(target: SaleTarget): ReadState<SaleSyncStatus> {
  return useSaleRead(saleSyncQueryKeys.status(target), target, consoleGetSaleSyncStatus);
}

export function useSaleAuditTimeline(target: SaleTarget): ReadState<SaleAuditTimeline> {
  return useSaleRead(saleSyncQueryKeys.timeline(target), target, consoleGetSaleAuditTimeline);
}

// --- NEEDS_REPAIR queue ------------------------------------------------------------

export interface NeedsRepairState {
  rows: NeedsRepairItem[];
  isLoading: boolean;
  error?: SyncError;
  /** A later page failed: the loaded rows stay, with a retry at the boundary. */
  inlineError?: SyncError;
  /** When the rows on screen were read (ms since epoch). */
  asOf?: number;
  /** Retries what failed: the failed page after a Load more, else the read. */
  retry: () => void;
  /** Re-reads the queue from its first page, whatever failed before. */
  refresh: () => void;
  hasMore: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => void;
}

const FIRST_PAGE: string | undefined = undefined;

/** The list query: the store filter when one is set, and the cursor after page 1. */
function pageQuery({ storeId }: QueueTarget, cursor: string | undefined): NeedsRepairQuery {
  return { ...(storeId ? { store_id: storeId } : {}), ...(cursor ? { cursor } : {}) };
}

type PagesState = Pick<NeedsRepairState, "rows" | "error" | "inlineError" | "asOf">;

/** With a page on screen a failure is inline (the rows stay); with none it is the error view. */
function pagesState(result: {
  data?: { pages: NeedsRepairPage[] };
  error: unknown;
  dataUpdatedAt: number;
}): PagesState {
  const pages = result.data?.pages ?? [];
  const failure = errorOf(result.error);
  if (pages.length === 0) return { rows: [], error: failure };
  return { rows: pages.flatMap((p) => p.items), inlineError: failure, asOf: result.dataUpdatedAt };
}

export function useNeedsRepairList(target: QueueTarget): NeedsRepairState {
  const result = useInfiniteQuery({
    queryKey: saleSyncQueryKeys.needsRepair(target),
    enabled: target.enabled && Boolean(target.scope.tenantId),
    initialPageParam: FIRST_PAGE,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      consoleListNeedsRepair(pageQuery(target, pageParam)).then(dataOrThrow<NeedsRepairPage>),
    getNextPageParam: nextRepairCursor,
    retry: false,
  });
  const loadMore = () => {
    if (result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage();
  };
  return {
    ...pagesState(result),
    isLoading: result.isLoading,
    retry: () => (result.isFetchNextPageError ? loadMore() : void result.refetch()),
    refresh: () => void result.refetch(),
    hasMore: result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    loadMore,
  };
}

// --- Repair (the one write) ---------------------------------------------------------

export interface RepairState {
  pending: boolean;
  outcome?: RepairOutcome;
  /** Sends one repair. Called only from the operator's confirmation. */
  repair: () => Promise<void>;
  /** Clears the shown outcome (a new confirmation starts clean). */
  reset: () => void;
}

export function useRepairSale(target: SaleTarget): RepairState {
  const queryClient = useQueryClient();
  const key = useRef<string | undefined>(undefined);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<RepairOutcome | undefined>(undefined);

  const repair = async () => {
    // A ref, not state: a second click before the re-render must not send twice.
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setOutcome(undefined);
    key.current ??= newIdempotencyKey();
    let next: RepairOutcome;
    try {
      next = classifyRepair(await consoleRepairSaleSync(target.saleRef, key.current));
    } catch {
      // No response at all: the server may or may not have acted.
      next = classifyRepair({ status: 0 });
    }
    if (!keepsKey(next)) key.current = undefined;
    if (next.kind === "repaired") {
      queryClient.setQueryData(saleSyncQueryKeys.status(target), next.status);
    } else {
      void queryClient.invalidateQueries({ queryKey: saleSyncQueryKeys.status(target) });
    }
    void queryClient.invalidateQueries({ queryKey: saleSyncQueryKeys.timeline(target) });
    void queryClient.invalidateQueries({
      queryKey: [...saleSyncQueryKeys.all(target.scope), "needs-repair"],
    });
    setOutcome(next);
    setPending(false);
    busy.current = false;
  };

  return { pending, outcome, repair, reset: () => setOutcome(undefined) };
}
