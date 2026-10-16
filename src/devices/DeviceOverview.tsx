/**
 * RT-371 device detail, Overview tab: identity, store, label, trust state,
 * credential expiry and last seen with its source. Read-only. There is no
 * health field: last seen is activity, and the tab says so (RT-287 D-Q6).
 */
import { DateTime, useT } from "@/i18n";
import type { DeviceDetail } from "@/lib/device-queries";
import { LastSeen, TrustBadge } from "./DeviceParts";
import { isPastExpiry } from "./deviceLogic";
import "../shell/surface.css";
import "./devices.css";

export function Field({
  label,
  mono,
  children,
}: Readonly<{ label: string; mono?: boolean; children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="field-row">
      <dt className="field-row__label">{label}</dt>
      <dd className={mono ? "field-row__value field-row__value--mono" : "field-row__value"}>
        {children}
      </dd>
    </div>
  );
}

export interface DeviceViewProps {
  device: DeviceDetail;
  storeName?: string;
  timeZone?: string;
  now: number;
}

function Expiry({ device, timeZone, now }: Readonly<DeviceViewProps>): React.JSX.Element {
  const t = useT();
  const passed = device.trustState === "active" && isPastExpiry(device.expiresAt, now);
  return (
    <span className="device-name">
      <DateTime value={device.expiresAt} timeZone={timeZone} />
      {passed ? (
        <span className="device-flag device-flag--warning">
          {t("devices.attention.pastExpiry")}
        </span>
      ) : null}
      <small className="device-quiet">{t("devices.field.expiryNote")}</small>
    </span>
  );
}

export function DeviceOverview(props: Readonly<DeviceViewProps>): React.JSX.Element {
  const t = useT();
  const { device, storeName, timeZone } = props;
  return (
    <section className="device-section">
      <dl className="surface__detail">
        <Field label={t("devices.field.deviceId")} mono>
          <bdi dir="ltr">{device.deviceId}</bdi>
        </Field>
        <Field label={t("devices.field.label")}>
          {device.label ? (
            <bdi dir="auto">{device.label}</bdi>
          ) : (
            <span className="device-quiet">{t("devices.list.unlabelled")}</span>
          )}
        </Field>
        <Field label={t("devices.field.store")}>
          {storeName ?? t("devices.list.unknownStore")}
        </Field>
        <Field label={t("devices.field.trust")}>
          <TrustBadge trustState={device.trustState} />
        </Field>
        <Field label={t("devices.field.pairedAt")}>
          <DateTime value={device.createdAt} timeZone={timeZone} />
        </Field>
        <Field label={t("devices.field.expiresAt")}>
          <Expiry {...props} />
        </Field>
        <Field label={t("devices.field.lastSeen")}>
          <LastSeen
            lastSeenAt={device.lastSeenAt}
            lastSeenSource={device.lastSeenSource}
            timeZone={timeZone}
            showSource
          />
        </Field>
      </dl>
      <p className="content__sub">{t("devices.lastSeen.notHealth")}</p>
    </section>
  );
}
