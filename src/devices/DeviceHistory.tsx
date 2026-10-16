/**
 * RT-371 device detail, History tab: the revoke / retire / replace chain as the
 * contract exposes it. Events are the recorded timestamps (paired, revoked,
 * retired), oldest first; the replacement links carry no time in the contract,
 * so they are a relation, not a timed event. Actors are bare user ids (the
 * contract carries no names). A revoke recorded before RT-365 has no actor and
 * no reason: shown as "not recorded", never guessed.
 *
 * The revoke note and the retire reason are operator text returned on the
 * detail only. They render here and nowhere else (not in the list, the URL,
 * the title or a query key).
 */
import { DateTime, useT } from "@/i18n";
import type { DeviceDetail } from "@/lib/device-queries";
import { Link, useLocation } from "react-router";
import { Field } from "./DeviceOverview";
import { revokeReasonKey } from "./deviceLogic";
import "../shell/surface.css";
import "./devices.css";

function Actor({ userId }: Readonly<{ userId: string | null }>): React.JSX.Element {
  const t = useT();
  return userId ? (
    <bdi dir="ltr">{userId}</bdi>
  ) : (
    <span className="device-quiet">{t("devices.history.actorNotRecorded")}</span>
  );
}

function Event({
  title,
  at,
  timeZone,
  children,
}: Readonly<{
  title: string;
  at: string;
  timeZone?: string;
  children?: React.ReactNode;
}>): React.JSX.Element {
  return (
    <li className="device-history__event">
      <h3 className="device-history__title">{title}</h3>
      <DateTime value={at} timeZone={timeZone} />
      {children ? <dl className="surface__detail">{children}</dl> : null}
    </li>
  );
}

function RevokeEvent({
  device,
  timeZone,
}: Readonly<{ device: DeviceDetail; timeZone?: string }>): React.JSX.Element | null {
  const t = useT();
  if (!device.revokedAt) return null;
  return (
    <Event title={t("devices.history.revoked")} at={device.revokedAt} timeZone={timeZone}>
      <Field label={t("devices.history.by")} mono={device.revokedByUserId !== null}>
        <Actor userId={device.revokedByUserId} />
      </Field>
      <Field label={t("devices.history.reason")}>{t(revokeReasonKey(device))}</Field>
      {device.revokeNote ? (
        <Field label={t("devices.history.note")}>
          <bdi dir="auto">{device.revokeNote}</bdi>
        </Field>
      ) : null}
    </Event>
  );
}

function RetireEvent({
  device,
  timeZone,
}: Readonly<{ device: DeviceDetail; timeZone?: string }>): React.JSX.Element | null {
  const t = useT();
  if (!device.retiredAt) return null;
  return (
    <Event title={t("devices.history.retired")} at={device.retiredAt} timeZone={timeZone}>
      <Field label={t("devices.history.by")} mono={device.retiredByUserId !== null}>
        <Actor userId={device.retiredByUserId} />
      </Field>
      {device.retireReason ? (
        <Field label={t("devices.history.reason")}>
          <bdi dir="auto">{device.retireReason}</bdi>
        </Field>
      ) : null}
    </Event>
  );
}

/** A linked device in the replacement chain, or the honest "none / out of scope". */
function ChainLink({ deviceId }: Readonly<{ deviceId: string | null }>): React.JSX.Element {
  const t = useT();
  const state = useLocation().state;
  if (!deviceId) return <span className="device-quiet">{t("devices.history.noLink")}</span>;
  return (
    <Link to={`/devices/${deviceId}`} state={state}>
      <bdi dir="ltr">{deviceId}</bdi>
    </Link>
  );
}

export function DeviceHistory({
  device,
  timeZone,
}: Readonly<{ device: DeviceDetail; timeZone?: string }>): React.JSX.Element {
  const t = useT();
  return (
    <>
      <section className="device-section">
        <h2 className="surface__section-title">{t("devices.history.events")}</h2>
        <ol className="device-history">
          <Event title={t("devices.history.paired")} at={device.createdAt} timeZone={timeZone} />
          <RevokeEvent device={device} timeZone={timeZone} />
          <RetireEvent device={device} timeZone={timeZone} />
        </ol>
        {device.revokedAt ? null : <p className="content__sub">{t("devices.history.noRevoke")}</p>}
      </section>
      <section className="device-section">
        <h2 className="surface__section-title">{t("devices.history.chain")}</h2>
        <dl className="surface__detail">
          <Field label={t("devices.history.replaces")}>
            <ChainLink deviceId={device.replacesDeviceId} />
          </Field>
          <Field label={t("devices.history.replacedBy")}>
            <ChainLink deviceId={device.replacedByDeviceId} />
          </Field>
        </dl>
      </section>
    </>
  );
}
