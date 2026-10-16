import { BackArrow } from "@/components/BackArrow";
import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { type MessageKey, useT } from "@/i18n";
import type { DeviceDetail as Detail } from "@/lib/device-queries";
import { useStoreOf } from "@/shift-closes/useShiftCloses";
/**
 * RT-371 — One device (read-only): an Overview tab and a History tab, the
 * selected tab kept in the URL (`?tab=history`) so it can be linked and Back
 * restores it. There is no Health tab: it arrives with RT-327, and a disabled
 * placeholder would be a dead destination. No lifecycle action is offered here
 * (revoke / replace / move / retire are RT-372).
 *
 * An open custody exception is stated above the tabs as what it is: the open
 * shift stays on this revoked device until it is closed. Nothing here resolves
 * it. A 404 is the API's uniform refusal and reads as not available.
 */
import { useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { DeviceHistory } from "./DeviceHistory";
import { DeviceOverview } from "./DeviceOverview";
import {
  CustodyException,
  type DeviceTab,
  DeviceTabs,
  panelIdOf,
  tabFromSearch,
  tabIdOf,
} from "./DeviceTabs";
import { listSearchFrom } from "./deviceLogic";
import { type DeviceError, useDeviceDetail, useDeviceScope } from "./useDevices";
import "../shell/surface.css";
import "./devices.css";

/** Back to the registry with the filters the list put in the navigation state. */
function BackToDevices(): React.JSX.Element {
  const t = useT();
  const search = listSearchFrom(useLocation().state);
  return (
    <Link to={{ pathname: "/devices", search }} className="surface__back">
      <BackArrow /> {t("devices.detail.back")}
    </Link>
  );
}

interface LoadedProps {
  device: Detail;
  storeName?: string;
  timeZone?: string;
}

function DeviceHeading({ device, storeName, timeZone }: Readonly<LoadedProps>): React.JSX.Element {
  const t = useT();
  const title = device.label ? (
    <bdi dir="auto">{device.label}</bdi>
  ) : (
    t("devices.detail.unlabelledTitle")
  );
  return (
    <header className="surface__head">
      <div>
        <h1 className="content__title">{title}</h1>
        <p className="content__sub">
          {storeName ?? t("devices.list.unknownStore")}
          {" · "}
          {t.rich("devices.detail.zoneNote", { zone: <bdi dir="ltr">{timeZone ?? "UTC"}</bdi> })}
        </p>
      </div>
    </header>
  );
}

function Loaded(props: Readonly<LoadedProps>): React.JSX.Element {
  const { device, storeName, timeZone } = props;
  const location = useLocation();
  const [search, setSearch] = useSearchParams();
  const [now] = useState(() => Date.now());
  const tab = tabFromSearch(search);

  // Keep the navigation state (the list's filters for Back) across tab changes.
  const select = (next: DeviceTab) =>
    setSearch(next === "overview" ? {} : { tab: next }, { replace: true, state: location.state });

  return (
    <div className="surface">
      <BackToDevices />
      <DeviceHeading {...props} />
      {device.custodyExceptionShiftId ? (
        <CustodyException shiftId={device.custodyExceptionShiftId} />
      ) : null}
      <DeviceTabs selected={tab} onSelect={select} />
      <div
        className="device-tabpanel"
        role="tabpanel"
        id={panelIdOf(tab)}
        aria-labelledby={tabIdOf(tab)}
      >
        {tab === "history" ? (
          <DeviceHistory device={device} timeZone={timeZone} />
        ) : (
          <DeviceOverview device={device} storeName={storeName} timeZone={timeZone} now={now} />
        )}
      </div>
    </div>
  );
}

const FAILURE_KEYS: Record<Exclude<DeviceError["kind"], "not-found">, MessageKey> = {
  session: "devices.list.sessionExpired",
  rejected: "devices.detail.loadFailed",
  generic: "devices.detail.loadFailed",
};

/** A refusal reads as not available; any other failure is a banner (a retry unless the session ended). */
function Failure({
  error,
  onRetry,
}: Readonly<{ error: DeviceError; onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  if (error.kind === "not-found") {
    return <ListState state="empty" emptyMessage={t("devices.detail.notFound")} />;
  }
  const retry =
    error.kind === "session" ? undefined : (
      <button type="button" className="btn-secondary" onClick={onRetry}>
        {t("devices.detail.retry")}
      </button>
    );
  return (
    <Banner
      variant="danger"
      message={t(FAILURE_KEYS[error.kind])}
      requestId={error.requestId}
      action={retry}
    />
  );
}

function Notice({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <div className="surface">{children}</div>;
}

/** Hold the times back until the store's zone has settled (never UTC by accident). */
function awaitingZone(device: Detail | undefined, storeReady: boolean): boolean {
  return device !== undefined && !storeReady;
}

export function DeviceDetail(): React.JSX.Element {
  const t = useT();
  const scope = useDeviceScope();
  const { deviceId } = useParams();
  const { device, isLoading, error, retry } = useDeviceDetail(scope, deviceId);
  const store = useStoreOf(device?.storeId);
  const pending = isLoading || awaitingZone(device, store.ready);

  if (!scope.tenantId) {
    return (
      <Notice>
        <p className="content__sub">{t("devices.list.scopePrompt")}</p>
      </Notice>
    );
  }
  if (pending) {
    return (
      <Notice>
        <ListState state="loading" label={t("devices.detail.loadingNoun")} />
      </Notice>
    );
  }
  if (error) {
    return (
      <Notice>
        <Failure error={error} onRetry={retry} />
        <BackToDevices />
      </Notice>
    );
  }
  if (!device) return <Notice>{null}</Notice>;
  return <Loaded device={device} storeName={store.name} timeZone={store.timeZone} />;
}
