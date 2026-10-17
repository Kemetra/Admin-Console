/**
 * RT-372 — What the confirm button calls, per action, and what came back. Revoke
 * and Retire act on the device; Replace and Move issue a pairing code for it.
 * Every action answers with one `SubmitResult`: done (with the outcome line, or
 * the issued code), or the refusal to render. Nothing is retried here, and a
 * pairing code that got no answer is `no-answer`, never a silent second issue.
 */
import type { MessageKey } from "@/i18n";
import type { DeviceDetail, PairingCodeIssued, RevokeReason } from "@/lib/device-queries";
import { type Draft, type FlowAction, isIssueAction } from "./flowTypes";
import { doneKey } from "./flowValidation";
import type { ImpactDecision } from "./impactDecision";
import { type MutationFailure, classifyMutationFailure } from "./lifecycleFailure";
import { buildRevokeBody } from "./lifecycleLogic";
import { buildIssueBody } from "./pairingLogic";
import { useIssuePairingCode, useRetireDevice, useRevokeDevice } from "./useDeviceLifecycle";

type Ready = Extract<ImpactDecision, { kind: "ready" }>;

export type SubmitResult =
  | { ok: true; outcome?: MessageKey; issued?: PairingCodeIssued }
  | { ok: false; failure: MutationFailure };

interface Answer {
  status: number;
  data?: { outcome: string };
  error?: unknown;
}

function deviceResult(action: "revoke" | "retire", res: Answer): SubmitResult {
  return res.status === 200 && res.data
    ? { ok: true, outcome: doneKey(action, res.data.outcome) }
    : { ok: false, failure: classifyMutationFailure(res) };
}

function issueResult(res: {
  status: number;
  data?: PairingCodeIssued;
  error?: unknown;
}): SubmitResult {
  if (res.status === 201 && res.data) return { ok: true, issued: res.data };
  // A gateway error or timeout can arrive after the server made the code: the outcome is unknown.
  if (res.status >= 500 || res.status === 0) return { ok: false, failure: { kind: "no-answer" } };
  return { ok: false, failure: classifyMutationFailure(res) };
}

export interface Submitter {
  submit: (decided: Ready) => Promise<SubmitResult>;
  pending: boolean;
}

export function useSubmitAction(action: FlowAction, device: DeviceDetail, draft: Draft): Submitter {
  const revoke = useRevokeDevice(device.deviceId);
  const retire = useRetireDevice(device.deviceId);
  const issue = useIssuePairingCode();

  const run: Record<FlowAction, (decided: Ready) => Promise<SubmitResult>> = {
    revoke: async (decided) =>
      deviceResult(
        "revoke",
        await revoke.mutateAsync(
          buildRevokeBody({
            reason: draft.reason as RevokeReason,
            note: draft.note,
            acknowledge: decided.needs.acknowledge && draft.acknowledge,
          }),
        ),
      ),
    retire: async () => deviceResult("retire", await retire.mutateAsync(draft.retireReason.trim())),
    replace: async () => issueOnce(),
    move: async () => issueOnce(),
  };

  async function issueOnce(): Promise<SubmitResult> {
    const res = await issue.mutateAsync(buildIssueBody(draft.issue, device.deviceId));
    // The secret is in `res` only: drop the mutation's own copy now.
    issue.reset();
    return issueResult(res);
  }

  async function submit(decided: Ready): Promise<SubmitResult> {
    try {
      return await run[action](decided);
    } catch {
      return {
        ok: false,
        failure: isIssueAction(action) ? { kind: "no-answer" } : { kind: "generic" },
      };
    }
  }

  return { submit, pending: revoke.isPending || retire.isPending || issue.isPending };
}
