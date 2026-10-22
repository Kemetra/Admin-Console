/**
 * RT-781 (RT-777 S2): the support session as the shells see it. Reads
 * `getActiveContext.support_session` (null for a member-entered tenant, OQ-10,
 * so nothing renders), derives the bar state from the SERVER `expires_at`, and
 * exposes renew and end. The signals that end a session early live in
 * useSessionSignals, the two operations in useSessionActions.
 *
 * Mutations are never retried. A 429 leaves the banner to say so; the actions
 * stay disabled while a Retry-After runs (GatedButton).
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import {
  type SupportSessionState,
  type SupportSessionSummary,
  deriveSupportSessionState,
  remainingMs,
  sessionStamp,
} from "./supportSessionLogic";
import { type SupportSessionError, useSessionActions } from "./useSessionActions";
import { useNow, useReReadAtZero, useRefusedExpired, useTenantDataDrop } from "./useSessionSignals";

export { PLATFORM_HOME, type SupportSessionError } from "./useSessionActions";

export interface SupportSessionController {
  session: SupportSessionSummary;
  state: SupportSessionState;
  remainingMs: number;
  /** Name of the tenant the session is in, when the active tenant is that tenant. */
  tenantName?: string;
  /** A tenant call was refused with 403 `support_session_expired` under this session. */
  refusedExpired: boolean;
  /** `expires_at` of the last successful renewal, while it is still current. */
  renewedTo: string | null;
  pending: "renew" | "end" | null;
  error: SupportSessionError | null;
  renew: () => Promise<void>;
  end: () => Promise<void>;
}

export function useSupportSession(): SupportSessionController | null {
  const { context } = useActiveContextValue();
  const session = context?.support_session ?? null;
  const sessionId = session?.id ?? null;

  const refusedExpired = useRefusedExpired(sessionId);
  const now = useNow(session !== null);
  const actions = useSessionActions(session);

  const state = session
    ? deriveSupportSessionState({
        session,
        now,
        refusedExpired,
        capRefused: actions.capStamp === sessionStamp(session),
      })
    : null;
  useReReadAtZero(session, state, refusedExpired);
  useTenantDataDrop(sessionId, state);

  if (!session || !state) return null;
  return {
    session,
    state,
    remainingMs: remainingMs(session.expires_at, now),
    tenantName:
      context?.active_tenant?.id === session.tenant_id ? context.active_tenant?.name : undefined,
    refusedExpired,
    renewedTo: actions.renewedStamp === session.expires_at ? actions.renewedStamp : null,
    pending: actions.pending,
    error: actions.error,
    renew: actions.renew,
    end: actions.end,
  };
}
