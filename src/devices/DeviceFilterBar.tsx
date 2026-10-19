import { GatedButton } from "@/components/GatedButton";
import { useT } from "@/i18n";
/**
 * RT-371 filter bar: store and trust state, the two filters the contract has.
 * One primary Apply, a quiet Clear. A store in the URL that the caller's roster
 * does not list (a hand-edited or stale link) stays selected and is named as
 * such; the server decides whether it is readable.
 */
import type { TrustState } from "@/lib/device-queries";
import type { StoreInfo } from "@/shift-closes/useShiftCloses";
import { useState } from "react";
import { type DeviceFilters, EMPTY_FILTERS } from "./deviceFilters";
import "./devices.css";

export interface DeviceFilterBarProps {
  applied: DeviceFilters;
  stores: readonly StoreInfo[];
  onApply: (filters: DeviceFilters) => void;
  onClear: () => void;
}

const TRUST_OPTIONS: {
  value: TrustState;
  key: "devices.trust.active" | "devices.trust.revoked" | "devices.trust.retired";
}[] = [
  { value: "active", key: "devices.trust.active" },
  { value: "revoked", key: "devices.trust.revoked" },
  { value: "retired", key: "devices.trust.retired" },
];

export function DeviceFilterBar({
  applied,
  stores,
  onApply,
  onClear,
}: Readonly<DeviceFilterBarProps>): React.JSX.Element {
  const t = useT();
  const [draft, setDraft] = useState<DeviceFilters>(applied);

  // The URL is the source of truth: when the applied filters change from outside
  // (Back, a deep link) the draft follows. The form stays mounted, so keyboard
  // focus survives an Apply.
  const appliedKey = JSON.stringify(applied);
  const [syncedKey, setSyncedKey] = useState(appliedKey);
  if (syncedKey !== appliedKey) {
    setSyncedKey(appliedKey);
    setDraft(applied);
  }

  const unlisted = draft.storeId !== "" && !stores.some((s) => s.id === draft.storeId);

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    onApply(draft);
  }

  function clear(): void {
    setDraft(EMPTY_FILTERS);
    onClear();
  }

  return (
    <form
      className="device-filters"
      aria-label={t("devices.filter.label")}
      // Filters are not unsaved work: no Stay / Discard prompt for them (RT-268).
      data-dirty-guard="off"
      onSubmit={submit}
      noValidate
    >
      <div className="device-filters__field">
        <label htmlFor="df-store">{t("devices.filter.store")}</label>
        <select
          id="df-store"
          className="input"
          value={draft.storeId}
          onChange={(e) => setDraft({ ...draft, storeId: e.target.value })}
        >
          <option value="">{t("devices.filter.allStores")}</option>
          {unlisted ? (
            <option value={draft.storeId}>{t("devices.filter.unlistedStore")}</option>
          ) : null}
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="device-filters__field">
        <label htmlFor="df-trust">{t("devices.filter.trust")}</label>
        <select
          id="df-trust"
          className="input"
          value={draft.trustState}
          onChange={(e) =>
            setDraft({ ...draft, trustState: e.target.value as DeviceFilters["trustState"] })
          }
        >
          <option value="">{t("devices.filter.trustAny")}</option>
          {TRUST_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.key)}
            </option>
          ))}
        </select>
      </div>
      <div className="device-filters__actions">
        <GatedButton type="submit" className="btn-primary">
          {t("devices.filter.apply")}
        </GatedButton>
        <button type="button" className="btn-ghost" onClick={clear}>
          {t("devices.filter.clear")}
        </button>
      </div>
    </form>
  );
}
