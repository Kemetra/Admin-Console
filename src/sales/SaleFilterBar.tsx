/**
 * RT-587 sales search form (spec 012 J1). One store (required, no "All stores"
 * in v1, OD-556-2), an inclusive business-date range of at most 31 days, an
 * exact sale number and the contract's four status filters. Choosing a store
 * proposes today in that store's zone; nothing is read until Search applies
 * the form to the URL. The server stays the authority on the range (AC-2).
 */
import { GatedButton } from "@/components/GatedButton";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import type { StoreInfo } from "@/shift-closes/useShiftCloses";
import { useState } from "react";
import {
  ERP_STATES,
  type FilterErrors,
  MAX_SALE_NUMBER,
  RETURN_STATES,
  SYNC_STATUSES,
  type SaleFilters,
  emptyFilters,
  todayIn,
  validateFilters,
} from "./saleFilters";
import { erpStateKey, returnStateKey, syncStatusKey } from "./saleLogic";
import "./sales.css";

type FormErrors = FilterErrors & Partial<Record<"store" | "dates", MessageKey>>;

export interface SaleFilterBarProps {
  applied: SaleFilters;
  stores: readonly StoreInfo[];
  /** The active store, proposed when the URL names none (never applied by itself). */
  activeStoreId: string | null;
  /** Errors already present in the applied filters (a hand-edited URL). */
  initialErrors: FilterErrors;
  onApply: (filters: SaleFilters) => void;
  onClear: () => void;
}

type SetField = <K extends keyof SaleFilters>(key: K) => (value: SaleFilters[K]) => void;

function zoneOf(stores: readonly StoreInfo[], storeId: string): string | undefined {
  return stores.find((s) => s.id === storeId)?.timezone;
}

function hasAnyDate(draft: SaleFilters): boolean {
  return draft.fromDate !== "" || draft.toDate !== "";
}

/** Today in the store's zone for a chosen store with no dates yet (J1 default proposal). */
function propose(draft: SaleFilters, stores: readonly StoreInfo[]): SaleFilters {
  const store = stores.find((s) => s.id === draft.storeId);
  if (!store) return draft;
  if (hasAnyDate(draft)) return draft;
  const today = todayIn(store.timezone ?? "UTC");
  return { ...draft, fromDate: today, toDate: today };
}

function initialDraft(applied: SaleFilters, activeStoreId: string | null): SaleFilters {
  return applied.storeId || !activeStoreId ? applied : { ...applied, storeId: activeStoreId };
}

function requiredErrors(draft: SaleFilters): FormErrors {
  const errors: FormErrors = {};
  if (!draft.storeId) errors.store = "sales.filter.storeRequired";
  if (!draft.fromDate || !draft.toDate) errors.dates = "sales.filter.datesRequired";
  return errors;
}

function Field({
  id,
  label,
  error,
  note,
  children,
}: Readonly<{
  id: string;
  label: string;
  error?: MessageKey;
  note?: string;
  children: React.ReactNode;
}>): React.JSX.Element {
  const t = useT();
  return (
    <div className="sale-filters__field">
      <label htmlFor={id}>{label}</label>
      {children}
      {note ? (
        <small id={`${id}-note`} className="sale-filters__note">
          {note}
        </small>
      ) : null}
      <InlineError message={error ? t(error) : undefined} />
    </div>
  );
}

interface FieldsProps {
  draft: SaleFilters;
  set: SetField;
  errors: FormErrors;
}

function ScopeFields({
  draft,
  set,
  errors,
  stores,
  onStore,
}: Readonly<
  FieldsProps & { stores: readonly StoreInfo[]; onStore: (storeId: string) => void }
>): React.JSX.Element {
  const t = useT();
  const zone = zoneOf(stores, draft.storeId);
  const dateError = errors.date ?? errors.dates;
  return (
    <>
      <Field id="sl-store" label={t("sales.filter.store")} error={errors.store}>
        <select
          id="sl-store"
          className="input"
          required
          aria-invalid={errors.store ? true : undefined}
          value={draft.storeId}
          onChange={(e) => onStore(e.target.value)}
        >
          <option value="">{t("sales.filter.storePlaceholder")}</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id="sl-from" label={t("sales.filter.from")} error={dateError}>
        <input
          id="sl-from"
          type="date"
          className="input"
          required
          aria-invalid={dateError ? true : undefined}
          value={draft.fromDate}
          onChange={(e) => set("fromDate")(e.target.value)}
        />
      </Field>
      <Field id="sl-to" label={t("sales.filter.to")} error={errors.range}>
        <input
          id="sl-to"
          type="date"
          className="input"
          required
          aria-invalid={errors.range ? true : undefined}
          value={draft.toDate}
          onChange={(e) => set("toDate")(e.target.value)}
        />
      </Field>
      <p className="sale-filters__zone">
        {zone
          ? t.rich("sales.filter.zoneNote", { zone: <bdi dir="ltr">{zone}</bdi> })
          : t("sales.filter.zonePending")}
      </p>
    </>
  );
}

