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
 *
 * RT-621: a 429 is never a lost session. A 429 on the original request passes
 * straight through (only 401 refreshes), and a refresh that is itself refused
 * with 429 does NOT call `onSessionLost`: the caller gets a 429 result back and
 * shows the rate-limit state instead of the sign-in page.
 */

import { RATE_LIMITED_STATUS } from "./rate-limit";

/** Minimal shape we care about from any consumed response. */
export interface MaybeUnauthorized {
  status: number;
}

export interface AuthRetryDeps {
  /**
   * Calls `refreshSession` (op #3). Resolves `{ ok: true }` on a renewed session;
   * pass the refresh's `status` so a 429 is told apart from a lost session.
   */
  refreshSession: () => Promise<{ ok: boolean; status?: number }>;
  /** Side effect when the session cannot be renewed: clear cache + redirect to SF-1. */
  onSessionLost: () => void;
}

/**
 * Wraps a request thunk with the reactive-refresh-once behavior. Concurrent
 * 401s share a single in-flight refresh (coalesced) so we never fire more
 * than one `refreshSession` for a burst of expired calls.
 */
export function createAuthRetry(deps: AuthRetryDeps) {
  let inFlightRefresh: Promise<{ ok: boolean; status?: number }> | null = null;

  function refreshOnce(): Promise<{ ok: boolean; status?: number }> {
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
    if (refreshed.status === RATE_LIMITED_STATUS) {
      // Rate limited, not signed out: report the 429 so no caller reads the
      // surviving 401 as an expired session.
      return { ...first, status: RATE_LIMITED_STATUS };
    }
    if (!refreshed.ok) {
      deps.onSessionLost();
      return first;
    }

    return request();
  };
}
