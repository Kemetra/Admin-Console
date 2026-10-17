/**
 * RT-372 — One lifecycle action as three steps in a drawer: details (the reason
 * or text the server needs), review (the server's impact preview and, when the
 * server's `requires` says so, the note and the acknowledgement) and done.
 *
 * The console never decides what an action does. The review step asks
 * `/impact` when it opens (a snapshot, asked again each time) and renders the
 * verdict; the confirm button exists only for a verdict that proceeds. What the
 * mutation answers wins over the preview: a 409 carries a fresh preview, which
 * replaces the one on screen. No override exists for a blocked verdict.
 */
import { Banner } from "@/components/Banner";
import { Drawer } from "@/components/Drawer";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import type { DeviceDetail, DeviceImpactPreview, RevokeReason } from "@/lib/device-queries";
import { useState } from "react";
import { ImpactPanel } from "./ImpactPanel";
import { RetireDetails, RevokeDetails, TextArea } from "./RevokeFields";
import {
  type ImpactDecision,
  type MutationFailure,
  buildRevokeBody,
  classifyMutationFailure,
  decideImpact,
  textProblemKey,
  validateOperatorText,
} from "./lifecycleLogic";
import {
  useImpact,
  useReplacementCodes,
  useRetireDevice,
  useRevokeDevice,
} from "./useDeviceLifecycle";
import { useDeviceScope } from "./useDevices";
import "./devices.css";

export type FlowAction = "revoke" | "retire";
type Step = "details" | "review" | "done";

interface Draft {
  reason: RevokeReason | "";
  note: string;
  retireReason: string;
  acknowledge: boolean;
  confirmCodes: boolean;
}

interface Problems {
  reason?: MessageKey;
  note?: MessageKey;
  retireReason?: MessageKey;
  acknowledge?: MessageKey;
  codes?: MessageKey;
}

interface Notice {
  key: MessageKey;
  requestId?: string;
  variant: "danger" | "warning";
}

const EMPTY_DRAFT: Draft = {
  reason: "",
  note: "",
  retireReason: "",
  acknowledge: false,
  confirmCodes: false,
};

const TITLE: Record<FlowAction, MessageKey> = {
  revoke: "devices.revoke.title",
  retire: "devices.retire.title",
};
const CONFIRM: Record<FlowAction, MessageKey> = {
  revoke: "devices.revoke.confirm",
  retire: "devices.retire.confirm",
};

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

/** The notice a refused mutation leaves, and whether the preview must be asked for again. */
function noticeFor(failure: MutationFailure): Notice & { refresh: boolean } {
  const { requestId } = failure;
  switch (failure.kind) {
    case "conflict":
      return { key: "devices.flow.error.changed", variant: "warning", requestId, refresh: true };
    case "forbidden-recovery":
      return {
        key: "devices.impact.verdict.forbidden",
        variant: "danger",
        requestId,
        refresh: true,
      };
    case "unmet":
      return {
        key:
          failure.code === "recovery_note_required"
            ? "devices.flow.error.unmetNote"
            : "devices.flow.error.unmetAcknowledge",
        variant: "danger",
        requestId,
        refresh: false,
      };
    case "not-found":
      return { key: "devices.flow.error.notFound", variant: "danger", requestId, refresh: false };
    case "validation":
      return { key: "devices.flow.error.validation", variant: "danger", requestId, refresh: false };
    case "session":
      return { key: "devices.flow.error.session", variant: "danger", requestId, refresh: false };
    default:
      return { key: "devices.flow.error.generic", variant: "danger", requestId, refresh: false };
  }
}

export interface LifecycleFlowProps {
  action: FlowAction;
  device: DeviceDetail;
  timeZone?: string;
  onClose: () => void;
}

