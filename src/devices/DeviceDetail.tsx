import { BackArrow } from "@/components/BackArrow";
import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { useT } from "@/i18n";
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
import { useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { DeviceHistory } from "./DeviceHistory";
import { DeviceOverview } from "./DeviceOverview";
import { type DeviceError, useDeviceDetail, useDeviceScope } from "./useDevices";
import "../components/banner.css";
import "../shell/surface.css";
import "./devices.css";

type Tab = "overview" | "history";
const TABS: readonly Tab[] = ["overview", "history"];

/** The list's search string (its filters), kept in navigation state by the list. */
function useBackSearch(): string {
  const state = useLocation().state as { list?: unknown } | null;
  const list = state?.list;
  return typeof list === "string" && list.startsWith("?") ? list : "";
}

function BackLink(): React.JSX.Element {
  const t = useT();
  return (
    <Link to={{ pathname: "/devices", search: useBackSearch() }} className="surface__back">
      <BackArrow /> {t("devices.detail.back")}
    </Link>
  );
}

function CustodyException({ shiftId }: Readonly<{ shiftId: string }>): React.JSX.Element {
  const t = useT();
  return (
    <div className="rtc-alert rtc-alert--danger">
      <strong className="rtc-alert__title">{t("devices.custody.title")}</strong>
      <span className="rtc-alert__body">
        {t.rich("devices.custody.body", { shift: <bdi dir="ltr">{shiftId}</bdi> })}
      </span>
    </div>
  );
}

/**
 * WAI-ARIA tabs with automatic activation. With two tabs, either arrow moves to
 * the other one, so the keys behave the same in RTL and LTR.
 */
function DeviceTabs({
  selected,
  onSelect,
}: Readonly<{ selected: Tab; onSelect: (tab: Tab) => void }>): React.JSX.Element {
  const t = useT();
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ overview: null, history: null });

  function move(event: React.KeyboardEvent): void {
    const index = TABS.indexOf(selected);
    const targets: Record<string, number> = {
      ArrowLeft: (index + 1) % TABS.length,
      ArrowRight: (index + 1) % TABS.length,
      Home: 0,
      End: TABS.length - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    onSelect(TABS[target]);
    refs.current[TABS[target]]?.focus();
  }

  return (
    <div className="device-tabs" role="tablist" aria-label={t("devices.detail.tabs")}>
      {TABS.map((tab) => (
        <button
          key={tab}
          ref={(el) => {
            refs.current[tab] = el;
          }}
          type="button"
          role="tab"
          id={`device-tab-${tab}`}
          // Only the selected panel is rendered, so only its tab points at it.
          aria-controls={selected === tab ? `device-panel-${tab}` : undefined}
          aria-selected={selected === tab}
          tabIndex={selected === tab ? 0 : -1}
          className="device-tab"
          onClick={() => onSelect(tab)}
          onKeyDown={move}
        >
          {t(`devices.detail.tab.${tab}`)}
        </button>
      ))}
    </div>
  );
}

interface LoadedProps {
  device: Detail;
  storeName?: string;
  timeZone?: string;
}

function Loaded({ device, storeName, timeZone }: Readonly<LoadedProps>): React.JSX.Element {
  const t = useT();
  const location = useLocation();
  const [search, setSearch] = useSearchParams();
  const [now] = useState(() => Date.now());
  const tab: Tab = search.get("tab") === "history" ? "history" : "overview";

  // Keep the navigation state (the list's filters for Back) across tab changes.
  const select = (next: Tab) =>
    setSearch(next === "overview" ? {} : { tab: next }, { replace: true, state: location.state });

  return (
    <div className="surface">
      <BackLink />
      <header className="surface__head">
        <div>
          <h1 className="content__title">
            {device.label ? (
              <bdi dir="auto">{device.label}</bdi>
            ) : (
              t("devices.detail.unlabelledTitle")
            )}
          </h1>
          <p className="content__sub">
            {storeName ?? t("devices.list.unknownStore")}
            {" · "}
            {t.rich("devices.detail.zoneNote", { zone: <bdi dir="ltr">{timeZone ?? "UTC"}</bdi> })}
          </p>
        </div>
      </header>
      {device.custodyExceptionShiftId ? (
        <CustodyException shiftId={device.custodyExceptionShiftId} />
      ) : null}
      <DeviceTabs selected={tab} onSelect={select} />
      <div
        className="device-tabpanel"
        role="tabpanel"
        id={`device-panel-${tab}`}
        aria-labelledby={`device-tab-${tab}`}
      >
        {tab === "overview" ? (
          <DeviceOverview device={device} storeName={storeName} timeZone={timeZone} now={now} />
        ) : (
          <DeviceHistory device={device} timeZone={timeZone} />
        )}
      </div>
    </div>
  );
}

function ErrorView({
  error,
  onRetry,
}: Readonly<{ error: DeviceError; onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      {error.kind === "not-found" ? (
        <ListState state="empty" emptyMessage={t("devices.detail.notFound")} />
      ) : (
        <Banner
          variant="danger"
          message={t(
            error.kind === "session" ? "devices.list.sessionExpired" : "devices.detail.loadFailed",
          )}
          requestId={error.requestId}
          action={
            error.kind === "session" ? undefined : (
              <button type="button" className="btn-secondary" onClick={onRetry}>
                {t("devices.detail.retry")}
              </button>
            )
          }
        />
      )}
      <BackLink />
    </div>
  );
}

export function DeviceDetail(): React.JSX.Element {
  const t = useT();
  const scope = useDeviceScope();
  const { deviceId } = useParams();
  const { device, isLoading, error, retry } = useDeviceDetail(scope, deviceId);
  const store = useStoreOf(device?.storeId);

  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("devices.list.scopePrompt")}</p>
      </div>
    );
  }
  // Hold the times back until the store's zone has settled (never UTC by accident).
  if (isLoading || (device !== undefined && !store.ready)) {
    return (
      <div className="surface">
        <ListState state="loading" label={t("devices.detail.loadingNoun")} />
      </div>
    );
  }
  if (error) return <ErrorView error={error} onRetry={retry} />;
  if (!device) return <div className="surface" />;
  return <Loaded device={device} storeName={store.name} timeZone={store.timeZone} />;
}
