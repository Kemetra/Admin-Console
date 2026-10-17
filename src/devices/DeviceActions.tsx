/**
 * RT-372 — The lifecycle actions on a device: Revoke and Retire as separate
 * actions (there is no generic "Deactivate"), each opening its own flow where
 * the server's impact preview is shown before anything is confirmed. A retired
 * device is closed out and offers nothing. No bulk action exists.
 *
 * An open flow is rendered whatever the device now is: a successful revoke or
 * retire refetches the device, and the drawer's done step must outlive that.
 * When the action that opened it is gone (a retired device offers nothing),
 * focus returns to the actions region rather than falling to the page body.
 */
import { type MessageKey, useT } from "@/i18n";
import type { DeviceDetail } from "@/lib/device-queries";
import { useEffect, useRef, useState } from "react";
import { LifecycleFlow } from "./LifecycleFlow";
import type { FlowAction } from "./flowTypes";
import { actionsFor } from "./lifecycleLogic";
import "./devices.css";

const LABELS: Record<FlowAction, MessageKey> = {
  revoke: "devices.actions.revoke",
  retire: "devices.actions.retire",
};

export function DeviceActions({
  device,
  timeZone,
}: Readonly<{ device: DeviceDetail; timeZone?: string }>): React.JSX.Element {
  const t = useT();
  const [open, setOpen] = useState<FlowAction | null>(null);
  const region = useRef<HTMLElement>(null);
  const actions = actionsFor(device.trustState);

  // The drawer returns focus to the button that opened it; if that button no longer
  // exists, keep the operator's place instead of dropping to <body>.
  // Only after a flow was open and has just closed: never on arrival at the page.
  const wasOpen = useRef(false);
  useEffect(() => {
    const justClosed = open === null && wasOpen.current;
    wasOpen.current = open !== null;
    if (justClosed && document.activeElement === document.body) region.current?.focus();
  }, [open]);

  return (
    <>
      <section className="device-actions" ref={region} tabIndex={-1}>
        {device.trustState === "retired" ? (
          <p className="content__sub">{t("devices.actions.closed")}</p>
        ) : actions.length > 0 ? (
          <>
            <fieldset className="device-actions__bar" aria-label={t("devices.actions.label")}>
              {actions.map((action) => (
                <button
                  key={action}
                  type="button"
                  className="btn-secondary"
                  onClick={() => setOpen(action)}
                >
                  {t(LABELS[action])}
                </button>
              ))}
            </fieldset>
            <small className="device-quiet">{t("devices.actions.hint")}</small>
          </>
        ) : null}
      </section>
      {open ? (
        <LifecycleFlow
          key={open}
          action={open}
          device={device}
          timeZone={timeZone}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}
