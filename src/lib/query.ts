/**
 * TanStack Query client (R3-2/R3-3). This cache is the read-only
 * active-context store: `getActiveContext` is a query, the three context
 * mutators invalidate + re-fetch it (no optimistic update; FR-003-005).
 *
 * Defaults are conservative for an operational admin tool: no retry on
 * mutations, a single retry on queries (the 401 path is handled by the
 * interceptor, not by Query retries), and no refetch-on-window-focus
 * (OQ-2 resolved to reactive on-401-retry-once, not a focus/timer cadence).
 *
 * RT-621: the single query retry honours a running Retry-After (429) instead of
 * the default 1 s backoff, and is skipped when the wait is long (rate-limit.ts).
 */
import { QueryClient } from "@tanstack/react-query";
import { queryRetry, queryRetryDelay } from "./rate-limit";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: queryRetry,
        retryDelay: (failureCount, error) => queryRetryDelay(failureCount, error),
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/** Stable query keys for the seven RF-1 operations' cached reads. */
export const queryKeys = {
  activeContext: ["activeContext"] as const,
} as const;
