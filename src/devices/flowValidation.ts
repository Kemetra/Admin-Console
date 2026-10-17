/**
 * RT-372 — What the operator still has to give a lifecycle flow: the details
 * step's own fields, and, on the review step, only what the server's `requires`
 * asked for. Form checks; the server re-validates everything. No React.
 */
import type { MessageKey } from "@/i18n";
import { type Draft, type FlowAction, type Problems, hasProblems } from "./flowTypes";
import type { ImpactDecision } from "./impactDecision";
import { textProblemKey, validateOperatorText } from "./lifecycleLogic";
import { validateIssueDraft } from "./pairingLogic";

type Ready = Extract<ImpactDecision, { kind: "ready" }>;

function textKey(value: string, required: boolean): MessageKey | undefined {
  const problem = validateOperatorText(value, required);
  return problem ? textProblemKey(problem) : undefined;
}

function retireProblems(draft: Draft): Problems {
  const retireReason = textKey(draft.retireReason, true);
  return retireReason ? { retireReason } : {};
}

function revokeProblems(draft: Draft): Problems {
  if (draft.reason === "") return { reason: "devices.revoke.reasonRequired" };
  const note = textKey(draft.note, draft.reason === "other");
  return note ? { note } : {};
}

function issueProblems(draft: Draft): Problems {
  const issue = validateIssueDraft(draft.issue);
  return hasProblems(issue) ? { issue } : {};
}

const DETAILS_PROBLEMS: Readonly<Record<FlowAction, (draft: Draft) => Problems>> = {
  revoke: revokeProblems,
  retire: retireProblems,
  replace: issueProblems,
  move: issueProblems,
};

/** The first problem with what the details step collected, or none. */
export function detailsProblems(action: FlowAction, draft: Draft): Problems {
  return DETAILS_PROBLEMS[action](draft);
}

function noteProblem(decision: Ready, draft: Draft): Problems {
  const note = decision.needs.note ? textKey(draft.note, true) : undefined;
  return note ? { note } : {};
}

function acknowledgeProblem(decision: Ready, draft: Draft): Problems {
  return decision.needs.acknowledge && !draft.acknowledge
    ? { acknowledge: "devices.revoke.acknowledgeRequired" }
    : {};
}

function codesProblem(codesToConfirm: boolean, draft: Draft): Problems {
  return codesToConfirm && !draft.confirmCodes
    ? { codes: "devices.retire.pendingCodesRequired" }
    : {};
}

/** What the review step still needs from the operator, as the server's `requires` asked. */
export function reviewProblems(
  decision: ImpactDecision,
  draft: Draft,
  codesToConfirm: boolean,
): Problems {
  if (decision.kind !== "ready") return {};
  return {
    ...noteProblem(decision, draft),
    ...acknowledgeProblem(decision, draft),
    ...codesProblem(codesToConfirm, draft),
  };
}

const DONE_KEYS: Readonly<Record<string, MessageKey>> = {
  revoked: "devices.revoke.done",
  already_revoked: "devices.revoke.alreadyRevoked",
  retired: "devices.retire.done",
  already_retired: "devices.retire.alreadyRetired",
};

/** The done line for the server's outcome; an outcome this console doesn't know is the plain success. */
export function doneKey(action: FlowAction, outcome: string): MessageKey {
  if (Object.hasOwn(DONE_KEYS, outcome)) return DONE_KEYS[outcome];
  return action === "revoke" ? "devices.revoke.done" : "devices.retire.done";
}
