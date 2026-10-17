/**
 * RT-372 — The review step of a lifecycle flow: the server's impact preview and
 * the inputs its `requires` asks for (the recovery revoke's note and the
 * custody-exception acknowledgement), plus, for the retire of a revoked device,
 * the warning about the replacement codes the retire would cancel.
 */
import { Banner } from "@/components/Banner";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import { useId } from "react";
import { ImpactPanel } from "./ImpactPanel";
import { TextArea } from "./RevokeFields";
import type { Draft, FlowAction, Problems } from "./flowTypes";
import type { ImpactDecision } from "./impactDecision";
import { type MutationFailure, noticeKeyFor, requestIdOfFailure } from "./lifecycleFailure";
import type { ReplacementCodesState } from "./useDeviceLifecycle";
import type { LifecycleFlowState } from "./useLifecycleFlow";
import "./devices.css";

type Ready = Extract<ImpactDecision, { kind: "ready" }>;

/**
 * The note the server asked for on the review step. The drawer-cash question belongs to
 * the recovery revoke (the one that also asks for the acknowledgement); any other
 * request for a note gets the plain label. A note the details step already collected is
 * not asked for twice.
 */
function NoteField({
  draft,
  problems,
  recovery,
  onPatch,
}: Readonly<{
  draft: Draft;
  problems: Problems;
  recovery: boolean;
  onPatch: (next: Partial<Draft>) => void;
}>): React.JSX.Element {
  const t = useT();
  return (
    <TextArea
      id="review-note"
      label={t(recovery ? "devices.revoke.noteRecovery" : "devices.revoke.note")}
      help={t("devices.revoke.noteHelpRequired")}
      value={draft.note}
      problem={problems.note}
      required
      onChange={(note) => onPatch({ note })}
    />
  );
}

function ConfirmBox({
  label,
  checked,
  problem,
  onChange,
}: Readonly<{
  label: string;
  checked: boolean;
  problem?: MessageKey;
  onChange: (checked: boolean) => void;
}>): React.JSX.Element {
  const t = useT();
  const errorId = useId();
  return (
    <div className="field">
      <label className="drawer__radio">
        <input
          type="checkbox"
          checked={checked}
          aria-invalid={problem ? "true" : undefined}
          aria-describedby={problem ? errorId : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
      <span id={errorId}>
        <InlineError message={problem ? t(problem) : undefined} />
      </span>
    </div>
  );
}

/** What the server's `requires` asks of the operator: the note, the acknowledgement. */
function Requirements({
  decision,
  draft,
  problems,
  onPatch,
}: Readonly<{
  decision: Ready;
  draft: Draft;
  problems: Problems;
  onPatch: (next: Partial<Draft>) => void;
}>): React.JSX.Element {
  const t = useT();
  return (
    <>
      {decision.needs.note && (decision.needs.acknowledge || draft.note.trim() === "") ? (
        <NoteField
          draft={draft}
          problems={problems}
          recovery={decision.needs.acknowledge}
          onPatch={onPatch}
        />
      ) : null}
      {decision.needs.acknowledge ? (
        <ConfirmBox
          label={t("devices.revoke.acknowledge")}
          checked={draft.acknowledge}
          problem={problems.acknowledge}
          onChange={(acknowledge) => onPatch({ acknowledge })}
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
  // A rejected value (400) is not fixed by asking again; only a server failure is retried.
  const retryable = failure.kind === "generic";
  const key: MessageKey = retryable ? "devices.impact.loadFailed" : noticeKeyFor(failure);
  return (
    <Banner
      variant="danger"
      message={t(key)}
      requestId={requestIdOfFailure(failure)}
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
  codes: ReplacementCodesState;
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
    <>
      <Banner
        variant="warning"
        message={`${t("devices.retire.pendingCodes", { count: codes.count ?? 0 })} ${t("devices.retire.pendingCodesHelp")}`}
      />
      <ConfirmBox
        label={t("devices.retire.pendingCodesConfirm")}
        checked={confirmed}
        problem={problem}
        onChange={onConfirm}
      />
    </>
  );
}

export function ReviewBody({
  action,
  flow,
  timeZone,
}: Readonly<{
  action: FlowAction;
  flow: LifecycleFlowState;
  timeZone?: string;
}>): React.JSX.Element {
  const t = useT();
  const { preview, decision, impact, draft, problems, patch } = flow;
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
  return (
    <>
      <ImpactPanel preview={preview} timeZone={timeZone} />
      {decision.kind === "ready" ? (
        <Requirements decision={decision} draft={draft} problems={problems} onPatch={patch} />
      ) : null}
      {action === "retire" ? (
        <ReplacementCodes
          codes={flow.codes}
          codesToConfirm={flow.codesToConfirm}
          confirmed={draft.confirmCodes}
          problem={problems.codes}
          onConfirm={(confirmCodes) => patch({ confirmCodes })}
        />
      ) : null}
    </>
  );
}
