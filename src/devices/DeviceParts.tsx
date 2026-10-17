/**
 * RT-371 shared presenters for the fleet table and the device detail. Each
 * state renders as text first (UX-02); colour only reinforces it. Nothing here
 * renders "healthy": trust state is the credential's state, last seen is
 * activity with its source, and unknown stays unknown (RT-287 D-Q6).
 */
import { DateTime, useT } from "@/i18n";
import { isPastExpiry, lastSeenView, trustStateView } from "./deviceLogic";
import "./devices.css";

/** A time is an LTR run inside either direction's sentence or row. */
export function LtrTime({
  value,
  timeZone,
}: Readonly<{ value: string; timeZone?: string }>): React.JSX.Element {
  return (
    <bdi dir="ltr">
      <DateTime value={value} timeZone={timeZone} />
    </bdi>
  );
}

/** The terminal label, or a quiet "No label"; the id is machine data (UX-11). */
export function DeviceName({
  label,
  deviceId,
}: Readonly<{ label: string | null; deviceId: string }>): React.JSX.Element {
  const t = useT();
  return (
    <span className="device-name">
      {label ? (
        <bdi dir="auto">{label}</bdi>
      ) : (
        <span className="device-quiet">{t("devices.list.unlabelled")}</span>
      )}
      <bdi dir="ltr" className="device-name__id">
        {deviceId}
      </bdi>
    </span>
  );
}

export function TrustBadge({ trustState }: Readonly<{ trustState: string }>): React.JSX.Element {
  const t = useT();
  const view = trustStateView({ trustState });
  const tone = view.tone === "neutral" ? "" : ` device-trust--${view.tone}`;
  return <span className={`badge${tone}`}>{t(view.key)}</span>;
}

/** Last seen with its source label, or Unknown in the danger role. */
export function LastSeen({
  lastSeenAt,
  lastSeenSource,
  timeZone,
  showSource = false,
}: Readonly<{
  lastSeenAt: string | null;
  lastSeenSource: string | null;
  timeZone?: string;
  showSource?: boolean;
}>): React.JSX.Element {
  const t = useT();
  const view = lastSeenView({ lastSeenAt, lastSeenSource });
  if (view.kind === "unknown") {
    return <span className="device-flag device-flag--danger">{t(view.key)}</span>;
  }
  return (
    <span className="device-name">
      <DateTime value={view.at} timeZone={timeZone} />
      {showSource || !view.sourceKnown ? (
        <small className={view.sourceKnown ? "device-quiet" : "device-flag device-flag--danger"}>
          {t(view.sourceKey)}
        </small>
      ) : null}
    </span>
  );
}

/**
 * What needs attention on a row, from recorded fields only: an open custody
 * exception (the server ranks it first), and an expiry that has passed but is
 * not enforced yet. No "expiring soon" threshold is invented.
 */
export function Attention({
  device,
  now,
}: Readonly<{
  device: { custodyExceptionShiftId: string | null; trustState: string; expiresAt: string };
  now: number;
}>): React.JSX.Element {
  const t = useT();
  const flags: React.JSX.Element[] = [];
  if (device.custodyExceptionShiftId) {
    flags.push(
      <span key="custody" className="device-flag device-flag--danger">
        {t("devices.attention.custody")}
      </span>,
    );
  }
  if (device.trustState === "active" && isPastExpiry(device.expiresAt, now)) {
    flags.push(
      <span key="expiry" className="device-flag device-flag--warning">
        {t("devices.attention.pastExpiry")}
      </span>,
    );
  }
  if (flags.length === 0) {
    return <span className="device-quiet">{t("devices.list.noAttention")}</span>;
  }
  return <span className="device-name">{flags}</span>;
}
