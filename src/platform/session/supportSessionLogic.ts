/**
 * RT-781 (RT-777 S2): pure support-session rules, no React and no network.
 *
 * The contract has two server states, `active` and `expired` (`ended` is never
 * returned to the Console). The bar shows four. Two are DERIVED here and say so:
 *
 *  - `expiring`: a UI threshold, `EXPIRING_THRESHOLD_MS` before `expires_at`
 *    (design frame 22). Not a contract state.
 *  - `cap_reached`: `expires_at >= renewal_cap_at`, so a renewal cannot move
 *    `expires_at` later. The contract also refuses a renewal at the auth
 *    session's absolute expiry, which the client cannot see: a renew 409
 *    `support_session_renewal_cap_reached` forces this state too.
 *
 * Precedence: expired > cap_reached > expiring > active. The server's
 * `status: expired` always wins, and so does a tenant call refused with 403
 * `support_session_expired`.
 */
import type { components } from "@/generated/schema";
import type { MessageKey } from "@/i18n";

export type SupportSessionSummary = components["schemas"]["SupportSessionSummary"];

/** Design frame 22: the warning shows when five minutes or less remain. */
export const EXPIRING_THRESHOLD_MS = 5 * 60 * 1000;

export type SupportSessionState = "active" | "expiring" | "expired" | "cap_reached";

export interface DeriveInput {
  session: Pick<SupportSessionSummary, "status" | "expires_at" | "renewal_cap_at">;
  now: number;
  /** A tenant call was refused with 403 `support_session_expired`. */
  refusedExpired?: boolean;
  /** A renew was refused with 409 `support_session_renewal_cap_reached`. */
  capRefused?: boolean;
}

/** Epoch ms of an ISO instant; an unparseable value counts as already past (fail closed). */
function instant(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

export function remainingMs(expiresAt: string, now: number): number {
  return Math.max(0, instant(expiresAt) - now);
}

function isExpired({ session, now, refusedExpired }: DeriveInput): boolean {
  if (refusedExpired) return true;
  return session.status === "expired" || remainingMs(session.expires_at, now) <= 0;
}

function isCapReached({ session, capRefused }: DeriveInput): boolean {
  return Boolean(capRefused) || instant(session.expires_at) >= instant(session.renewal_cap_at);
}

export function deriveSupportSessionState(input: DeriveInput): SupportSessionState {
  if (isExpired(input)) return "expired";
  if (isCapReached(input)) return "cap_reached";
  const left = remainingMs(input.session.expires_at, input.now);
  return left <= EXPIRING_THRESHOLD_MS ? "expiring" : "active";
}

/** Whole minutes left, rounded up, so one minute shows until the last second. */
export function remainingMinutes(ms: number): number {
  return Math.ceil(ms / 60_000);
}

/** Identifies one `expires_at` of one session: a cap refusal or a renewal applies to it only. */
export function sessionStamp(session: Pick<SupportSessionSummary, "id" | "expires_at">): string {
  return `${session.id}|${session.expires_at}`;
}

// --- Renew / end outcomes (codes taken from the pinned contract) ------------

export type ActionOutcome =
  /** 200. */
  | { kind: "done" }
  /** Renew 409 `support_session_renewal_cap_reached`. */
  | { kind: "cap" }
  /** Renew 409 `support_session_expired`. */
  | { kind: "expired" }
  /** 409 `support_session_absent`: the session is already gone. */
  | { kind: "gone" }
  /** 429: the shared banner owns it; the action is never retried. */
  | { kind: "rate-limited" }
  /** 401: the context read decides (refresh, then sign-in). */
  | { kind: "unauthenticated" }
  /** 403 `forbidden` / `origin_rejected`, 400, 5xx and anything unexpected: an inline error. */
  | { kind: "failed"; messageKey: MessageKey; requestId?: string };

interface ActionResult {
  status: number;
  error?: { error?: { code?: string; request_id?: string } };
}

function codeOf(result: ActionResult): string | undefined {
  return result.error?.error?.code;
}

function failed(result: ActionResult): ActionOutcome {
  const code = codeOf(result);
  let messageKey: MessageKey = "platform.session.error.failed";
  if (result.status === 403) {
    messageKey =
      code === "origin_rejected"
        ? "platform.session.error.originRejected"
        : "platform.session.error.forbidden";
  }
  return { kind: "failed", messageKey, requestId: result.error?.error?.request_id };
}

function common(result: ActionResult): ActionOutcome | null {
  if (result.status === 200) return { kind: "done" };
  if (result.status === 429) return { kind: "rate-limited" };
  if (result.status === 401) return { kind: "unauthenticated" };
  if (result.status === 409 && codeOf(result) === "support_session_absent") {
    return { kind: "gone" };
  }
  return null;
}

/** `renewSupportSession`: 200, 401, 403, 409 (absent, expired, cap reached), 429, 500. */
export function classifyRenew(result: ActionResult): ActionOutcome {
  const shared = common(result);
  if (shared) return shared;
  if (result.status === 409) {
    const code = codeOf(result);
    if (code === "support_session_renewal_cap_reached") return { kind: "cap" };
    if (code === "support_session_expired") return { kind: "expired" };
  }
  return failed(result);
}

/** `endSupportSession`: 200, 401, 403, 409 (absent: already ended), 429, 500. */
export function classifyEnd(result: ActionResult): ActionOutcome {
  return common(result) ?? failed(result);
}
