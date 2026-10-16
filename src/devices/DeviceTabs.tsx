/**
 * RT-371 device detail chrome: the Overview / History tablist and the open
 * custody-exception notice. The tablist is the WAI-ARIA tabs pattern with
 * automatic activation; with two tabs either arrow moves to the other one, so
 * the keys behave the same in RTL and LTR. Only the selected panel is rendered,
 * so only the selected tab carries `aria-controls`.
 */
import { useT } from "@/i18n";
import { useRef } from "react";
import "../components/banner.css";
import "./devices.css";

export type DeviceTab = "overview" | "history";
export const DEVICE_TABS: readonly DeviceTab[] = ["overview", "history"];

/** The tab named in the URL; anything else is the Overview. */
export function tabFromSearch(search: URLSearchParams): DeviceTab {
  return search.get("tab") === "history" ? "history" : "overview";
}

/** The tab a key moves to from `current`, or undefined for any other key. */
export function tabForKey(key: string, current: DeviceTab): DeviceTab | undefined {
  const other = DEVICE_TABS[(DEVICE_TABS.indexOf(current) + 1) % DEVICE_TABS.length];
  const targets: Record<string, DeviceTab> = {
    ArrowLeft: other,
    ArrowRight: other,
    Home: DEVICE_TABS[0],
    End: DEVICE_TABS[DEVICE_TABS.length - 1],
  };
  return targets[key];
}

export function panelIdOf(tab: DeviceTab): string {
  return `device-panel-${tab}`;
}

export function tabIdOf(tab: DeviceTab): string {
  return `device-tab-${tab}`;
}

export function DeviceTabs({
  selected,
  onSelect,
}: Readonly<{ selected: DeviceTab; onSelect: (tab: DeviceTab) => void }>): React.JSX.Element {
  const t = useT();
  const refs = useRef(new Map<DeviceTab, HTMLButtonElement>());

  function onKeyDown(event: React.KeyboardEvent): void {
    const target = tabForKey(event.key, selected);
    if (!target) return;
    event.preventDefault();
    onSelect(target);
    refs.current.get(target)?.focus();
  }

  return (
    <div className="device-tabs" role="tablist" aria-label={t("devices.detail.tabs")}>
      {DEVICE_TABS.map((tab) => {
        const isSelected = selected === tab;
        return (
          <button
            key={tab}
            ref={(el) => {
              if (el) refs.current.set(tab, el);
            }}
            type="button"
            role="tab"
            id={tabIdOf(tab)}
            aria-controls={isSelected ? panelIdOf(tab) : undefined}
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className="device-tab"
            onClick={() => onSelect(tab)}
            onKeyDown={onKeyDown}
          >
            {t(`devices.detail.tab.${tab}`)}
          </button>
        );
      })}
    </div>
  );
}

/** The open shift stays on this revoked device until it is closed: stated, not acted on. */
export function CustodyException({ shiftId }: Readonly<{ shiftId: string }>): React.JSX.Element {
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
