/** RT-372 shared shapes of the lifecycle flow: what the operator has typed and what is wrong with it. */
import type { MessageKey } from "@/i18n";
import type { RevokeReason } from "@/lib/device-queries";
import type { LifecycleActionId } from "./lifecycleLogic";

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
  /** The outcome of an issue may be unknown: point at the pending codes. */
  codesLink?: boolean;
}
