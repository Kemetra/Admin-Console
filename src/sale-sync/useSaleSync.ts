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

export const saleSyncQueryKeys = {
  all: (scope: ScopeKey) => ["sale-sync", scope.tenantId, scope.activeStoreId] as const,
  status: (scope: ScopeKey, saleRef: string) =>
    [...saleSyncQueryKeys.all(scope), "status", saleRef] as const,
  timeline: (scope: ScopeKey, saleRef: string) =>
    [...saleSyncQueryKeys.all(scope), "timeline", saleRef] as const,
  needsRepair: (scope: ScopeKey, storeId: string) =>
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

function readState<T>(result: UseQueryResult<T>, enabled: boolean): ReadState<T> {
  const failure = errorOf(result.error);
  const has = result.data !== undefined;
  return {
    data: result.data,
    isLoading: enabled && result.isLoading,
    error: has ? undefined : failure,
    inlineError: has ? failure : undefined,
    retry: () => void result.refetch(),
  };
}

export function useSaleSyncStatus(
  scope: SaleScope,
  saleRef: string,
  enabled: boolean,
): ReadState<SaleSyncStatus> {
  const active = enabled && Boolean(scope.tenantId);
  const result = useQuery({
    queryKey: saleSyncQueryKeys.status(scope, saleRef),
    enabled: active,
    queryFn: () => consoleGetSaleSyncStatus(saleRef).then(dataOrThrow),
    retry: false,
  });
  return readState(result, active);
}

export function useSaleAuditTimeline(
  scope: SaleScope,
  saleRef: string,
  enabled: boolean,
): ReadState<SaleAuditTimeline> {
  const active = enabled && Boolean(scope.tenantId);
  const result = useQuery({
    queryKey: saleSyncQueryKeys.timeline(scope, saleRef),
    enabled: active,
    queryFn: () => consoleGetSaleAuditTimeline(saleRef).then(dataOrThrow),
    retry: false,
  });
  return readState(result, active);
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
  retry: () => void;
  hasMore: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => void;
}

const FIRST_PAGE: string | undefined = undefined;

export function useNeedsRepairList(
  scope: SaleScope,
  storeId: string,
  enabled: boolean,
): NeedsRepairState {
  const active = enabled && Boolean(scope.tenantId);
  const result = useInfiniteQuery({
    queryKey: saleSyncQueryKeys.needsRepair(scope, storeId),
    enabled: active,
    initialPageParam: FIRST_PAGE,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      consoleListNeedsRepair({
        ...(storeId ? { store_id: storeId } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      }).then(dataOrThrow<NeedsRepairPage>),
    getNextPageParam: nextRepairCursor,
    retry: false,
  });
  const loadMore = () => {
    if (result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage();
  };
  const pages = result.data?.pages ?? [];
  const failure = errorOf(result.error);
  return {
    rows: pages.flatMap((p) => p.items),
    isLoading: active && result.isLoading,
    error: pages.length > 0 ? undefined : failure,
    inlineError: pages.length > 0 ? failure : undefined,
    asOf: pages.length > 0 ? result.dataUpdatedAt : undefined,
    retry: () => (result.isFetchNextPageError ? loadMore() : void result.refetch()),
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

export function useRepairSale(scope: SaleScope, saleRef: string): RepairState {
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
      next = classifyRepair(await consoleRepairSaleSync(saleRef, key.current));
    } catch {
      // No response at all: the server may or may not have acted.
      next = classifyRepair({ status: 0 });
    }
    if (!keepsKey(next)) key.current = undefined;
    if (next.kind === "repaired") {
      queryClient.setQueryData(saleSyncQueryKeys.status(scope, saleRef), next.status);
    } else {
      void queryClient.invalidateQueries({ queryKey: saleSyncQueryKeys.status(scope, saleRef) });
    }
    void queryClient.invalidateQueries({ queryKey: saleSyncQueryKeys.timeline(scope, saleRef) });
    void queryClient.invalidateQueries({
      queryKey: [...saleSyncQueryKeys.all(scope), "needs-repair"],
    });
    setOutcome(next);
    setPending(false);
    busy.current = false;
  };

  return { pending, outcome, repair, reset: () => setOutcome(undefined) };
}