export function LifecycleFlow({
  action,
  device,
  timeZone,
  onClose,
}: Readonly<LifecycleFlowProps>): React.JSX.Element {
  const t = useT();
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
  const pending = revoke.isPending || retire.isPending;

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

  function review(): void {
    const found = detailsProblems(action, draft);
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    setNotice(undefined);
    setFresh(undefined);
    setNonce((n) => n + 1);
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
    const next = noticeFor(failure);
    setNotice(next);
    if (failure.kind === "not-found") setGone(true);
    if (failure.kind === "conflict" && failure.preview) {
      setFresh(failure.preview as DeviceImpactPreview);
    } else if (next.refresh) {
      setFresh(undefined);
      setNonce((n) => n + 1);
    }
  }

  async function confirm(): Promise<void> {
    if (!decision || decision.kind !== "ready") return;
    const found = reviewProblems(decision, draft, codesToConfirm);
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    setNotice(undefined);
    try {
      const res =
        action === "revoke"
          ? await revoke.mutateAsync(
              buildRevokeBody({
                reason: draft.reason as RevokeReason,
                note: draft.note,
                acknowledge: decision.needs.acknowledge && draft.acknowledge,
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
            {action === "revoke" ? (
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
                <button type="submit" className="btn-destructive" disabled={pending}>
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
            <output className="device-impact__verdict">{outcome ? t(outcome) : null}</output>
            <div className="surface__actions">
              <button type="button" className="btn-primary" onClick={onClose}>
                {t("devices.flow.done")}
              </button>
            </div>
          </>
        ) : null}
      </form>
    </Drawer>
  );
}

function doneKey(action: FlowAction, outcome: string): MessageKey {
  if (action === "revoke") {
    return outcome === "already_revoked" ? "devices.revoke.alreadyRevoked" : "devices.revoke.done";
  }
  return outcome === "already_retired" ? "devices.retire.alreadyRetired" : "devices.retire.done";
}

interface ReviewBodyProps {
  action: FlowAction;
  preview?: DeviceImpactPreview;
  decision?: ImpactDecision;
  impact: ReturnType<typeof useImpact>;
  codes: ReturnType<typeof useReplacementCodes>;
  codesToConfirm: boolean;
  timeZone?: string;
  draft: Draft;
  problems: Problems;
  onPatch: (next: Partial<Draft>) => void;
}

function ReviewBody(props: Readonly<ReviewBodyProps>): React.JSX.Element {
  const { action, preview, decision, impact, codes, codesToConfirm, timeZone, draft, problems } =
    props;
  const t = useT();
  if (impact.error && !preview) {
    return <ImpactFailure failure={impact.error} onRetry={impact.retry} />;
  }
  if (!preview || !decision) {
    return (
      <output className="content__sub">
        <span className="spinner" aria-hidden="true" /> {t("devices.flow.checking")}
      </output>
    );
  }
  const ready = decision.kind === "ready";
  return (
    <>
      <ImpactPanel preview={preview} timeZone={timeZone} />
      {ready && decision.needs.note ? (
        <TextArea
          id="review-note"
          label={t("devices.revoke.noteRecovery")}
          help={t("devices.revoke.noteHelpRequired")}
          value={draft.note}
          problem={problems.note}
          required
          onChange={(note) => props.onPatch({ note })}
        />
      ) : null}
      {ready && decision.needs.acknowledge ? (
        <div className="field">
          <label className="drawer__radio">
            <input
              type="checkbox"
              checked={draft.acknowledge}
              aria-invalid={problems.acknowledge ? "true" : undefined}
              onChange={(e) => props.onPatch({ acknowledge: e.target.checked })}
            />
            {t("devices.revoke.acknowledge")}
          </label>
          <InlineError message={problems.acknowledge ? t(problems.acknowledge) : undefined} />
        </div>
      ) : null}
      {action === "retire" ? (
        <ReplacementCodes
          codes={codes}
          codesToConfirm={codesToConfirm}
          confirmed={draft.confirmCodes}
          problem={problems.codes}
          onConfirm={(confirmCodes) => props.onPatch({ confirmCodes })}
        />
      ) : null}
    </>
  );
}

function ImpactFailure({
  failure,
  onRetry,
}: Readonly<{ failure: MutationFailure; onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  const next = noticeFor(failure);
  const key: MessageKey =
    failure.kind === "generic" || failure.kind === "validation"
      ? "devices.impact.loadFailed"
      : next.key;
  const retryable = failure.kind === "generic" || failure.kind === "validation";
  return (
    <Banner
      variant="danger"
      message={t(key)}
      requestId={failure.requestId}
      action={
        retryable ? (
          <button type="button" className="btn-secondary" onClick={onRetry}>
            {t("devices.impact.retry")}
          </button>
        ) : undefined
      }
    />
  );
}

interface ReplacementCodesProps {
  codes: ReturnType<typeof useReplacementCodes>;
  codesToConfirm: boolean;
  confirmed: boolean;
  problem?: MessageKey;
  onConfirm: (confirmed: boolean) => void;
}

/** The retire of a revoked device cancels its replacement codes: say so, and ask. */
function ReplacementCodes({
  codes,
  codesToConfirm,
  confirmed,
  problem,
  onConfirm,
}: Readonly<ReplacementCodesProps>): React.JSX.Element | null {
  const t = useT();
  if (codes.isLoading) {
    return <output className="content__sub">{t("devices.retire.checkingCodes")}</output>;
  }
  if (codes.failed) {
    return (
      <Banner
        variant="danger"
        message={t("devices.retire.codesLoadFailed")}
        action={
          <button type="button" className="btn-secondary" onClick={codes.retry}>
            {t("devices.impact.retry")}
          </button>
        }
      />
    );
  }
  if (!codesToConfirm) return null;
  return (
    <div className="field">
      <Banner
        variant="warning"
        message={`${t("devices.retire.pendingCodes", { count: codes.count ?? 0 })} ${t("devices.retire.pendingCodesHelp")}`}
      />
      <label className="drawer__radio">
        <input
          type="checkbox"
          checked={confirmed}
          aria-invalid={problem ? "true" : undefined}
          onChange={(e) => onConfirm(e.target.checked)}
        />
        {t("devices.retire.pendingCodesConfirm")}
      </label>
      <InlineError message={problem ? t(problem) : undefined} />
    </div>
  );
}
