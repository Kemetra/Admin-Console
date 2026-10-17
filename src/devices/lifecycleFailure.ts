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

const BY_STATUS: Readonly<Record<number, Make>> = {
  400: plain("validation"),
  401: plain("session"),
  403: forbidden,
  404: plain("not-found"),
  409: conflict,
  422: (code, error) => ({ kind: "unmet", code, ...idOf(error) }),
};

export function classifyMutationFailure({ status, error }: WrapperFailure): MutationFailure {
  const code = (error as Envelope | undefined)?.error?.code ?? "";
  return (BY_STATUS[status] ?? plain("generic"))(code, error);
}

/** The server's correlation id when its refusal carried one. */
export function requestIdOfFailure(failure: MutationFailure): string | undefined {
  return "requestId" in failure ? failure.requestId : undefined;
}

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
  return KIND_KEYS[failure.kind];
}

/** Whether the refusal is a verdict the server re-decided: the preview must be replaced or asked again. */
export function isReDecided(failure: MutationFailure): boolean {
  return failure.kind === "conflict" || failure.kind === "forbidden-recovery";
}
