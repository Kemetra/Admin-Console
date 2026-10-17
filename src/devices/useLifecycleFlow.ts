/**
 * RT-372 — The state of one lifecycle flow (details → review → done) as a hook.
 *
 * The console never decides what an action does. The review step asks `/impact`
 * when it opens (a snapshot, asked again each time) and renders the verdict; the
 * confirm exists only for a verdict that proceeds. What the mutation answers
 * wins over the preview: a 409 carries a fresh preview, which replaces the one
 * on screen. No override exists for a blocked verdict.
 */
import type { MessageKey } from "@/i18n";
import type { DeviceDetail, DeviceImpactPreview, RevokeReason } from "@/lib/device-queries";
import { useState } from "react";
import {
  type Draft,
  EMPTY_DRAFT,
  type FlowAction,
  type Notice,
  type Problems,
  type Step,
  hasProblems,
  noticeOf,
} from "./flowTypes";
import { detailsProblems, doneKey, reviewProblems } from "./flowValidation";
import { type ImpactDecision, decideImpact } from "./impactDecision";
import { type MutationFailure, classifyMutationFailure, isReDecided } from "./lifecycleFailure";
import { buildRevokeBody } from "./lifecycleLogic";
import {
  type ImpactState,
  type ReplacementCodesState,
  useImpact,
  useReplacementCodes,
  useRetireDevice,
  useRevokeDevice,
} from "./useDeviceLifecycle";
import { useDeviceScope } from "./useDevices";

type Ready = Extract<ImpactDecision, { kind: "ready" }>;

/** The retire of a REVOKED device also cancels the live codes that replace it. */
function retiresRevoked(action: FlowAction, device: DeviceDetail): boolean {
  return action === "retire" && device.trustState === "revoked";
}

export interface FlowView {
  preview?: DeviceImpactPreview;
  decision?: ImpactDecision;
  codesToConfirm: boolean;
  /** The confirm button exists: the server's verdict proceeds and nothing is still being checked. */
  canConfirm: boolean;
}

interface ViewInputs {
  action: FlowAction;
  device: DeviceDetail;
  impact: ImpactState;
  fresh?: DeviceImpactPreview;
  codes: ReplacementCodesState;
  gone: boolean;
}

/** What the review step shows, from the server's answers only. */
function deriveView({ action, device, impact, fresh, codes, gone }: ViewInputs): FlowView {
  const preview = fresh ?? impact.preview;
  const decision = preview ? decideImpact(preview) : undefined;
  const waitingOnCodes = retiresRevoked(action, device) && (codes.isLoading || codes.failed);
  return {
    preview,
    decision,
    codesToConfirm: (codes.count ?? 0) > 0,
    canConfirm: decision?.kind === "ready" && !gone && !waitingOnCodes,
  };
}

export interface LifecycleFlowState extends FlowView {
  step: Step;
  draft: Draft;
  problems: Problems;
  notice?: Notice;
  outcome?: MessageKey;
  pending: boolean;
  impact: ImpactState;
  codes: ReplacementCodesState;
  patch: (next: Partial<Draft>) => void;
  onSubmit: (event: React.FormEvent) => void;
  back: () => void;
}

export function useLifecycleFlow(action: FlowAction, device: DeviceDetail): LifecycleFlowState {
  const scope = useDeviceScope();
  const [step, setStep] = useState<Step>("details");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [problems, setProblems] = useState<Problems>({});
  const [notice, setNotice] = useState<Notice | undefined>();
  const [fresh, setFresh] = useState<DeviceImpactPreview | undefined>();
  const [gone, setGone] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [outcome, setOutcome] = useState<MessageKey | undefined>();

  const revoke = useRevokeDevice(device.deviceId);
  const retire = useRetireDevice(device.deviceId);
  const reviewing = step === "review";
  const reason: RevokeReason | undefined =
    action === "revoke" && draft.reason !== "" ? draft.reason : undefined;
  const impact = useImpact({
    scope,
    deviceId: device.deviceId,
    action,
    reason,
    enabled: reviewing,
    nonce,
  });
  const codes = useReplacementCodes(
    scope,
    device.deviceId,
    reviewing && retiresRevoked(action, device),
  );
  const view = deriveView({ action, device, impact, fresh, codes, gone });

  const askAgain = () => {
    setFresh(undefined);
    setNonce((n) => n + 1);
  };

  function review(): void {
    const found = detailsProblems(action, draft);
    setProblems(found);
    if (hasProblems(found)) return;
    setNotice(undefined);
    askAgain();
    setStep("review");
  }

  function back(): void {
    setStep("details");
    setProblems({});
    setNotice(undefined);
    setFresh(undefined);
    setGone(false);
  }

  function refuse(failure: MutationFailure): void {
    setNotice(noticeOf(failure));
    if (failure.kind === "not-found") setGone(true);
    if (failure.kind === "conflict" && failure.preview) {
      setFresh(failure.preview as DeviceImpactPreview);
    } else if (isReDecided(failure)) {
      askAgain();
    }
  }

  async function submit(decided: Ready): Promise<void> {
    try {
      const res =
        action === "revoke"
          ? await revoke.mutateAsync(
              buildRevokeBody({
                reason: draft.reason as RevokeReason,
                note: draft.note,
                acknowledge: decided.needs.acknowledge && draft.acknowledge,
              }),
            )
          : await retire.mutateAsync(draft.retireReason.trim());
      if (res.status === 200 && res.data) {
        setOutcome(doneKey(action, res.data.outcome));
        setStep("done");
        return;
      }
      refuse(classifyMutationFailure(res));
    } catch {
      refuse({ kind: "generic" });
    }
  }

  async function confirm(): Promise<void> {
    const { decision } = view;
    if (!decision || decision.kind !== "ready") return;
    const found = reviewProblems(decision, draft, view.codesToConfirm);
    setProblems(found);
    if (hasProblems(found)) return;
    setNotice(undefined);
    await submit(decision);
  }

  function onSubmit(event: React.FormEvent): void {
    event.preventDefault();
    if (step === "details") review();
    else if (step === "review") void confirm();
  }

  return {
    ...view,
    step,
    draft,
    problems,
    notice,
    outcome,
    pending: revoke.isPending || retire.isPending,
    impact,
    codes,
    patch: (next) => setDraft((d) => ({ ...d, ...next })),
    onSubmit,
    back,
  };
}
