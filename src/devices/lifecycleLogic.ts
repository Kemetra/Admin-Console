/**
 * RT-372 pure helpers for the device lifecycle forms. No React, no fetch.
 *
 * The server decides what an action does (`impactDecision.ts`) and how a refusal
 * reads (`lifecycleFailure.ts`). This module holds what the forms themselves
 * need: which actions exist for a trust state, the revoke reasons an operator
 * can pick, operator-text validation and the request bodies. Helpers return
 * catalog message keys, never copy (RT-399).
 */
import type { MessageKey } from "@/i18n";
import type { RevokeReason } from "@/lib/device-queries";

// --- Which actions a device offers ---------------------------------------------

export type LifecycleActionId = "revoke" | "retire";

const ACTIONS_BY_TRUST: Readonly<Record<string, readonly LifecycleActionId[]>> = {
  active: ["revoke", "retire"],
  revoked: ["retire"],
};

/**
 * The actions that exist for a device in each trust state, from the lifecycle's
 * own shape: nothing un-revokes (D-Q5), a revoked device can still be retired,
 * and a retired device is closed out. This is availability, not a verdict:
 * whether an offered action may proceed is always the server's answer, and an
 * unknown trust state offers nothing.
 */
export function actionsFor(trustState: string): readonly LifecycleActionId[] {
  return Object.hasOwn(ACTIONS_BY_TRUST, trustState) ? ACTIONS_BY_TRUST[trustState] : [];
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
