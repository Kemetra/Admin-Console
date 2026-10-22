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

type Context = ReturnType<typeof useActiveContextValue>["context"];

interface View {
  state: SupportSessionState | null;
  remainingMs: number;
}

function describeSession(input: {
  session: SupportSessionSummary | null;
  now: number;
  refusedExpired: boolean;
  capStamp: string | null;
}): View {
  const { session, now, refusedExpired, capStamp } = input;
  if (!session) return { state: null, remainingMs: 0 };
  return {
    state: deriveSupportSessionState({
      session,
      now,
      refusedExpired,
      capRefused: capStamp === sessionStamp(session),
    }),
    remainingMs: remainingMs(session.expires_at, now),
  };
}

function tenantNameOf(context: Context, session: SupportSessionSummary): string | undefined {
  const tenant = context?.active_tenant;
  if (tenant?.id !== session.tenant_id) return undefined;
  return tenant.name;
}

export function useSupportSession(): SupportSessionController | null {
  const { context } = useActiveContextValue();
  const session = context?.support_session ?? null;

  const refusedExpired = useRefusedExpired(session);
  const now = useNow(session !== null);
  const actions = useSessionActions(session);
  const view = describeSession({ session, now, refusedExpired, capStamp: actions.capStamp });
  useReReadAtZero(session, view.state, refusedExpired);
  useTenantDataDrop(session, view.state);

  if (!session || !view.state) return null;
  return {
    session,
    state: view.state,
    remainingMs: view.remainingMs,
    tenantName: tenantNameOf(context, session),
    refusedExpired,
    renewedTo: actions.renewedStamp === session.expires_at ? actions.renewedStamp : null,
    pending: actions.pending,
    error: actions.error,
    renew: actions.renew,
    end: actions.end,
  };
}
