/**
 * RT-781 (RT-777 S2): the support session as the shells see it. Reads
 * `getActiveContext.support_session` (null for a member-entered tenant, OQ-10,
 * so nothing renders), derives the bar state from the SERVER `expires_at`, and
 * runs renew and end.
 *
 *  - The countdown ticks once a second, but only the state and the displayed
 *    minutes change what renders. At zero the bar shows expired and the context
 *    is re-read once, with no polling; the server `status` wins when it differs.
 *  - A tenant call refused with 403 `support_session_expired` (see
 *    src/lib/support-session-expiry.ts) switches to expired at once and re-reads
 *    the context. The refusal belongs to the session it was seen under.
 *  - No tenant data survives the session: when it expires, ends or is replaced,
 *    every query except the active context is dropped.
 *  - Mutations are never retried. A 429 leaves the banner to say so; the
 *    actions stay disabled while a Retry-After runs (GatedButton).
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import type { MessageKey } from "@/i18n";
import { queryKeys } from "@/lib/query";
import {
  getSupportSessionExpiryState,
  subscribeSupportSessionExpiry,
} from "@/lib/support-session-expiry";
import { endSupportSession, renewSupportSession } from "@/lib/support-session-queries";
import { type QueryClient, QueryClientContext } from "@tanstack/react-query";
import { useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router";
import {
  type ActionOutcome,
  type SupportSessionState,
  type SupportSessionSummary,
  classifyEnd,
  classifyRenew,
  deriveSupportSessionState,
  remainingMs,
  sessionStamp,
} from "./supportSessionLogic";

export const PLATFORM_HOME = "/platform/tenants";

export interface SupportSessionError {
  messageKey: MessageKey;
  requestId?: string;
}

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

/** Drops every cached read except the active context: no tenant data outlives the session. */
export function dropTenantData(qc: QueryClient | undefined): void {
  qc?.removeQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.activeContext[0] });
}

function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}

export function useSupportSession(): SupportSessionController | null {
  // Optional, like the rate-limit banner: a shell rendered without a query client still works.
  const qc = useContext(QueryClientContext);
  const navigate = useNavigate();
  const { context, refresh } = useActiveContextValue();
  const session = context?.support_session ?? null;
  const sessionId = session?.id ?? null;

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const expiry = useSyncExternalStore(
    subscribeSupportSessionExpiry,
    getSupportSessionExpiryState,
    getSupportSessionExpiryState,
  );
  // A refusal counts for the session it was seen under: the baseline moves with the id.
  const baseline = useRef({ id: sessionId, seq: expiry.seq });
  if (baseline.current.id !== sessionId) baseline.current = { id: sessionId, seq: expiry.seq };
  const refusedExpired = session !== null && expiry.seq > baseline.current.seq;

  const now = useNow(session !== null);
  const [capStamp, setCapStamp] = useState<string | null>(null);
  const [renewedStamp, setRenewedStamp] = useState<string | null>(null);
  const [pending, setPending] = useState<"renew" | "end" | null>(null);
  const [error, setError] = useState<SupportSessionError | null>(null);

  const state = session
    ? deriveSupportSessionState({
        session,
        now,
        refusedExpired,
        capRefused: capStamp === sessionStamp(session),
      })
    : null;
  const stamp = session ? sessionStamp(session) : null;

  // A refusal from a tenant call: re-read the context (server truth), once per refusal.
  const handledSeq = useRef(expiry.seq);
  useEffect(() => {
    if (expiry.seq === handledSeq.current) return;
    handledSeq.current = expiry.seq;
    void refreshRef.current();
  }, [expiry.seq]);

  // The countdown reached zero before the server said so: re-read once per expires_at.
  const reReadFor = useRef<string | null>(null);
  useEffect(() => {
    // A refusal already re-reads the context (above); a server `expired` needs no re-read.
    if (state !== "expired" || session?.status === "expired" || refusedExpired || stamp === null) {
      return;
    }
    if (reReadFor.current === stamp) return;
    reReadFor.current = stamp;
    void refreshRef.current();
  }, [state, session?.status, refusedExpired, stamp]);

  // Expiry or a replaced/ended session: nothing of the tenant stays cached.
  const previousId = useRef(sessionId);
  useEffect(() => {
    if (previousId.current !== null && previousId.current !== sessionId) dropTenantData(qc);
    previousId.current = sessionId;
  }, [sessionId, qc]);
  useEffect(() => {
    if (state === "expired") dropTenantData(qc);
  }, [state, qc]);

  if (!session || !state) return null;

  const settle = async (outcome: ActionOutcome, action: "renew" | "end", ok?: string) => {
    switch (outcome.kind) {
      case "done":
        if (action === "end") await leave();
        else {
          setRenewedStamp(ok ?? null);
          await refresh();
        }
        return;
      case "gone":
        await leave();
        return;
      case "cap":
        setCapStamp(sessionStamp(session));
        await refresh();
        return;
      case "expired":
      case "unauthenticated":
        await refresh();
        return;
      case "rate-limited":
        return;
      case "failed":
        setError({ messageKey: outcome.messageKey, requestId: outcome.requestId });
    }
  };

  // The session is over: back to the directory, then re-read the (now tenant-less) context.
  const leave = async () => {
    navigate(PLATFORM_HOME, { replace: true });
    dropTenantData(qc);
    await refresh();
  };

  const run = async (action: "renew" | "end") => {
    if (pending) return;
    setPending(action);
    setError(null);
    try {
      if (action === "renew") {
        const res = await renewSupportSession();
        const outcome = classifyRenew(res);
        await settle(outcome, "renew", res.data?.expires_at);
      } else {
        await settle(classifyEnd(await endSupportSession()), "end");
      }
    } finally {
      setPending(null);
    }
  };

  return {
    session,
    state,
    remainingMs: remainingMs(session.expires_at, now),
    tenantName:
      context?.active_tenant?.id === session.tenant_id ? context.active_tenant?.name : undefined,
    refusedExpired,
    renewedTo: renewedStamp !== null && renewedStamp === session.expires_at ? renewedStamp : null,
    pending,
    error,
    renew: () => run("renew"),
    end: () => run("end"),
  };
}