function Choice<V extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  value: V | "";
  options: readonly { value: V; label: string }[];
  onChange: (value: V | "") => void;
}>): React.JSX.Element {
  const t = useT();
  return (
    <Field id={id} label={label}>
      <select
        id={id}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value as V | "")}
      >
        <option value="">{t("sales.filter.any")}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function ValueFields({ draft, set, errors }: Readonly<FieldsProps>): React.JSX.Element {
  const t = useT();
  return (
    <>
      <Field
        id="sl-number"
        label={t("sales.filter.saleNumber")}
        error={errors.saleNumber}
        note={t("sales.filter.saleNumberNote")}
      >
        <input
          id="sl-number"
          className="input"
          dir="ltr"
          autoComplete="off"
          maxLength={MAX_SALE_NUMBER}
          aria-describedby="sl-number-note"
          aria-invalid={errors.saleNumber ? true : undefined}
          value={draft.saleNumber}
          onChange={(e) => set("saleNumber")(e.target.value)}
        />
      </Field>
      <Choice
        id="sl-sync"
        label={t("sales.filter.sync")}
        value={draft.syncStatus}
        options={SYNC_STATUSES.map((v) => ({
          value: v,
          label: t(syncStatusKey({ syncStatus: v })),
        }))}
        onChange={set("syncStatus")}
      />
      <Choice
        id="sl-voided"
        label={t("sales.filter.voided")}
        value={draft.voided}
        options={[
          { value: "true" as const, label: t("sales.filter.voidedTrue") },
          { value: "false" as const, label: t("sales.filter.voidedFalse") },
        ]}
        onChange={set("voided")}
      />
      <Choice
        id="sl-returns"
        label={t("sales.filter.returns")}
        value={draft.returnState}
        options={RETURN_STATES.map((v) => ({
          value: v,
          label: t(returnStateKey({ returnState: v })),
        }))}
        onChange={set("returnState")}
      />
      <Choice
        id="sl-erp"
        label={t("sales.filter.erp")}
        value={draft.erpState}
        options={ERP_STATES.map((v) => ({
          value: v,
          label: t(erpStateKey({ erpPostingState: v })),
        }))}
        onChange={set("erpState")}
      />
    </>
  );
}

export function SaleFilterBar({
  applied,
  stores,
  activeStoreId,
  initialErrors,
  onApply,
  onClear,
}: Readonly<SaleFilterBarProps>): React.JSX.Element {
  const t = useT();
  const [draft, setDraft] = useState<SaleFilters>(() => initialDraft(applied, activeStoreId));
  const [errors, setErrors] = useState<FormErrors>(initialErrors);

  // The URL is the source of truth: when the applied filters change from outside
  // (Back, a deep link) the draft follows. The form stays mounted, so keyboard
  // focus survives a Search.
  const appliedKey = JSON.stringify(applied);
  const [syncedKey, setSyncedKey] = useState(appliedKey);
  if (syncedKey !== appliedKey) {
    setSyncedKey(appliedKey);
    setDraft(initialDraft(applied, activeStoreId));
    setErrors(initialErrors);
  }
  // The roster arrives after the first render: propose today once its zone is known.
  const [rosterSize, setRosterSize] = useState(0);
  if (rosterSize !== stores.length) {
    setRosterSize(stores.length);
    setDraft((current) => propose(current, stores));
  }

  const set: SetField = (key) => (value) => setDraft((current) => ({ ...current, [key]: value }));

  function chooseStore(storeId: string): void {
    setDraft((current) => propose({ ...current, storeId }, stores));
  }

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const next: SaleFilters = { ...draft, saleNumber: draft.saleNumber.trim() };
    const found: FormErrors = { ...requiredErrors(next), ...validateFilters(next) };
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setDraft(next);
    onApply(next);
  }

  function clear(): void {
    setDraft(emptyFilters());
    setErrors({});
    onClear();
  }

  return (
    <form
      className="sale-filters"
      aria-label={t("sales.filter.label")}
      // Filters are not unsaved work: no Stay / Discard prompt for them (RT-268).
      data-dirty-guard="off"
      onSubmit={submit}
      noValidate
    >
      <ScopeFields draft={draft} set={set} errors={errors} stores={stores} onStore={chooseStore} />
      <ValueFields draft={draft} set={set} errors={errors} />
      <div className="sale-filters__actions">
        <GatedButton type="submit" className="btn-primary">
          {t("sales.filter.apply")}
        </GatedButton>
        <button type="button" className="btn-ghost" onClick={clear}>
          {t("sales.filter.clear")}
        </button>
      </div>
    </form>
  );
}
