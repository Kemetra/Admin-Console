/**
 * 401 reactive-refresh interceptor (T009, OQ-2, Scenario S5).
 *
 * RF-1 does NOT proactively refresh on a timer or focus. Instead, when any
 * consumed call returns 401, we attempt `refreshSession` exactly once and
 * retry the original request. If the refresh itself fails, we clear cached
 * context and signal a redirect to SF-1 (FR-003-004: rendering backend truth,
 * not a frontend authorization decision).
 *
 * This module is pure orchestration logic — no React, no fetch — so it is
 * unit-testable in isolation. The concrete `refreshSession` (op #3) and the
 * cache-clear/redirect side effect are injected by the caller.
 */

/** Minimal shape we care about from any consumed response. */
export interface MaybeUnauthorized {
  status: number;
}

export interface AuthRetryDeps {
  /** Calls `refreshSession` (op #3). Resolves `{ ok: true }` on a renewed session. */
  refreshSession: () => Promise<{ ok: boolean }>;
  /** Side effect when the session cannot be renewed: clear cache + redirect to SF-1. */
  onSessionLost: () => void;
}

/**
 * Wraps a request thunk with the reactive-refresh-once behavior. Concurrent
 * 401s share a single in-flight refresh (coalesced) so we never fire more
 * than one `refreshSession` for a burst of expired calls.
 */
export function createAuthRetry(deps: AuthRetryDeps) {
  let inFlightRefresh: Promise<{ ok: boolean }> | null = null;

  function refreshOnce(): Promise<{ ok: boolean }> {
    inFlightRefresh ??= deps.refreshSession().finally(() => {
      inFlightRefresh = null;
    });
    return inFlightRefresh;
  }

  return async function withAuthRetry<T extends MaybeUnauthorized>(
    request: () => Promise<T>,
  ): Promise<T> {
    const first = await request();
    if (first.status !== 401) {
      return first;
    }

    const refreshed = await refreshOnce();
    if (!refreshed.ok) {
      deps.onSessionLost();
      return first;
    }

    return request();
  };
}
