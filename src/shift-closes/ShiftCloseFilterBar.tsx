/**
 * RT-18 filter bar. Only the filters the generated client has: store, a closed
 * date range, close kind, a minimum absolute variance, currency, and whether an
 * approver was recorded. One primary Apply, a quiet Clear. A date is read in the
 * selected store's zone, else UTC, and the bar says which. The bar never offers
 * a zero-variance view: "exception" is non-zero variance only, set in the query.
 */
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import { useState } from "react";
import {
  type FilterErrors,
  type ShiftCloseFilters,
  filtersFromSearch,
  validateFilters,
} from "./shiftCloseFilters";
import type { StoreInfo } from "./useShiftCloses";
import "./shift-closes.css";

export interface ShiftCloseFilterBarProps {
  applied: ShiftCloseFilters;
  stores: readonly StoreInfo[];
  /** Errors already present in the applied filters (a hand-edited URL). */
  initialErrors: FilterErrors;
  onApply: (filters: ShiftCloseFilters) => void;
  onClear: () => void;
}

type Draft = ShiftCloseFilters;

const EMPTY_DRAFT: Draft = filtersFromSearch(new URLSearchParams());
type SetField = <K extends keyof Draft>(key: K) => (value: Draft[K]) => void;

interface FieldsProps {
  draft: Draft;
  set: SetField;
  errors: FilterErrors;
}

function Field({
  id,
  label,
  error,
  children,
}: Readonly<{
  id: string;
  label: string;
  error?: MessageKey;
  children: React.ReactNode;
}>): React.JSX.Element {
  const t = useT();
  return (
    <div className="shift-filters__field">
      <label htmlFor={id}>{label}</label>
      {children}
      <InlineError message={error ? t(error) : undefined} />
    </div>
  );
}

function ScopeFields({
  draft,
  set,
  errors,
  stores,
}: Readonly<FieldsProps & { stores: readonly StoreInfo[] }>): React.JSX.Element {
  const t = useT();
  const zone = stores.find((s) => s.id === draft.storeId)?.timezone ?? "UTC";
  return (
    <>
      <Field id="sf-store" label={t("shift.filter.store")}>
        <select
          id="sf-store"
          className="input"
          value={draft.storeId}
          onChange={(e) => set("storeId")(e.target.value)}
        >
          <option value="">{t("shift.filter.allStores")}</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id="sf-from" label={t("shift.filter.from")} error={errors.date}>
        <input
          id="sf-from"
          type="date"
          aria-invalid={errors.date ? true : undefined}
          className="input"
          value={draft.fromDate}
          onChange={(e) => set("fromDate")(e.target.value)}
        />
      </Field>
      <Field id="sf-to" label={t("shift.filter.to")} error={errors.range}>
        <input
          id="sf-to"
          type="date"
          className="input"
          aria-invalid={errors.range ? true : undefined}
          value={draft.toDate}
          onChange={(e) => set("toDate")(e.target.value)}
        />
      </Field>
      <p className="shift-filters__zone">
        {t.rich("shift.filter.zoneNote", { zone: <bdi dir="ltr">{zone}</bdi> })}
      </p>
    </>
  );
}

function ValueFields({ draft, set, errors }: Readonly<FieldsProps>): React.JSX.Element {
  const t = useT();
  return (
    <>
      <Field id="sf-kind" label={t("shift.filter.kind")}>
        <select
          id="sf-kind"
          className="input"
          value={draft.closeKind}
          onChange={(e) => set("closeKind")(e.target.value as Draft["closeKind"])}
        >
          <option value="">{t("shift.filter.kindAny")}</option>
          <option value="normal">{t("shift.kind.normal")}</option>
          <option value="forced">{t("shift.kind.forced")}</option>
        </select>
      </Field>
      <Field id="sf-min" label={t("shift.filter.minVariance")} error={errors.minVariance}>
        <input
          id="sf-min"
          className="input"
          dir="ltr"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={errors.minVariance ? true : undefined}
          value={draft.minVariance}
          onChange={(e) => set("minVariance")(e.target.value)}
        />
      </Field>
      <Field id="sf-currency" label={t("shift.filter.currency")} error={errors.currency}>
        <input
          id="sf-currency"
          className="input"
          dir="ltr"
          maxLength={3}
          autoComplete="off"
          aria-invalid={errors.currency ? true : undefined}
          value={draft.currency}
          onChange={(e) => set("currency")(e.target.value)}
        />
      </Field>
      <Field id="sf-approval" label={t("shift.filter.approval")}>
        <select
          id="sf-approval"
          className="input"
          value={draft.approval}
          onChange={(e) => set("approval")(e.target.value as Draft["approval"])}
        >
          <option value="">{t("shift.filter.approvalAny")}</option>
          <option value="approved">{t("shift.filter.approvalApproved")}</option>
          <option value="not_approved">{t("shift.filter.approvalNotApproved")}</option>
        </select>
      </Field>
    </>
  );
}

export function ShiftCloseFilterBar({
  applied,
  stores,
  initialErrors,
  onApply,
  onClear,
}: Readonly<ShiftCloseFilterBarProps>): React.JSX.Element {
  const t = useT();
  const [draft, setDraft] = useState<Draft>(applied);
  const [errors, setErrors] = useState<FilterErrors>(initialErrors);

  // The URL is the source of truth: when the applied filters change from outside
  // (Back, a deep link) the draft follows. The form itself stays mounted, so
  // keyboard focus survives an Apply.
  const appliedKey = JSON.stringify(applied);
  const [syncedKey, setSyncedKey] = useState(appliedKey);
  if (syncedKey !== appliedKey) {
    setSyncedKey(appliedKey);
    setDraft(applied);
    setErrors(initialErrors);
  }

  const set: SetField = (key) => (value) => setDraft((current) => ({ ...current, [key]: value }));

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const next: Draft = {
      ...draft,
      minVariance: draft.minVariance.trim(),
      currency: draft.currency.trim().toUpperCase(),
    };
    const found = validateFilters(next);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setDraft(next);
    onApply(next);
  }

  function clear(): void {
    setDraft(EMPTY_DRAFT);
    setErrors({});
    onClear();
  }

  return (
    <form
      className="shift-filters"
      aria-label={t("shift.filter.label")}
      // Filters are not unsaved work: no Stay / Discard prompt for them (RT-268).
      data-dirty-guard="off"
      onSubmit={submit}
      noValidate
    >
      <ScopeFields draft={draft} set={set} errors={errors} stores={stores} />
      <ValueFields draft={draft} set={set} errors={errors} />
      <div className="shift-filters__actions">
        <button type="submit" className="btn-primary">
          {t("shift.filter.apply")}
        </button>
        <button type="button" className="btn-ghost" onClick={clear}>
          {t("shift.filter.clear")}
        </button>
      </div>
    </form>
  );
}
