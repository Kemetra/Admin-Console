/**
 * RT-372 pure helpers for the device lifecycle flows. No React, no fetch.
 *
 * The server decides. `decideImpact` only reads the preview's `verdict`,
 * `blockCode` and `requires` and says what the form may offer; it never looks
 * at the device's trust state, the role or the open shift to reach a verdict of
 * its own. The contract's extension policy is fail-safe: an unknown verdict is
 * `blocked`, an unknown block code is shown as a refusal that cannot be
 * resolved, and an unknown requirement is unmet. Helpers return catalog message
 * keys, never copy (RT-399).
 */
import type { MessageKey } from "@/i18n";
import type { RevokeReason } from "@/lib/device-queries";
import { requestIdOf } from "./deviceLogic";

// --- Which actions a device offers ---------------------------------------------

export type LifecycleActionId = "revoke" | "replace" | "move" | "retire";

/**
 * The actions that exist for a device in each trust state, from the lifecycle's
 * own shape: nothing un-revokes (D-Q5), a revoked device can still be replaced,
 * moved or retired (the replacement after a security revoke is the point),
 * and a retired device is closed out. This is availability, not a verdict:
 * whether an offered action may proceed is always the server's answer, and an
 * unknown trust state offers nothing.
 */
export function actionsFor(trustState: string): readonly LifecycleActionId[] {
  switch (trustState) {
    case "active":
      return ["revoke", "replace", "move", "retire"];
    case "revoked":
      return ["replace", "move", "retire"];
    default:
      return [];
  }
}

// --- Revoke reasons ----------------------------------------------------------

export interface ReasonGroup {
  id: "security" | "other";
  legendKey: MessageKey;
  reasons: readonly RevokeReason[];
}

/**
 * The reasons an operator can pick for a revoke (RT-287 D-Q3). `replaced`,
 * `moved` and `retired` are recorded by the Replace, Move and Retire flows
 * themselves, so they are not offered here: a revoke with those reasons would
 * state a replacement or retirement that did not happen. The security class is
 * its own group, set apart by structure and wording, never by colour alone.
 */
export const REVOKE_REASON_GROUPS: readonly ReasonGroup[] = [
  {
    id: "security",
    legendKey: "devices.revoke.group.security",
    reasons: ["lost", "stolen", "suspected_compromise"],
  },
  {
    id: "other",
    legendKey: "devices.revoke.group.other",
    reasons: ["hardware_failure", "admin_error", "other"],
  },
];

// --- The server's verdict ------------------------------------------------------

/** The shape `decideImpact` reads; wider than the contract so unknown values survive. */
export interface ImpactLike {
  verdict: string;
  blockCode: string | null;
  requires: readonly string[];
}

export type ImpactDecision =
  | {
      kind: "ready";
      /** The open shift becomes the unresolved custody exception. */
      custody: boolean;
      needs: { note: boolean; acknowledge: boolean };
    }
  | { kind: "blocked"; blockCode: string | null; known: boolean }
  | { kind: "forbidden" }
  | { kind: "no_change" };

const BLOCK_CODES: ReadonlySet<string> = new Set([
  "unresolved_cash_session",
  "unresolved_custody_exception",
  "device_retired",
]);

/**
 * `owner_or_tenant_admin` is a fact about the caller that the verdict already
 * folded in (`forbidden_recovery` otherwise), so on a proceeding verdict it is
 * met. `note` and `acknowledge_custody_exception` are the request's inputs.
 */
const KNOWN_REQUIREMENTS: ReadonlySet<string> = new Set([
  "owner_or_tenant_admin",
  "note",
  "acknowledge_custody_exception",
]);

const UNKNOWN: ImpactDecision = { kind: "blocked", blockCode: null, known: false };

export function decideImpact(preview: ImpactLike): ImpactDecision {
  switch (preview.verdict) {
    case "no_change":
      return { kind: "no_change" };
    case "forbidden_recovery":
      return { kind: "forbidden" };
    case "blocked":
      return {
        kind: "blocked",
        blockCode: preview.blockCode,
        known: preview.blockCode !== null && BLOCK_CODES.has(preview.blockCode),
      };
    case "allowed":
    case "allowed_with_custody_exception": {
      if (!preview.requires.every((r) => KNOWN_REQUIREMENTS.has(r))) return UNKNOWN;
      return {
        kind: "ready",
        custody: preview.verdict === "allowed_with_custody_exception",
        needs: {
          note: preview.requires.includes("note"),
          acknowledge: preview.requires.includes("acknowledge_custody_exception"),
        },
      };
    }
    default:
      return UNKNOWN;
  }
}

/** Why a blocked action is refused, and what to do. An unknown code offers nothing. */
export function blockedMessageKey(code: string | null): MessageKey {
  switch (code) {
    case "unresolved_cash_session":
      return "devices.impact.blocked.cashSession";
    case "unresolved_custody_exception":
      return "devices.impact.blocked.custodyException";
    case "device_retired":
      return "devices.impact.blocked.retired";
    default:
      return "devices.impact.blocked.unknown";
  }
}

// --- Operator text ---------------------------------------------------------------

export const OPERATOR_TEXT_MAX = 500;

export type OperatorTextProblem = "required" | "tooLong" | "invalid";

