/**
 * createInvitation 401-disambiguation (T007, FR-005-007, OQ-1) — the
 * make-or-break rule. Grounded in `src/lib/auth-interceptor.ts:32-60`:
 * `createAuthRetry` refreshes once on a 401 and calls `onSessionLost()` ONLY if
 * the refresh itself fails; on a successful refresh it re-issues and returns the
 * retried result.
 *
 * `createInvitation` is the only RF-5 op with a *second* 401 meaning ("No active
 * tenant", a precondition — the session is still valid). We wrap ONLY that call
 * with a fresh per-attempt `createAuthRetry` instance whose injected
 * `onSessionLost` flips a local `refreshFailed` flag. After the call resolves:
 *   - non-401            → ok (the caller classifies 4xx via classifyInviteOutcome)
 *   - 401 + refreshFailed → session-expired (the ONLY sign-out path)
 *   - 401 + !refreshFailed → precondition (refresh succeeded, retry still 401)
 *                            → route to the RF-1 scope chooser, never sign-out
 *
 * The flag is local to each run (no component ref), so a prior submit's state
 * never leaks into the next (advisor: per-attempt-local). We knowingly accept
 * that a precondition-401 burns one refresh round-trip (same tradeoff as RF-2's
 * OQ-4). RF-5 owns its interceptor instance; no RF-1 modification.
 *
 * `listMembers`/`updateMembership`/`revokeMembership` document no precondition
 * 401 and use the standard wrapper; the `listMembers` active-tenant precondition
 * is guarded BEFORE the call (route to chooser when active_tenant is null).
 */
import { type MaybeUnauthorized, createAuthRetry } from "@/lib/auth-interceptor";

export type InviteAuthOutcome<T extends MaybeUnauthorized> =
  | { kind: "ok"; result: T }
  | { kind: "session-expired" }
  | { kind: "precondition" };

/**
 * Run a `createInvitation` thunk through a fresh disambiguating interceptor.
 * Pure with respect to React; `invite` and `refreshSession` are injected so the
 * branches are unit-testable in isolation.
 */
export async function runInviteWithAuth<T extends MaybeUnauthorized>(
  invite: () => Promise<T>,
  refreshSession: () => Promise<{ ok: boolean; status?: number }>,
): Promise<InviteAuthOutcome<T>> {
  let refreshFailed = false;
  const withAuthRetry = createAuthRetry({
    refreshSession,
    onSessionLost: () => {
      refreshFailed = true;
    },
  });

  const result = await withAuthRetry(invite);

  if (result.status !== 401) {
    return { kind: "ok", result };
  }
  // A 401 survived the interceptor. If the refresh failed, onSessionLost fired
  // → genuine session expiry. If the refresh succeeded but the retry still 401s,
  // it is the "No active tenant" precondition.
  return refreshFailed ? { kind: "session-expired" } : { kind: "precondition" };
}
