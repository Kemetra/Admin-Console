/**
 * RT-782 (RT-777 S3): opening a support session from the start drawer. One
 * request at a time (a second click or submit while one is in flight is
 * ignored), never retried, and each contract outcome maps to one effect:
 *
 *  - 201              → re-read the context (the bar appears), then `onOpened`
 *  - 404              → the single non-disclosing «not available» view
 *  - 409 already_member → the member view, which offers the normal switch
 *  - 429              → an in-drawer notice; the gate's countdown is on the button
 *  - 401              → re-read the context, which decides (refresh, then sign-in)
 *  - anything else, or no answer → an inline error naming the real cause
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import type { MessageKey } from "@/i18n";
import { openSupportSession } from "@/lib/support-session-queries";
import { useRef, useState } from "react";
import {
  type OpenOutcome,
  type StartDraft,
  type StartDraftErrors,
  buildOpenRequest,
  classifyOpen,
} from "./startSessionLogic";

export type StartView =
  | { kind: "form" }
  | { kind: "not-found"; requestId?: string }
  | { kind: "member" };

export interface StartNotice {
  variant: "danger" | "warning";
  messageKey: MessageKey;
  requestId?: string;
}

const NO_ANSWER: StartNotice = { variant: "danger", messageKey: "platform.start.error.failed" };

export function useStartSession(tenantId: string, onOpened: () => void) {
  const { refresh } = useActiveContextValue();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [view, setView] = useState<StartView>({ kind: "form" });
  const [errors, setErrors] = useState<StartDraftErrors>({});
  const [notice, setNotice] = useState<StartNotice | null>(null);

  const settle = async (outcome: OpenOutcome) => {
    switch (outcome.kind) {
      case "opened":
        await refresh();
        onOpened();
        return;
      case "not-found":
        setView({ kind: "not-found", requestId: outcome.requestId });
        return;
      case "already-member":
        setView({ kind: "member" });
        return;
      case "rate-limited":
        setNotice({ variant: "warning", messageKey: "platform.start.error.rateLimited" });
        return;
      case "unauthenticated":
        await refresh();
        return;
      default:
        setNotice({
          variant: "danger",
          messageKey: outcome.messageKey,
          requestId: outcome.requestId,
        });
    }
  };

  const submit = async (draft: StartDraft) => {
    if (inFlight.current) return;
    const built = buildOpenRequest(tenantId, draft);
    setErrors(built.ok ? {} : built.errors);
    setNotice(null);
    if (!built.ok) return;
    inFlight.current = true;
    setPending(true);
    try {
      await settle(classifyOpen(await openSupportSession(built.body)));
    } catch {
      // The request never got an answer: no session is assumed.
      setNotice(NO_ANSWER);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return { pending, view, errors, notice, submit };
}
