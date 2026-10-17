/**
 * RT-372 — One lifecycle action as three steps in a drawer: details (the reason,
 * text or pairing-code form the action needs), review (the server's impact
 * preview and, when the server's `requires` says so, the note and the
 * acknowledgement) and done.
 *
 * The console never decides what an action does. The review step asks
 * `/impact` when it opens (a snapshot, asked again each time) and renders the
 * verdict; the confirm button exists only for a verdict that proceeds. What the
 * mutation answers wins over the preview: a 409 carries a fresh preview, which
 * replaces the one on screen. No override exists for a blocked verdict.
 *
 * Replace and Move issue a pairing code for the replaced device. An issue is
 * non-replayable: a refused, unanswered or conflicting attempt is never retried
 * with the same key, and the operator is pointed at the pending codes instead.
 */
import { Banner } from "@/components/Banner";
import { Drawer } from "@/components/Drawer";
import { type MessageKey, useT } from "@/i18n";
import type {
  DeviceDetail,
  DeviceImpactPreview,
  PairingCodeIssued,
  RevokeReason,
} from "@/lib/device-queries";
import { useStoreDirectory } from "@/shift-closes/useShiftCloses";
import { useState } from "react";
import { Link } from "react-router";
import { IssueFields } from "./IssueFields";
import { IssuedCode } from "./IssuedCode";
import { ReviewBody } from "./LifecycleReview";
import { RetireDetails, RevokeDetails } from "./RevokeFields";
import {
  type Draft,
  EMPTY_DRAFT,
  type FlowAction,
  type Notice,
  type Problems,
  type Step,
  isIssueAction,
} from "./flowTypes";
import {
  type ImpactDecision,
  type MutationFailure,
  buildRevokeBody,
  classifyMutationFailure,
  decideImpact,
  isReDecided,
  noticeKeyFor,
  requestIdOfFailure,
  textProblemKey,
  validateOperatorText,
} from "./lifecycleLogic";
import {
  EMPTY_ISSUE_DRAFT,
  type IssueDraft,
  type IssueProblems,
  buildIssueBody,
  validateIssueDraft,
} from "./pairingLogic";
import {
  useImpact,
  useIssuePairingCode,
  useReplacementCodes,
  useRetireDevice,
  useRevokeDevice,
} from "./useDeviceLifecycle";
import { useDeviceScope } from "./useDevices";
import "./devices.css";

const TITLE: Record<FlowAction, MessageKey> = {
  revoke: "devices.revoke.title",
  retire: "devices.retire.title",
  replace: "devices.issue.title.replace",
  move: "devices.issue.title.move",
};
const CONFIRM: Record<FlowAction, MessageKey> = {
  revoke: "devices.revoke.confirm",
  retire: "devices.retire.confirm",
  replace: "devices.issue.confirm",
  move: "devices.issue.confirm",
};

/** After these revokes a replacement is the natural next step (security or recovery). */
const OFFERS_REPLACE: ReadonlySet<string> = new Set([
  "lost",
  "stolen",
  "suspected_compromise",
  "hardware_failure",
]);

/** The first problem with what the details step collected, or none. */
function detailsProblems(action: FlowAction, draft: Draft): Problems {
  if (action === "retire") {
    const problem = validateOperatorText(draft.retireReason, true);
    return problem ? { retireReason: textProblemKey(problem) } : {};
  }
  if (draft.reason === "") return { reason: "devices.revoke.reasonRequired" };
  const problem = validateOperatorText(draft.note, draft.reason === "other");
  return problem ? { note: textProblemKey(problem) } : {};
}

/** What the review step still needs from the operator, as the server's `requires` asked. */
function reviewProblems(decision: ImpactDecision, draft: Draft, codesToConfirm: boolean): Problems {
  if (decision.kind !== "ready") return {};
  const problems: Problems = {};
  if (decision.needs.note) {
    const note = validateOperatorText(draft.note, true);
    if (note) problems.note = textProblemKey(note);
  }
  if (decision.needs.acknowledge && !draft.acknowledge) {
    problems.acknowledge = "devices.revoke.acknowledgeRequired";
  }
  if (codesToConfirm && !draft.confirmCodes) problems.codes = "devices.retire.pendingCodesRequired";
  return problems;
}

