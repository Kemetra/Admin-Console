/**
 * RT-372 — The lifecycle actions on a device: Revoke and Retire as separate
 * actions (there is no generic "Deactivate"), each opening its own flow where
 * the server's impact preview is shown before anything is confirmed. A retired
 * device is closed out and offers nothing. No bulk action exists.
 */
import { type MessageKey, useT } from "@/i18n";
import type { DeviceDetail } from "@/lib/device-queries";
import { useState } from "react";
import { type FlowAction, LifecycleFlow } from "./LifecycleFlow";
import { actionsFor } from "./lifecycleLogic";
import "./devices.css";

const LABELS: Record<FlowAction, MessageKey> = {
  revoke: "devices.actions.revoke",
  retire: "devices.actions.retire",
};

export function DeviceActions({
  device,
  timeZone,
}: Readonly<{ device: DeviceDetail; timeZone?: string }>): React.JSX.Element | null {
  const t = useT();
  const [open, setOpen] = useState<FlowAction | null>(null);
  const actions = actionsFor(device.trustState);

  if (device.trustState === "retired") {
    return <p className="content__sub">{t("devices.actions.closed")}</p>;
  }
  return (
    <>
      {actions.length > 0 ? (
        <section className="device-actions">
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
        </section>
      ) : null}
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
