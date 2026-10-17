/**
 * RT-372 — The state of one lifecycle flow (details → review → done) as a hook.
 *
 * The console never decides what an action does. The review step asks `/impact`
 * when it opens (a snapshot, asked again each time) and renders the verdict; the
 * confirm exists only for a verdict that proceeds. What the mutation answers
 * wins over the preview: a 409 carries a fresh preview, which replaces the one
 * on screen. No override exists for a blocked verdict.
 *
 * Replace and Move issue a pairing code. The code comes back once and lives here,
 * in state, only until the drawer closes.
 */
import type { MessageKey } from "@/i18n";
import type {
  DeviceDetail,
  DeviceImpactPreview,
  PairingCodeIssued,
  RevokeReason,
} from "@/lib/device-queries";
import { useState } from "react";
import {
  type Draft,
  type FlowAction,
  type Notice,
  type Problems,
  type Step,
  hasProblems,
  initialDraft,
  isIssueAction,
  noticeOf,
} from "./flowTypes";
import { detailsProblems, reviewProblems } from "./flowValidation";
import { type ImpactDecision, decideImpact } from "./impactDecision";
import { type MutationFailure, freshPreviewOf, isReDecided } from "./lifecycleFailure";
import type { IssueDraft } from "./pairingLogic";
import {
  type ImpactState,
  type ReplacementCodesState,
  useImpact,
  useReplacementCodes,
} from "./useDeviceLifecycle";
import { useDeviceScope } from "./useDevices";
import { useSingleFlight } from "./useSingleFlight";
import { useSubmitAction } from "./useSubmitAction";

/** After these revokes a replacement is the natural next step (security or recovery). */
const OFFERS_REPLACE: ReadonlySet<string> = new Set([
  "lost",
  "stolen",
  "suspected_compromise",
  "hardware_failure",
]);

/**
 * The retire of a REVOKED device also cancels the live codes that replace it. Whether
 * the device is revoked now is the server's word (its preview), not the detail the
 * page loaded earlier: the device may have been revoked since.
 */
function retiresRevoked(action: FlowAction, preview?: DeviceImpactPreview): boolean {
  return action === "retire" && preview?.trustState === "revoked";
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
  impact: ImpactState;
  fresh?: DeviceImpactPreview;
  codes: ReplacementCodesState;
  gone: boolean;
}

/** What the review step shows, from the server's answers only. */
function deriveView({ action, impact, fresh, codes, gone }: ViewInputs): FlowView {
  const preview = fresh ?? impact.preview;
  const decision = preview ? decideImpact(preview) : undefined;
  const waitingOnCodes = retiresRevoked(action, preview) && (codes.isLoading || codes.failed);
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
  /** The done line of a revoke or retire. */
  outcome?: MessageKey;
  /** The issued pairing code of a replace or move: shown once. */
  issued?: PairingCodeIssued;
  /** After a security or recovery revoke, Replace is offered directly. */
  offerReplace: boolean;
  pending: boolean;
  impact: ImpactState;
  codes: ReplacementCodesState;
  patch: (next: Partial<Draft>) => void;
  patchIssue: (next: Partial<IssueDraft>) => void;
  onSubmit: (event: React.FormEvent) => void;
  back: () => void;
}

export function useLifecycleFlow(action: FlowAction, device: DeviceDetail): LifecycleFlowState {
  const scope = useDeviceScope();
  const [step, setStep] = useState<Step>("details");
  const [draft, setDraft] = useState<Draft>(() => initialDraft(action, device.storeId));
  const [problems, setProblems] = useState<Problems>({});
  const [notice, setNotice] = useState<Notice | undefined>();
  const [fresh, setFresh] = useState<DeviceImpactPreview | undefined>();
  const [gone, setGone] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [outcome, setOutcome] = useState<MessageKey | undefined>();
  const [issued, setIssued] = useState<PairingCodeIssued | undefined>();

  const submitter = useSubmitAction(action, device, draft);
  const singleFlight = useSingleFlight();
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
    reviewing && retiresRevoked(action, fresh ?? impact.preview),
  );
  const view = deriveView({ action, impact, fresh, codes, gone });

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
    setNotice(noticeOf(failure, isIssueAction(action) ? "replace-or-move" : undefined));
    if (failure.kind === "not-found") setGone(true);
    const preview = freshPreviewOf(failure);
    if (preview) setFresh(preview as DeviceImpactPreview);
    else if (isReDecided(failure)) askAgain();
  }

  async function confirm(): Promise<void> {
    const { decision } = view;
    if (!decision || decision.kind !== "ready") return;
    const found = reviewProblems(decision, draft, view.codesToConfirm);
    setProblems(found);
    if (hasProblems(found)) return;
    setNotice(undefined);
    await singleFlight(async () => {
      const result = await submitter.submit(decision);
      if (!result.ok) return refuse(result.failure);
      setOutcome(result.outcome);
      setIssued(result.issued);
      setStep("done");
    });
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
    issued,
    offerReplace:
      action === "revoke" && outcome === "devices.revoke.done" && OFFERS_REPLACE.has(draft.reason),
    pending: submitter.pending,
    impact,
    codes,
    patch: (next) => setDraft((d) => ({ ...d, ...next })),
    patchIssue: (next) => setDraft((d) => ({ ...d, issue: { ...d.issue, ...next } })),
    onSubmit,
    back,
  };
}
