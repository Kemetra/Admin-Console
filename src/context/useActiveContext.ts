import { createAuthRetry } from "@/lib/auth-interceptor";
import {
  clearActiveStore,
  getActiveContext,
  refreshSession,
  switchActiveStore,
  switchActiveTenant,
} from "@/lib/client";
import { queryKeys } from "@/lib/query";
/**
 * Active-context hook (SF-3, T014-T016). The read-only projection of the
 * server-resolved context (FR-003-005). `getActiveContext` is the source of
 * truth; the three mutators change it backend-side, then we invalidate the
 * context query so it re-fetches. No optimistic local mutation.
 *
 * A tenant switch clears the store backend-side (FR-003-006); because we
 * re-fetch rather than patch, the dropped store is reflected automatically by
 * the next `getActiveContext` payload.
 *
 * The context fetch runs through the 401 reactive-refresh interceptor (T009):
 * a 401 triggers `refreshSession` once + retry; if that still 401s the session
 * is lost (S5). The lost state is encoded in the query RESULT (not a ref), so
 * React re-renders and the guard routes to SF-1. Rendering of backend truth,
 * not a frontend authorization decision (FR-003-004).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

type ContextData = NonNullable<Awaited<ReturnType<typeof getActiveContext>>["data"]>;
type ContextResult = { kind: "context"; data: ContextData | null } | { kind: "session-lost" };

export interface ActiveContextValue {
  context: ContextData | null | undefined;
  isLoading: boolean;
  /** True when the context fetch 401'd AND the reactive refresh also failed (S5). */
  sessionLost: boolean;
  /** memberships.length === 0 → no-access (S7); used by SF-1/SF-2 branching. */
  membershipCount: number;
  switchTenant: (tenantId: string) => Promise<void>;
  switchStore: (storeId: string) => Promise<void>;
  clearStore: () => Promise<void>;
  /** Re-fetch the context, e.g. after sign-in replaces a signed-out `session-lost` (RT-343). */
  refresh: () => Promise<void>;
}

export function useActiveContext(): ActiveContextValue {
  const qc = useQueryClient();

  // One interceptor instance per hook lifetime; coalesces concurrent 401s.
  const withAuthRetry = useRef(
    createAuthRetry({
      refreshSession: async () => {
        const res = await refreshSession();
        return { ok: res.status >= 200 && res.status < 300 };
      },
      // Don't clear the cache here: this fires DURING the context query's own
      // execution, and clearing would re-trigger it in a loop. The session-lost
      // result drives the redirect; the sign-in route starts a fresh session.
      onSessionLost: () => {},
    }),
  ).current;

  const query = useQuery<ContextResult>({
    queryKey: queryKeys.activeContext,
    queryFn: async () => {
      const res = await withAuthRetry(() => getActiveContext());
      if (res.status === 401) {
        return { kind: "session-lost" };
      }
      return { kind: "context", data: res.data ?? null };
    },
    retry: false,
  });

  // RT-343: cancel first. A fetch still in flight with no data yet (e.g. the
  // signed-out one started on /signin) would otherwise be reused by the
  // invalidation and land its stale 401 after sign-in.
  const invalidate = async () => {
    await qc.cancelQueries({ queryKey: queryKeys.activeContext });
    await qc.invalidateQueries({ queryKey: queryKeys.activeContext });
  };

  const tenant = useMutation({
    mutationFn: (tenantId: string) => switchActiveTenant(tenantId),
    onSuccess: invalidate,
  });
  const store = useMutation({
    mutationFn: (storeId: string) => switchActiveStore(storeId),
    onSuccess: invalidate,
  });
  const clear = useMutation({
    mutationFn: () => clearActiveStore(),
    onSuccess: invalidate,
  });

  const result = query.data;
  const sessionLost = result?.kind === "session-lost";
  const context = result?.kind === "context" ? result.data : undefined;

  return {
    context,
    isLoading: query.isLoading,
    sessionLost,
    membershipCount: context?.memberships?.length ?? 0,
    switchTenant: async (tenantId) => {
      await tenant.mutateAsync(tenantId);
    },
    switchStore: async (storeId) => {
      await store.mutateAsync(storeId);
    },
    clearStore: async () => {
      await clear.mutateAsync();
    },
    refresh: async () => {
      await invalidate();
    },
  };
}
