/**
 * RT-372 — What a refused lifecycle mutation means, and how it reads. A 409
 * carries the preview the server computed under its lock as `error.details`
 * (optional on the revoke: a server from before RT-366 omits it, so the caller
 * asks for a fresh preview instead). No React, no fetch.
 */
import type { MessageKey } from "@/i18n";
import { requestIdOf } from "./deviceLogic";

export interface WrapperFailure {
  status: number;
  error?: unknown;
}

export type MutationFailure =
  | { kind: "conflict"; code: string; preview?: unknown; requestId?: string }
  | { kind: "forbidden-recovery"; requestId?: string }
  | { kind: "unmet"; code: string; requestId?: string }
  | { kind: "not-found"; requestId?: string }
  | { kind: "validation"; requestId?: string }
  | { kind: "session"; requestId?: string }
  /** 425: the platform idempotency interceptor is still on an earlier request. */
  | { kind: "in-progress"; retryAfterSec?: number }
  /** A pairing code was asked for and no answer came back: it may or may not exist. */
  | { kind: "no-answer" }
  | { kind: "generic"; requestId?: string };

interface Envelope {
  error?: { code?: string; details?: unknown };
}

type Make = (code: string, error: unknown) => MutationFailure;

/** The correlation id, when the refusal carried one. */
function idOf(error: unknown): { requestId?: string } {
  const requestId = requestIdOf(error);
  return requestId === undefined ? {} : { requestId };
}

function conflict(code: string, error: unknown): MutationFailure {
  const details = (error as Envelope | undefined)?.error?.details;
  return { kind: "conflict", code, ...(details ? { preview: details } : {}), ...idOf(error) };
}

/** A 403 is the role refusal of a recovery revoke, or anything else (a rejected origin): generic. */
function forbidden(code: string, error: unknown): MutationFailure {
  return code === "recovery_revoke_forbidden"
    ? { kind: "forbidden-recovery", ...idOf(error) }
    : { kind: "generic", ...idOf(error) };
}

const plain =
  (kind: "not-found" | "validation" | "session" | "generic"): Make =>
  (_code, error) => ({ kind, ...idOf(error) });

/** The idempotency interceptor's own body (not the canonical envelope) carries the wait. */
function inProgress(_code: string, error: unknown): MutationFailure {
  const retry = (error as { retryAfterSec?: unknown } | undefined)?.retryAfterSec;
  return { kind: "in-progress", ...(typeof retry === "number" ? { retryAfterSec: retry } : {}) };
}

const BY_STATUS: Readonly<Record<number, Make>> = {
  400: plain("validation"),
  401: plain("session"),
  403: forbidden,
  404: plain("not-found"),
  409: conflict,
  422: (code, error) => ({ kind: "unmet", code, ...idOf(error) }),
  425: inProgress,
};

export function classifyMutationFailure({ status, error }: WrapperFailure): MutationFailure {
  const code = (error as Envelope | undefined)?.error?.code ?? "";
  return (BY_STATUS[status] ?? plain("generic"))(code, error);
}

/** The server's correlation id when its refusal carried one. */
export function requestIdOfFailure(failure: MutationFailure): string | undefined {
  return "requestId" in failure ? failure.requestId : undefined;
}

/**
 * The 409s that are not a verdict the server re-decided: each has its own words,
 * and none carries a preview. (`unresolved_cash_session` and `device_retired` do:
 * the situation changed, and the fresh preview is shown.)
 */
const OWN_CONFLICT_KEYS: Readonly<Record<string, MessageKey>> = {
  replacement_already_pending: "devices.issue.error.alreadyPending",
  device_already_replaced: "devices.issue.error.alreadyReplaced",
  idempotency_key_conflict: "devices.issue.error.keyConflict",
  pairing_code_used: "devices.codes.error.used",
};

const UNMET_KEYS: Readonly<Record<string, MessageKey>> = {
  recovery_note_required: "devices.flow.error.unmetNote",
  custody_exception_not_acknowledged: "devices.flow.error.unmetAcknowledge",
};

const KIND_KEYS: Readonly<Record<MutationFailure["kind"], MessageKey>> = {
  conflict: "devices.flow.error.changed",
  "forbidden-recovery": "devices.impact.verdict.forbidden",
  // An unrecognised 422 is a rejected value; only the named codes above say more.
  unmet: "devices.flow.error.validation",
  "not-found": "devices.flow.error.notFound",
  validation: "devices.flow.error.validation",
  session: "devices.flow.error.session",
  "in-progress": "devices.issue.error.inProgress",
  "no-answer": "devices.issue.error.unknownOutcome",
  generic: "devices.flow.error.generic",
};

/**
 * The message a refusal reads as. A 409 is a verdict the server re-decided
 * (`unresolved_cash_session`, `device_retired`: the situation changed, and its
 * fresh preview is shown); a 422 names the first unmet requirement.
 */
export function noticeKeyFor(failure: MutationFailure): MessageKey {
  if (failure.kind === "unmet" && Object.hasOwn(UNMET_KEYS, failure.code)) {
    return UNMET_KEYS[failure.code];
  }
  if (failure.kind === "conflict" && Object.hasOwn(OWN_CONFLICT_KEYS, failure.code)) {
    return OWN_CONFLICT_KEYS[failure.code];
  }
  return KIND_KEYS[failure.kind];
}

/** Refusals after which the outcome may be unknown or a stray code may exist: point at the pending codes. */
export function pointsAtCodes(failure: MutationFailure): boolean {
  if (failure.kind === "in-progress" || failure.kind === "no-answer") return true;
  return (
    failure.kind === "conflict" &&
    (failure.code === "idempotency_key_conflict" || failure.code === "replacement_already_pending")
  );
}

/** The fresh preview a re-deciding refusal carries (a 409's `error.details`), when it has one. */
export function freshPreviewOf(failure: MutationFailure): unknown {
  return failure.kind === "conflict" && isReDecided(failure) ? failure.preview : undefined;
}

/** Whether the refusal is a verdict the server re-decided: the preview must be replaced or asked again. */
export function isReDecided(failure: MutationFailure): boolean {
  if (failure.kind === "conflict") return !Object.hasOwn(OWN_CONFLICT_KEYS, failure.code);
  return failure.kind === "forbidden-recovery";
}
