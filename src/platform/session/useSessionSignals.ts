/**
 * RT-781 (RT-777 S2): the signals that move a support session out of `active`,
 * each a small hook so `useSupportSession` only composes them.
 *
 *  - `useNow`: a once-a-second clock; only the derived state and the displayed
 *    minutes change what renders.
 *  - `useRefusedExpired`: a tenant call refused with 403 `support_session_expired`
 *    (src/lib/support-session-expiry.ts) belongs to the session it was seen under,
 *    and re-reads the context once per refusal.
 *  - `useReReadAtZero`: the countdown reached zero before the server said so;
 *    re-read the context once per `expires_at`, with no polling.
 *  - `useTenantDataDrop`: when a session expires, ends or is replaced, no tenant
 *    data stays cached.
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { queryKeys } from "@/lib/query";
import {
  getSupportSessionExpiryState,
  subscribeSupportSessionExpiry,
} from "@/lib/support-session-expiry";
import { type QueryClient, QueryClientContext } from "@tanstack/react-query";
import { useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SupportSessionState } from "./supportSessionLogic";

/** Drops every cached read except the active context: no tenant data outlives the session. */
export function dropTenantData(qc: QueryClient | undefined): void {
  qc?.removeQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.activeContext[0] });
}

export function useNow(enabled: boolean): number {
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

/** True when a tenant call was refused with 403 `support_session_expired` under this session. */
export function useRefusedExpired(sessionId: string | null): boolean {
  const { refresh } = useActiveContextValue();
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const expiry = useSyncExternalStore(
    subscribeSupportSessionExpiry,
    getSupportSessionExpiryState,
    getSupportSessionExpiryState,
  );
  // The baseline moves with the session id, so an old refusal never expires a new session.
  const baseline = useRef({ id: sessionId, seq: expiry.seq });
  if (baseline.current.id !== sessionId) baseline.current = { id: sessionId, seq: expiry.seq };

  const handledSeq = useRef(expiry.seq);
  useEffect(() => {
    if (expiry.seq === handledSeq.current) return;
    handledSeq.current = expiry.seq;
    void refreshRef.current();
  }, [expiry.seq]);

  return sessionId !== null && expiry.seq > baseline.current.seq;
}

/** Re-reads the context once when the local countdown, not the server, ended the session. */
export function useReReadAtZero(
  session: { status: string; id: string; expires_at: string } | null,
  state: SupportSessionState | null,
  refusedExpired: boolean,
): void {
  const { refresh } = useActiveContextValue();
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const reReadFor = useRef<string | null>(null);

  const stamp = session ? `${session.id}|${session.expires_at}` : null;
  // A refusal already re-reads the context; a server `expired` needs no re-read.
  const localOnly = state === "expired" && session?.status !== "expired" && !refusedExpired;
  useEffect(() => {
    if (!localOnly || stamp === null || reReadFor.current === stamp) return;
    reReadFor.current = stamp;
    void refreshRef.current();
  }, [localOnly, stamp]);
}

export function useTenantDataDrop(sessionId: string | null, state: SupportSessionState | null) {
  const qc = useContext(QueryClientContext);
  const previousId = useRef(sessionId);
  useEffect(() => {
    if (previousId.current !== null && previousId.current !== sessionId) dropTenantData(qc);
    previousId.current = sessionId;
  }, [sessionId, qc]);
  useEffect(() => {
    if (state === "expired") dropTenantData(qc);
  }, [state, qc]);
}
