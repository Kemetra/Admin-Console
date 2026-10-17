/** RT-372 shared shapes of the lifecycle flow: what the operator has typed and what is wrong with it. */
import type { MessageKey } from "@/i18n";
import type { RevokeReason } from "@/lib/device-queries";
import { type MutationFailure, noticeKeyFor, requestIdOfFailure } from "./lifecycleFailure";
import type { LifecycleActionId } from "./lifecycleLogic";

export type FlowAction = LifecycleActionId;
export type Step = "details" | "review" | "done";

export interface Draft {
  reason: RevokeReason | "";
  note: string;
  retireReason: string;
  acknowledge: boolean;
  confirmCodes: boolean;
}

export const EMPTY_DRAFT: Draft = {
  reason: "",
  note: "",
  retireReason: "",
  acknowledge: false,
  confirmCodes: false,
};

export interface Problems {
  reason?: MessageKey;
  note?: MessageKey;
  retireReason?: MessageKey;
  acknowledge?: MessageKey;
  codes?: MessageKey;
}

/** A banner above the review: what the last mutation answered, in catalog terms. */
export interface Notice {
  key: MessageKey;
  requestId?: string;
  variant: "danger" | "warning";
}

/** A refusal as a banner: the server re-deciding is a warning (the situation changed), the rest danger. */
export function noticeOf(failure: MutationFailure): Notice {
  return {
    key: noticeKeyFor(failure),
    variant: failure.kind === "conflict" ? "warning" : "danger",
    requestId: requestIdOfFailure(failure),
  };
}

export function hasProblems(problems: object): boolean {
  return Object.keys(problems).length > 0;
}
