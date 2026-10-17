/**
 * RT-372 — The review step of a lifecycle flow: the server's impact preview and
 * the inputs its `requires` asks for (the recovery revoke's note and the
 * custody-exception acknowledgement), plus, for the retire of a revoked device,
 * the warning about the replacement codes the retire would cancel.
 */
import { Banner } from "@/components/Banner";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import type { DeviceImpactPreview } from "@/lib/device-queries";
import { ImpactPanel } from "./ImpactPanel";
import { TextArea } from "./RevokeFields";
import type { Draft, FlowAction, Problems } from "./flowTypes";
import {
  type ImpactDecision,
  type MutationFailure,
  noticeKeyFor,
  requestIdOfFailure,
} from "./lifecycleLogic";
import type { ImpactState, ReplacementCodesState } from "./useDeviceLifecycle";
import "./devices.css";

export interface ReviewBodyProps {
  action: FlowAction;
  preview?: DeviceImpactPreview;
  decision?: ImpactDecision;
  impact: ImpactState;
  codes: ReplacementCodesState;
  codesToConfirm: boolean;
  timeZone?: string;
  draft: Draft;
  problems: Problems;
  onPatch: (next: Partial<Draft>) => void;
}

export function ReviewBody(props: Readonly<ReviewBodyProps>): React.JSX.Element {
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
  const retryable = failure.kind === "generic" || failure.kind === "validation";
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