/** Refusals after which the issue's outcome may be unknown or a stray code may exist. */
function pointsAtCodes(failure: MutationFailure): boolean {
  if (failure.kind === "in-progress") return true;
  return (
    failure.kind === "conflict" &&
    (failure.code === "idempotency_key_conflict" || failure.code === "replacement_already_pending")
  );
}

function doneKey(action: FlowAction, outcome: string): MessageKey {
  if (action === "revoke") {
    return outcome === "already_revoked" ? "devices.revoke.alreadyRevoked" : "devices.revoke.done";
  }
  return outcome === "already_retired" ? "devices.retire.alreadyRetired" : "devices.retire.done";
}

export interface LifecycleFlowProps {
  action: FlowAction;
  device: DeviceDetail;
  timeZone?: string;
  onClose: () => void;
  /** Hand over to another action (after a revoke, the replacement). */
  onSwitch?: (action: FlowAction) => void;
}

export function LifecycleFlow({
  action,
  device,
  timeZone,
  onClose,
  onSwitch,
}: Readonly<LifecycleFlowProps>): React.JSX.Element {
  const t = useT();
  const scope = useDeviceScope();
  const directory = useStoreDirectory(scope.tenantId);
  const issuing = isIssueAction(action);
  const [step, setStep] = useState<Step>("details");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [issueDraft, setIssueDraft] = useState<IssueDraft>({
    ...EMPTY_ISSUE_DRAFT,
    // A replace stays in the device's own store; a move picks another one.
    storeId: action === "replace" ? device.storeId : "",
  });
  const [problems, setProblems] = useState<Problems>({});
  const [issueProblems, setIssueProblems] = useState<IssueProblems>({});
  const [notice, setNotice] = useState<Notice | undefined>();
  const [fresh, setFresh] = useState<DeviceImpactPreview | undefined>();
  const [gone, setGone] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [outcome, setOutcome] = useState<MessageKey | undefined>();
  // The secret code lives here only, until the drawer closes.
  const [issued, setIssued] = useState<PairingCodeIssued | undefined>();

  const revoke = useRevokeDevice(device.deviceId);
  const retire = useRetireDevice(device.deviceId);
  const issue = useIssuePairingCode();
  const pending = revoke.isPending || retire.isPending || issue.isPending;

  const reviewing = step === "review";
  const reason = action === "revoke" && draft.reason !== "" ? draft.reason : undefined;
  const impact = useImpact(scope, device.deviceId, action, reason, reviewing, nonce);
  // A retire of a REVOKED device also cancels the live codes that replace it.
  const codes = useReplacementCodes(
    scope,
    device.deviceId,
    reviewing && action === "retire" && device.trustState === "revoked",
  );

  const preview = fresh ?? impact.preview;
  const decision = preview ? decideImpact(preview) : undefined;
  const codesToConfirm = (codes.count ?? 0) > 0;
  // A revoked device's retire waits for the replacement-code check: no confirm until it settles.
  const checkingCodes =
    action === "retire" && device.trustState === "revoked" && (codes.isLoading || codes.failed);

  const patch = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }));
  const patchIssue = (next: Partial<IssueDraft>) => setIssueDraft((d) => ({ ...d, ...next }));

  function review(): void {
    if (issuing) {
      const found = validateIssueDraft(issueDraft);
      setIssueProblems(found);
      if (Object.keys(found).length > 0) return;
    } else {
      const found = detailsProblems(action, draft);
      setProblems(found);
      if (Object.keys(found).length > 0) return;
    }
    setNotice(undefined);
    setFresh(undefined);
    setNonce((n) => n + 1);
    setStep("review");
  }

  function back(): void {
    setStep("details");
    setProblems({});
    setIssueProblems({});
    setNotice(undefined);
    setFresh(undefined);
    setGone(false);
  }

  function refuse(failure: MutationFailure): void {
    const reDecided = isReDecided(failure);
    const key =
      issuing && failure.kind === "not-found"
        ? "devices.issue.error.notFound"
        : noticeKeyFor(failure);
    setNotice({
      key,
      variant: reDecided ? "warning" : "danger",
      requestId: requestIdOfFailure(failure),
      codesLink: pointsAtCodes(failure),
    });
    if (failure.kind === "not-found") setGone(true);
    if (reDecided && failure.kind === "conflict" && failure.preview) {
      setFresh(failure.preview as DeviceImpactPreview);
    } else if (reDecided || failure.kind === "forbidden-recovery") {
      setFresh(undefined);
      setNonce((n) => n + 1);
    }
  }

  async function submitIssue(): Promise<void> {
    try {
      const res = await issue.mutateAsync(buildIssueBody(issueDraft, device.deviceId));
      if (res.status === 201 && res.data) {
        setIssued(res.data);
        issue.reset();
        setStep("done");
        return;
      }
      refuse(classifyMutationFailure(res));
    } catch {
      // No answer: the code may or may not exist. Never retried with the same key.
      setNotice({ key: "devices.issue.error.unknownOutcome", variant: "danger", codesLink: true });
    }
  }

  async function submitDeviceAction(
    decided: Extract<ImpactDecision, { kind: "ready" }>,
  ): Promise<void> {
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
    if (!decision || decision.kind !== "ready") return;
    const found = reviewProblems(decision, draft, codesToConfirm);
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    setNotice(undefined);
    await (issuing ? submitIssue() : submitDeviceAction(decision));
  }

  const storeName = directory.nameOf(issued?.storeId ?? issueDraft.storeId);
  const offerReplace =
    action === "revoke" && outcome === "devices.revoke.done" && OFFERS_REPLACE.has(draft.reason);

  return (
    <Drawer title={t(TITLE[action])} onClose={onClose}>
      <form
        className="surface__form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step === "details") review();
          else if (step === "review") void confirm();
        }}
      >
        {step === "details" ? (
          <>
            {issuing ? (
              <IssueFields
                mode={action}
                draft={issueDraft}
                problems={issueProblems}
                stores={directory.stores.filter((s) => s.id !== device.storeId)}
                fixedStoreName={directory.nameOf(device.storeId)}
                onChange={patchIssue}
              />
            ) : action === "revoke" ? (
              <RevokeDetails
                reason={draft.reason}
                note={draft.note}
                problems={problems}
                onReason={(r) => patch({ reason: r })}
                onNote={(note) => patch({ note })}
              />
            ) : (
              <RetireDetails
                reason={draft.retireReason}
                problem={problems.retireReason}
                onReason={(retireReason) => patch({ retireReason })}
              />
            )}
            <div className="surface__actions">
              <button type="submit" className="btn-primary">
                {t("devices.flow.review")}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>
                {t("common.cancel")}
              </button>
            </div>
          </>
        ) : null}

        {step === "review" ? (
          <>
            {notice ? (
              <Banner
                variant={notice.variant}
                message={t(notice.key)}
                requestId={notice.requestId}
                action={
                  notice.codesLink ? (
                    <Link to="/devices/pairing-codes" className="btn-secondary">
                      {t("devices.issue.viewCodes")}
                    </Link>
                  ) : undefined
                }
              />
            ) : null}
            <ReviewBody
              action={action}
              preview={preview}
              decision={decision}
              impact={impact}
              codes={codes}
              codesToConfirm={codesToConfirm}
              timeZone={timeZone}
              draft={draft}
              problems={problems}
              onPatch={patch}
            />
            <div className="surface__actions">
              {decision?.kind === "ready" && !gone && !checkingCodes ? (
                <button
                  type="submit"
                  className={issuing ? "btn-primary" : "btn-destructive"}
                  disabled={pending}
                >
                  {pending ? <span className="spinner" aria-hidden="true" /> : null}
                  {t(CONFIRM[action])}
                </button>
              ) : null}
              <button type="button" className="btn-secondary" onClick={back} disabled={pending}>
                {t("devices.flow.back")}
              </button>
              <button type="button" className="btn-ghost" onClick={onClose} disabled={pending}>
                {t("common.cancel")}
              </button>
            </div>
          </>
        ) : null}

        {step === "done" ? (
          <>
            {issued ? (
              <IssuedCode issued={issued} storeName={storeName} timeZone={timeZone} />
            ) : (
              <output className="device-impact__verdict">{outcome ? t(outcome) : null}</output>
            )}
            {offerReplace && onSwitch ? (
              <p className="content__sub">{t("devices.revoke.nextStep")}</p>
            ) : null}
            <div className="surface__actions">
              {offerReplace && onSwitch ? (
                <button type="button" className="btn-primary" onClick={() => onSwitch("replace")}>
                  {t("devices.revoke.offerReplace")}
                </button>
              ) : null}
              <button
                type="button"
                className={offerReplace ? "btn-secondary" : "btn-primary"}
                onClick={onClose}
              >
                {t("devices.flow.done")}
              </button>
            </div>
          </>
        ) : null}
      </form>
    </Drawer>
  );
}
