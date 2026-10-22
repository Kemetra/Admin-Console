/**
 * RT-781 (RT-777 S2): renew and end. Each maps its contract outcome (see
 * `classifyRenew` / `classifyEnd`) to one effect and is never retried: a 429
 * leaves the banner to say so, a refused request shows an inline error, and a
 * request that never got an answer (offline, DNS, a dropped connection) shows
 * the same generic inline error instead of failing silently.
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import type { MessageKey } from "@/i18n";
import { endSupportSession, renewSupportSession } from "@/lib/support-session-queries";
import { QueryClientContext } from "@tanstack/react-query";
import { useContext, useState } from "react";
import { useNavigate } from "react-router";
import {
  type ActionOutcome,
  type SupportSessionSummary,
  classifyEnd,
  classifyRenew,
  sessionStamp,
} from "./supportSessionLogic";
import { dropTenantData } from "./useSessionSignals";

export const PLATFORM_HOME = "/platform/tenants";

export interface SupportSessionError {
  messageKey: MessageKey;
  requestId?: string;
}

type Action = "renew" | "end";

/** What each non-failed outcome does next: re-read the context, leave the session, or nothing. */
type Effect = "refresh" | "leave" | "none";
type Settled = Exclude<ActionOutcome["kind"], "failed">;

const RENEW_EFFECT: Record<Settled, Effect> = {
  done: "refresh",
  gone: "leave",
  cap: "refresh",
  expired: "refresh",
  unauthenticated: "refresh",
  "rate-limited": "none",
};

const END_EFFECT: Record<Settled, Effect> = {
  done: "leave",
  gone: "leave",
  cap: "none",
  expired: "none",
  unauthenticated: "refresh",
  "rate-limited": "none",
};

export function useSessionActions(session: SupportSessionSummary | null) {
  const qc = useContext(QueryClientContext);
  const navigate = useNavigate();
  const { refresh } = useActiveContextValue();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<SupportSessionError | null>(null);
  const [capStamp, setCapStamp] = useState<string | null>(null);
  const [renewedStamp, setRenewedStamp] = useState<string | null>(null);

  // The session is over: back to the directory, then re-read the (now tenant-less) context.
  const leave = async () => {
    navigate(PLATFORM_HOME, { replace: true });
    dropTenantData(qc);
    await refresh();
  };

  const showFailure = (outcome: Extract<ActionOutcome, { kind: "failed" }>) =>
    setError({ messageKey: outcome.messageKey, requestId: outcome.requestId });

  const apply = async (effect: Effect) => {
    if (effect === "leave") await leave();
    else if (effect === "refresh") await refresh();
  };

  const stampOfSession = session ? sessionStamp(session) : null;

  const settleRenew = async (outcome: ActionOutcome, expiresAt: string | undefined) => {
    if (outcome.kind === "failed") return showFailure(outcome);
    if (outcome.kind === "done") setRenewedStamp(expiresAt ?? null);
    if (outcome.kind === "cap") setCapStamp(stampOfSession);
    return apply(RENEW_EFFECT[outcome.kind]);
  };

  const settleEnd = async (outcome: ActionOutcome) => {
    if (outcome.kind === "failed") return showFailure(outcome);
    return apply(END_EFFECT[outcome.kind]);
  };

  const run = async (action: Action) => {
    if (pending) return;
    setPending(action);
    setError(null);
    try {
      if (action === "renew") {
        const res = await renewSupportSession();
        await settleRenew(classifyRenew(res), res.data?.expires_at);
      } else {
        await settleEnd(classifyEnd(await endSupportSession()));
      }
    } catch {
      // The request never got an answer: say so, rather than leave the operator guessing.
      setError({ messageKey: "platform.session.error.failed" });
    } finally {
      setPending(null);
    }
  };

  return {
    pending,
    error,
    capStamp,
    renewedStamp,
    renew: () => run("renew"),
    end: () => run("end"),
  };
}