const TEXT_PROBLEM_KEYS: Record<OperatorTextProblem, MessageKey> = {
  required: "devices.text.required",
  tooLong: "devices.text.tooLong",
  invalid: "devices.text.invalid",
};

export function textProblemKey(problem: OperatorTextProblem): MessageKey {
  return TEXT_PROBLEM_KEYS[problem];
}

/**
 * The revoke note and the retire reason: 1..500 characters, not blank, no NUL
 * (the contract's patterns). This is form validation, not a consequence: the
 * server re-checks everything.
 */
export function validateOperatorText(value: string, required: boolean): OperatorTextProblem | null {
  if (value.includes("\u0000")) return "invalid";
  if (value.trim() === "") return required ? "required" : null;
  return value.length > OPERATOR_TEXT_MAX ? "tooLong" : null;
}

// --- Request bodies ------------------------------------------------------------

export interface RevokeDraft {
  reason: RevokeReason;
  note: string;
  acknowledge: boolean;
}

export interface RevokeBody {
  reason: RevokeReason;
  note?: string;
  acknowledgeCustodyException?: true;
}

export function buildRevokeBody({ reason, note, acknowledge }: RevokeDraft): RevokeBody {
  const trimmed = note.trim();
  return {
    reason,
    ...(trimmed === "" ? {} : { note: trimmed }),
    ...(acknowledge ? { acknowledgeCustodyException: true as const } : {}),
  };
}

// --- Mutation answers ------------------------------------------------------------

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
  | { kind: "in-progress"; retryAfterSec?: number }
  | { kind: "generic"; requestId?: string };

interface Envelope {
  error?: { code?: string; details?: unknown };
}

function codeOf(error: unknown): string {
  return (error as Envelope | undefined)?.error?.code ?? "";
}

function withRequestId<T extends object>(kind: T, error: unknown): T & { requestId?: string } {
  const requestId = requestIdOf(error);
  return requestId === undefined ? kind : { ...kind, requestId };
}

/**
 * What a refused lifecycle mutation means. The 409's `error.details` is the
 * preview the server computed under its lock; it is optional on the revoke (a
 * server from before RT-366 omits it), so the caller falls back to a fresh
 * preview when it is absent.
 */
export function classifyMutationFailure({ status, error }: WrapperFailure): MutationFailure {
  const code = codeOf(error);
  switch (status) {
    case 409: {
      const details = (error as Envelope | undefined)?.error?.details;
      return withRequestId(
        { kind: "conflict" as const, code, ...(details ? { preview: details } : {}) },
        error,
      );
    }
    case 403:
      return code === "recovery_revoke_forbidden"
        ? withRequestId({ kind: "forbidden-recovery" as const }, error)
        : withRequestId({ kind: "generic" as const }, error);
    case 422:
      return withRequestId({ kind: "unmet" as const, code }, error);
    case 404:
      return withRequestId({ kind: "not-found" as const }, error);
    case 400:
      return withRequestId({ kind: "validation" as const }, error);
    case 401:
      return withRequestId({ kind: "session" as const }, error);
    case 425: {
      // The platform idempotency interceptor's own body, not the canonical envelope.
      const retry = (error as { retryAfterSec?: unknown } | undefined)?.retryAfterSec;
      return {
        kind: "in-progress" as const,
        ...(typeof retry === "number" ? { retryAfterSec: retry } : {}),
      };
    }
    default:
      return withRequestId({ kind: "generic" as const }, error);
  }
}

/** The server's correlation id when its refusal carried one (a 425 does not). */
export function requestIdOfFailure(failure: MutationFailure): string | undefined {
  return "requestId" in failure ? failure.requestId : undefined;
}

const CONFLICT_KEYS: Record<string, MessageKey> = {
  replacement_already_pending: "devices.issue.error.alreadyPending",
  device_already_replaced: "devices.issue.error.alreadyReplaced",
  idempotency_key_conflict: "devices.issue.error.keyConflict",
  pairing_code_used: "devices.codes.error.used",
};

/**
 * The message a refusal reads as. A 409 is one of two things: a verdict the
 * server re-decided (`unresolved_cash_session`, `device_retired`: the situation
 * changed, its fresh preview is shown) or a refusal that has its own words
 * (a replacement already pending, an idempotency conflict, a used code).
 */
export function noticeKeyFor(failure: MutationFailure): MessageKey {
  switch (failure.kind) {
    case "conflict":
      return CONFLICT_KEYS[failure.code] ?? "devices.flow.error.changed";
    case "forbidden-recovery":
      return "devices.impact.verdict.forbidden";
    case "unmet":
      return failure.code === "recovery_note_required"
        ? "devices.flow.error.unmetNote"
        : "devices.flow.error.unmetAcknowledge";
    case "not-found":
      return "devices.flow.error.notFound";
    case "validation":
      return "devices.flow.error.validation";
    case "session":
      return "devices.flow.error.session";
    case "in-progress":
      return "devices.issue.error.inProgress";
    default:
      return "devices.flow.error.generic";
  }
}

/** Whether a 409 is a verdict the server re-decided (its fresh preview replaces the old one). */
export function isReDecided(failure: MutationFailure): boolean {
  return failure.kind === "conflict" && !(failure.code in CONFLICT_KEYS);
}
