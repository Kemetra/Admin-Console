/** RT-372 shared shapes of the lifecycle flow: what the operator has typed and what is wrong with it. */
import type { MessageKey } from "@/i18n";
import type { RevokeReason } from "@/lib/device-queries";
import {
  type MutationFailure,
  isReDecided,
  noticeKeyFor,
  pointsAtCodes,
  requestIdOfFailure,
} from "./lifecycleFailure";
import type { LifecycleActionId } from "./lifecycleLogic";
import { EMPTY_ISSUE_DRAFT, type IssueDraft, type IssueProblems } from "./pairingLogic";

export type FlowAction = LifecycleActionId;
export type Step = "details" | "review" | "done";

/** Replace and Move issue a pairing code; Revoke and Retire act on the device itself. */
export function isIssueAction(action: FlowAction): action is "replace" | "move" {
  return action === "replace" || action === "move";
}

export interface Draft {
  reason: RevokeReason | "";
  note: string;
  retireReason: string;
  acknowledge: boolean;
  confirmCodes: boolean;
  /** The pairing-code form of Replace and Move. */
  issue: IssueDraft;
}

/** A replace stays in the device's own store; a move picks another one. */
export function initialDraft(action: FlowAction, deviceStoreId: string): Draft {
  return {
    reason: "",
    note: "",
    retireReason: "",
    acknowledge: false,
    confirmCodes: false,
    issue: { ...EMPTY_ISSUE_DRAFT, storeId: action === "replace" ? deviceStoreId : "" },
  };
}

export interface Problems {
  reason?: MessageKey;
  note?: MessageKey;
  retireReason?: MessageKey;
  acknowledge?: MessageKey;
  codes?: MessageKey;
  /** Present only when the issue form has something wrong with it. */
  issue?: IssueProblems;
}

/** A banner above the review: what the last mutation answered, in catalog terms. */
export interface Notice {
  key: MessageKey;
  requestId?: string;
  variant: "danger" | "warning";
  /** The outcome of an issue may be unknown: point at the pending codes. */
  codesLink: boolean;
}

/** What a 404 on an issue names: a replace or move names a device or a store; a plain pairing, a store. */
const NOT_FOUND_KEYS = {
  "replace-or-move": "devices.issue.error.notFound",
  pair: "devices.issue.error.storeNotFound",
} as const;

/**
 * A refusal as a banner: the server re-deciding is a warning (the situation
 * changed), the rest danger. A 404 on an issue may name the device or the store,
 * so it reads as that, not as "this device".
 */
export function noticeOf(failure: MutationFailure, issue?: "replace-or-move" | "pair"): Notice {
  return {
    key: failure.kind === "not-found" && issue ? NOT_FOUND_KEYS[issue] : noticeKeyFor(failure),
    variant: failure.kind === "conflict" && isReDecided(failure) ? "warning" : "danger",
    requestId: requestIdOfFailure(failure),
    codesLink: pointsAtCodes(failure),
  };
}

export function hasProblems(problems: object): boolean {
  return Object.keys(problems).length > 0;
}
