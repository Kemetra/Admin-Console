/**
 * RT-372 — One lifecycle action as three steps in a drawer: details (the reason
 * or text the action needs), review (the server's impact preview and, when the
 * server's `requires` says so, the note and the acknowledgement) and done. The
 * state machine is `useLifecycleFlow`; this renders it.
 */
import { Banner } from "@/components/Banner";
import { Drawer } from "@/components/Drawer";
import { type MessageKey, useT } from "@/i18n";
import type { DeviceDetail } from "@/lib/device-queries";
import { ReviewBody } from "./LifecycleReview";
import { RetireDetails, RevokeDetails } from "./RevokeFields";
import type { FlowAction } from "./flowTypes";
import { type LifecycleFlowState, useLifecycleFlow } from "./useLifecycleFlow";
import "./devices.css";

const TITLE: Record<FlowAction, MessageKey> = {
  revoke: "devices.revoke.title",
  retire: "devices.retire.title",
};
const CONFIRM: Record<FlowAction, MessageKey> = {
  revoke: "devices.revoke.confirm",
  retire: "devices.retire.confirm",
};

interface StepProps {
  action: FlowAction;
  flow: LifecycleFlowState;
  onClose: () => void;
}

function Details({ action, flow, onClose }: Readonly<StepProps>): React.JSX.Element {
  const t = useT();
  const { draft, problems, patch } = flow;
  return (
    <>
      {action === "revoke" ? (
        <RevokeDetails
          reason={draft.reason}
          note={draft.note}
          problems={problems}
          onReason={(reason) => patch({ reason })}
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
  );
}

function Review({
  action,
  flow,
  onClose,
  timeZone,
}: Readonly<StepProps & { timeZone?: string }>): React.JSX.Element {
  const t = useT();
  const { notice, canConfirm, pending, back } = flow;
  return (
    <>
      {notice ? (
        <Banner variant={notice.variant} message={t(notice.key)} requestId={notice.requestId} />
      ) : null}
      <ReviewBody action={action} flow={flow} timeZone={timeZone} />
      <div className="surface__actions">
        {canConfirm ? (
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
  );
}

function Done({ flow, onClose }: Readonly<Pick<StepProps, "flow" | "onClose">>): React.JSX.Element {
  const t = useT();
  return (
    <>
      <output className="device-impact__verdict">{flow.outcome ? t(flow.outcome) : null}</output>
      <div className="surface__actions">
        <button type="button" className="btn-primary" onClick={onClose}>
          {t("devices.flow.done")}
        </button>
      </div>
    </>
  );
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
  const flow = useLifecycleFlow(action, device);
  return (
    <Drawer title={t(TITLE[action])} onClose={onClose}>
      <form className="surface__form" noValidate onSubmit={flow.onSubmit}>
        {flow.step === "details" ? <Details action={action} flow={flow} onClose={onClose} /> : null}
        {flow.step === "review" ? (
          <Review action={action} flow={flow} onClose={onClose} timeZone={timeZone} />
        ) : null}
        {flow.step === "done" ? <Done flow={flow} onClose={onClose} /> : null}
      </form>
    </Drawer>
  );
}
