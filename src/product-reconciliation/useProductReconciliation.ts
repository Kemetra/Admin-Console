/**
 * RT-727 query hooks for ERPNext product-master reconciliation. Reads are
 * cursor lists keyed by the active tenant (the surface has no store axis) and
 * gated: nothing is requested without a tenant or for a role the API refuses.
 * The two mutations (trigger a run, repair a mapping) are explicit, single
 * shots: no retry (the query client's default, kept here on purpose), the
 * Idempotency-Key is minted by the caller per confirmed click, and the server's
 * outcome is returned as received. After any answer from the server the
 * surface's reads are invalidated, so the lists show the server's new truth.
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import {
  type BacklogClass,
  type BacklogItem,
  type MismatchClass,
  type ProductReconciliationResult,
  type ProductReconciliationRun,
  type RepairProductMappingRequest,
  getProductReconciliationRunResults,
  listProductReconciliationBacklog,
  listProductReconciliationRuns,
  repairProductMapping,
  triggerProductReconciliationRun,
} from "@/lib/product-reconciliation-queries";
import {
  type UseInfiniteQueryResult,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type ApiResult,
  type ReadError,
  type RefusedOutcome,
  type RepairOutcome,
  type TriggerOutcome,
  classifyRepair,
  classifyTrigger,
  readErrorOf,
} from "./productReconLogic";

export interface ReconScope {
  tenantId: string | null;
  tenantName: string | null;
  role: string | null;
}

/** The active tenant and role from RF-1's provider. */
export function useReconScope(): ReconScope {
  const { context } = useActiveContextValue();
  return {
    tenantId: context?.active_tenant?.id ?? null,
    tenantName: context?.active_tenant?.name ?? null,
    role: context?.active_role_code ?? null,
  };
}

export const productReconKeys = {
  all: (tenantId: string | null) => ["product-recon", tenantId] as const,
  backlog: (tenantId: string | null, cls: string) =>
    ["product-recon", tenantId, "backlog", cls] as const,
  runs: (tenantId: string | null) => ["product-recon", tenantId, "runs"] as const,
  results: (tenantId: string | null, runId: string, cls: string) =>
    ["product-recon", tenantId, "results", runId, cls] as const,
};

class ReadFailure extends Error {
  constructor(readonly detail: ReadError) {
    super("product-reconciliation");
  }
}

function pageOrThrow<P>(result: ApiResult<P>): P {
  if (result.status >= 400 || !result.data) throw new ReadFailure(readErrorOf(result));
  return result.data;
}

function errorOf(error: unknown): ReadError | undefined {
  if (!error) return undefined;
  return error instanceof ReadFailure ? error.detail : { kind: "generic" };
}

export interface ListState<T> {
  rows: T[];
  isLoading: boolean;
  /** A failure with nothing loaded. */
  error?: ReadError;
  /** A re-read or Load more failed while earlier rows stay on screen. */
  inlineError?: ReadError;
  /** When the rows on screen were read (ms since epoch). */
  asOf?: number;
  hasMore: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => void;
  retry: () => void;
}

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

const FIRST_PAGE: string | undefined = undefined;

function listOf<T>(result: UseInfiniteQueryResult<{ pages: Page<T>[] }>, enabled: boolean) {
  const failure = errorOf(result.error);
  const hasData = result.data !== undefined;
  const loadMore = () => {
    if (result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage();
  };
  return {
    rows: (result.data?.pages ?? []).flatMap((page) => page.items),
    isLoading: enabled && result.isLoading,
    error: hasData ? undefined : failure,
    inlineError: hasData ? failure : undefined,
    asOf: hasData ? result.dataUpdatedAt : undefined,
    hasMore: result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    loadMore,
    // A failed Load more retries that page; any other failure re-reads.
    retry: () => (result.isFetchNextPageError ? loadMore() : void result.refetch()),
  };
}

function useCursorList<T>(
  queryKey: readonly unknown[],
  enabled: boolean,
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
): ListState<T> {
  const result = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: FIRST_PAGE,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => fetchPage(pageParam),
    getNextPageParam: (page: Page<T>) => page.nextCursor ?? undefined,
    retry: false,
  });
  return listOf(result, enabled);
}

const cursorOf = (cursor: string | undefined) => (cursor ? { cursor } : {});

export function useBacklog(scope: ReconScope, cls: BacklogClass | ""): ListState<BacklogItem> {
  return useCursorList(
    productReconKeys.backlog(scope.tenantId, cls),
    Boolean(scope.tenantId),
    (c) =>
      listProductReconciliationBacklog({ ...cursorOf(c), ...(cls ? { class: cls } : {}) }).then(
        pageOrThrow,
      ),
  );
}

export function useRuns(scope: ReconScope): ListState<ProductReconciliationRun> {
  return useCursorList(productReconKeys.runs(scope.tenantId), Boolean(scope.tenantId), (c) =>
    listProductReconciliationRuns(cursorOf(c)).then(pageOrThrow),
  );
}

export function useRunResults(
  scope: ReconScope,
  runId: string,
  cls: MismatchClass | "",
  enabled: boolean,
): ListState<ProductReconciliationResult> {
  return useCursorList(
    productReconKeys.results(scope.tenantId, runId, cls),
    enabled && Boolean(scope.tenantId),
    (c) =>
      getProductReconciliationRunResults(runId, {
        ...cursorOf(c),
        ...(cls ? { class: cls } : {}),
      }).then(pageOrThrow),
  );
}

/** A thrown request (network, aborted) is a generic refusal: it is not retried either. */
const THROWN: RefusedOutcome = { kind: "refused", refusal: "error" };

/**
 * One explicit server call per confirmed click: never retried, a throw becomes
 * the generic refusal, and `refresh` names what to re-read after the answer.
 */
function useSingleShot<V, O>(
  send: (variables: V) => Promise<O>,
  refresh: (outcome: O | RefusedOutcome) => readonly unknown[] | null,
) {
  const qc = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (variables: V): Promise<O | RefusedOutcome> => send(variables).catch(() => THROWN),
    onSuccess: (outcome) => {
      const queryKey = refresh(outcome);
      if (queryKey) void qc.invalidateQueries({ queryKey });
    },
  });
}

/** Start an on-demand run. The variable is the Idempotency-Key for this one confirmed click. */
export function useTriggerRun(scope: ReconScope) {
  return useSingleShot(
    (idempotencyKey: string): Promise<TriggerOutcome> =>
      triggerProductReconciliationRun(idempotencyKey).then(classifyTrigger),
    (outcome) => (outcome.kind === "started" ? productReconKeys.runs(scope.tenantId) : null),
  );
}

export interface RepairVariables {
  request: RepairProductMappingRequest;
  idempotencyKey: string;
}

/** Repair one product's mapping. Any recorded outcome (or 409) re-reads the surface. */
export function useRepair(scope: ReconScope) {
  return useSingleShot(
    ({ request, idempotencyKey }: RepairVariables): Promise<RepairOutcome> =>
      repairProductMapping(request, idempotencyKey).then(classifyRepair),
    (outcome) =>
      outcome.kind === "recorded" || outcome.refusal === "conflict"
        ? productReconKeys.all(scope.tenantId)
        : null,
  );
}
