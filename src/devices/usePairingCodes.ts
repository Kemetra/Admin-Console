/**
 * RT-372 hooks for the pending pairing codes: the live list (keyset paged,
 * newest first, never a code or its hash) and the cancel. Scope-keyed by the
 * active tenant and store, like the fleet. Cancel is idempotent on the server
 * (`already_cancelled` is a success); every other answer is classified by the
 * caller from the wrapper's result.
 */
import {
  type PairingCodePage,
  consoleCancelPairingCode,
  consoleListPairingCodes,
} from "@/lib/device-queries";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { requestIdOf } from "./deviceLogic";
import type { DeviceError, DeviceScope } from "./useDevices";

export const CODES_PAGE_SIZE = 50;

type ScopeKey = Pick<DeviceScope, "tenantId" | "activeStoreId">;

const STATUS_KINDS: Record<number, DeviceError["kind"]> = {
  400: "rejected",
  401: "session",
  404: "not-found",
};

class CodesFetchError extends Error {
  constructor(readonly detail: DeviceError) {
    super("pairing-codes");
  }
}

export interface PairingCodeListState {
  rows: PairingCodePage["items"];
  isLoading: boolean;
  error?: DeviceError;
  inlineError?: DeviceError;
  retry: () => void;
  hasMore: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => void;
}

function errorOf(error: unknown): DeviceError | undefined {
  if (!error) return undefined;
  return error instanceof CodesFetchError ? error.detail : { kind: "generic" };
}

/** One page, or the typed error: a refusal is never an empty list. */
async function fetchPage(cursor: string | undefined): Promise<PairingCodePage> {
  const res = await consoleListPairingCodes({ page_size: CODES_PAGE_SIZE, cursor });
  if (res.status >= 400 || !res.data) {
    throw new CodesFetchError({
      kind: STATUS_KINDS[res.status] ?? "generic",
      requestId: requestIdOf(res.error),
    });
  }
  return res.data;
}

/** The server's order, never re-sorted; a code seen twice across pages is shown once. */
function flattenCodePages(pages: readonly PairingCodePage[]): PairingCodePage["items"] {
  const seen = new Set<string>();
  return pages
    .flatMap((page) => page.items)
    .filter((code) => !seen.has(code.pairingCodeId) && seen.add(code.pairingCodeId));
}

export function usePairingCodes(scope: ScopeKey): PairingCodeListState {
  const active = Boolean(scope.tenantId);
  const result = useInfiniteQuery({
    queryKey: ["devices", "pairing-codes", "list", scope.tenantId, scope.activeStoreId],
    enabled: active,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => fetchPage(pageParam),
    getNextPageParam: (page: PairingCodePage) => page.nextCursor ?? undefined,
    retry: false,
  });

  const rows = flattenCodePages(result.data?.pages ?? []);
  const failure = errorOf(result.error);
  const loadMore = () => {
    if (result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage();
  };
  return {
    rows,
    isLoading: active && result.isLoading,
    ...(rows.length > 0 ? { inlineError: failure } : { error: failure }),
    retry: () => (result.isFetchNextPageError ? loadMore() : void result.refetch()),
    hasMore: result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    loadMore,
  };
}

const REFRESH_AFTER: ReadonlySet<number> = new Set([200, 404, 409]);

export function useCancelPairingCode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (pairingCodeId: string) => consoleCancelPairingCode(pairingCodeId),
    onSuccess: (res) => {
      // 200 changed the code; a 404 or 409 says the page's picture of it is out of date.
      if (REFRESH_AFTER.has(res.status)) {
        void client.invalidateQueries({ queryKey: ["devices", "pairing-codes"] });
      }
    },
  });
}
