import { type PayerListQuery, consoleListPayerAccounts } from "@/lib/client";
/**
 * 017 payer-account list hook (useInfiniteQuery over consoleListPayerAccounts,
 * scope-keyed by active tenant + category filter — a tenant switch re-queries,
 * S6). Mirrors useAuditSearch. Read-only; no optimistic mutation.
 *
 * Pagination uses the pure helpers in payerListLogic: getNextPageParam returns
 * `nextPayerCursor` (null → undefined to stop in v5); rows are
 * `flattenPayerPages` over every fetched page. Errors are carried in the query
 * RESULT: 401 → session (the auth interceptor owns the redirect; this is only
 * the words), 403 → forbidden, every other non-2xx (400 bad query or cursor,
 * 404, the contract-less 422, 5xx) → one generic error. The server's code and
 * message are never surfaced; the request id is the only evidence carried.
 *
 * A page can be empty while its cursor is non-null, so `hasMore` is the cursor,
 * never the row count. A failed continuation keeps the rows already fetched.
 */
import { useInfiniteQuery } from "@tanstack/react-query";
import { type PayerListPage, flattenPayerPages, nextPayerCursor } from "./payerListLogic";

export type PayerCategory = "credit_customer" | "corporate" | "insurer";

/** The operator-controlled filter (cursor/page_size are pagination, not filters). */
export type PayerFilters = { category?: PayerCategory };

export type PayerListError = { kind: "session" | "forbidden" | "generic"; requestId?: string };

export interface PayerAccountsValue {
  rows: PayerListPage["items"];
  hasMore: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  error?: PayerListError;
  loadMore: () => void;
  refetch: () => void;
}

export const payerQueryKeys = {
  list: (activeTenantId: string | null, filters: PayerFilters) =>
    ["payer-accounts", activeTenantId, filters] as const,
};

function listErrorKind(status: number): PayerListError["kind"] {
  if (status === 401) return "session";
  if (status === 403) return "forbidden";
  return "generic";
}

const INITIAL_CURSOR: string | undefined = undefined;

export function usePayerAccounts(
  activeTenantId: string | null,
  filters: PayerFilters,
): PayerAccountsValue {
  const query = useInfiniteQuery({
    queryKey: payerQueryKeys.list(activeTenantId, filters),
    enabled: Boolean(activeTenantId),
    initialPageParam: INITIAL_CURSOR,
    queryFn: async ({ pageParam }: { pageParam: string | undefined }): Promise<PayerListPage> => {
      const params: PayerListQuery = { ...filters, cursor: pageParam };
      const res = await consoleListPayerAccounts(params);
      if (res.status >= 400) {
        const requestId = (res.error as { error?: { request_id?: string } } | undefined)?.error
          ?.request_id;
        const tag: PayerListError = { kind: listErrorKind(res.status), requestId };
        throw Object.assign(new Error("payer-list"), { payerError: tag });
      }
      return (res.data as PayerListPage | undefined) ?? { items: [], nextCursor: null };
    },
    getNextPageParam: (last) => nextPayerCursor(last),
    retry: false,
  });

  const rows = flattenPayerPages(query.data?.pages ?? []);
  const error = query.error
    ? ((query.error as Error & { payerError?: PayerListError }).payerError ?? { kind: "generic" })
    : undefined;

  return {
    rows,
    hasMore: Boolean(query.hasNextPage),
    isLoading: query.isLoading && Boolean(activeTenantId),
    isFetchingNextPage: query.isFetchingNextPage,
    error,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    refetch: () => {
      void query.refetch();
    },
  };
}
