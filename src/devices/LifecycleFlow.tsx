/**
 * RT-372 — One lifecycle action as three steps in a drawer: details (the reason,
 * text or pairing-code form the action needs), review (the server's impact
 * preview and, when the server's `requires` says so, the note and the
 * acknowledgement) and done. The state machine is `useLifecycleFlow`; this
 * renders it.
 */
import { Banner } from "@/components/Banner";
import { Drawer } from "@/components/Drawer";
import { GatedButton } from "@/components/GatedButton";
import { type MessageKey, useT } from "@/i18n";
import type { DeviceDetail } from "@/lib/device-queries";
import { useStoreDirectory } from "@/shift-closes/useShiftCloses";
import { Link } from "react-router";
import { IssueFields } from "./IssueFields";
import { IssuedCode } from "./IssuedCode";
import { ReviewBody } from "./LifecycleReview";
import { RetireDetails, RevokeDetails } from "./RevokeFields";
import { type FlowAction, isIssueAction } from "./flowTypes";
import { useDeviceScope } from "./useDevices";
import { type LifecycleFlowState, useLifecycleFlow } from "./useLifecycleFlow";
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

interface StepProps {
  action: FlowAction;
  flow: LifecycleFlowState;
  onClose: () => void;
}

/** The pairing-code form: a replace stays in the device's store, a move offers the others. */
function IssueDetails({
  action,
  flow,
  device,
}: Readonly<{
  action: "replace" | "move";
  flow: LifecycleFlowState;
  device: DeviceDetail;
}>): React.JSX.Element {
  const directory = useStoreDirectory(useDeviceScope().tenantId);
  return (
    <IssueFields
      mode={action}
      draft={flow.draft.issue}
      problems={flow.problems.issue ?? {}}
      stores={directory.stores.filter((s) => s.id !== device.storeId)}
      fixedStoreName={directory.nameOf(device.storeId)}
      onChange={flow.patchIssue}
    />
  );
}

function DetailFields({
  action,
  flow,
  device,
}: Readonly<{ action: FlowAction; flow: LifecycleFlowState; device: DeviceDetail }>) {
  const { draft, problems, patch } = flow;
  if (isIssueAction(action)) return <IssueDetails action={action} flow={flow} device={device} />;
  if (action === "revoke") {
    return (
      <RevokeDetails
        reason={draft.reason}
        note={draft.note}
        problems={problems}
        onReason={(reason) => patch({ reason })}
        onNote={(note) => patch({ note })}
      />
    );
  }
  return (
    <RetireDetails
      reason={draft.retireReason}
      problem={problems.retireReason}
      onReason={(retireReason) => patch({ retireReason })}
    />
  );
}

function Details({
  action,
  flow,
  device,
  onClose,
}: Readonly<StepProps & { device: DeviceDetail }>): React.JSX.Element {
  const t = useT();
  return (
    <>
      <DetailFields action={action} flow={flow} device={device} />
      <div className="surface__actions">
        <GatedButton type="submit" className="btn-primary">
          {t("devices.flow.review")}
        </GatedButton>
        <button type="button" className="btn-secondary" onClick={onClose}>
          {t("common.cancel")}
        </button>
      </div>
    </>
  );
}

/** A refusal banner; after an issue that may have gone unanswered it points at the pending codes. */
function NoticeBanner({ flow }: Readonly<{ flow: LifecycleFlowState }>): React.JSX.Element | null {
  const t = useT();
  const { notice } = flow;
  if (!notice) return null;
  return (
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
  );
}

function Review({
  action,
  flow,
  onClose,
  timeZone,
}: Readonly<StepProps & { timeZone?: string }>): React.JSX.Element {
  const t = useT();
  const { canConfirm, pending, back } = flow;
  return (
    <>
      <NoticeBanner flow={flow} />
      <ReviewBody action={action} flow={flow} timeZone={timeZone} />
      <div className="surface__actions">
        {canConfirm ? (
          <GatedButton
            type="submit"
            className={isIssueAction(action) ? "btn-primary" : "btn-destructive"}
            disabled={pending}
          >
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {t(CONFIRM[action])}
          </GatedButton>
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

/** The issued code, with the store it will pair into and its time zone. */
function IssuedPanel({
  flow,
  timeZone,
}: Readonly<{ flow: LifecycleFlowState; timeZone?: string }>): React.JSX.Element | null {
  const directory = useStoreDirectory(useDeviceScope().tenantId);
  const { issued } = flow;
  if (!issued) return null;
  return (
    <IssuedCode
      issued={issued}
      storeName={directory.nameOf(issued.storeId)}
      timeZone={directory.timeZoneOf(issued.storeId) ?? timeZone}
    />
  );
}

function Done({
  flow,
  onClose,
  onSwitch,
  timeZone,
}: Readonly<{
  flow: LifecycleFlowState;
  onClose: () => void;
  onSwitch?: (action: FlowAction) => void;
  timeZone?: string;
}>): React.JSX.Element {
  const t = useT();
  const offer = flow.offerReplace && onSwitch !== undefined;
  return (
    <>
      <IssuedPanel flow={flow} timeZone={timeZone} />
      {flow.outcome ? <output className="device-impact__verdict">{t(flow.outcome)}</output> : null}
      {offer ? <p className="content__sub">{t("devices.revoke.nextStep")}</p> : null}
      <div className="surface__actions">
        {offer ? (
          <button type="button" className="btn-primary" onClick={() => onSwitch?.("replace")}>
            {t("devices.revoke.offerReplace")}
          </button>
        ) : null}
        <button type="button" className={offer ? "btn-secondary" : "btn-primary"} onClick={onClose}>
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
  /** Hand over to another action (after a security revoke, the replacement). */
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
  const flow = useLifecycleFlow(action, device);
  // While the server is answering, nothing closes the drawer (Escape, the scrim, the X):
  // an issued pairing code would land on an unmounted component and be lost.
  const busy = flow.pending;
  return (
    <Drawer title={t(TITLE[action])} onClose={onClose} dismissible={!busy}>
      <form className="surface__form" noValidate onSubmit={flow.onSubmit}>
        {flow.step === "details" ? (
          <Details action={action} flow={flow} device={device} onClose={onClose} />
        ) : null}
        {flow.step === "review" ? (
          <Review action={action} flow={flow} onClose={onClose} timeZone={timeZone} />
        ) : null}
        {flow.step === "done" ? (
          <Done flow={flow} onClose={onClose} onSwitch={onSwitch} timeZone={timeZone} />
        ) : null}
      </form>
    </Drawer>
  );
}
