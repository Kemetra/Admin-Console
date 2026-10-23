/**
 * RT-821 (VIZ-3) the report's range: an inclusive business-date range of at
 * most 31 days. The contract's rule is checked here before anything is read,
 * and a server 400 still lands at the field (`serverError`). Nothing is read
 * until Show applies the draft to the URL.
 */
import { GatedButton } from "@/components/GatedButton";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import { useState } from "react";
import { type DailyRange, type RangeErrors, validateRange } from "./dailyLogic";
import "../sales/sales.css";

function DateField({
  id,
  label,
  value,
  error,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  error?: MessageKey;
  onChange: (value: string) => void;
}>): React.JSX.Element {
  const t = useT();
  return (
    <div className="sale-filters__field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="date"
        className="input"
        required
        aria-invalid={error ? true : undefined}
        aria-describedby="sd-range-note"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <InlineError message={error ? t(error) : undefined} />
    </div>
  );
}

export function DailyRangeForm({
  range,
  zoneNote,
  serverError,
  onApply,
}: Readonly<{
  /** The applied range (URL or default); null while the default waits for the store zone. */
  range: DailyRange | null;
  zoneNote: React.ReactNode;
  /** A 400 the server answered for the applied range, shown at the To field. */
  serverError?: MessageKey;
  onApply: (range: DailyRange) => void;
}>): React.JSX.Element {
  const t = useT();
  const empty = { from: "", to: "" };
  const [draft, setDraft] = useState<DailyRange>(range ?? empty);
  const [errors, setErrors] = useState<RangeErrors>(range ? validateRange(range) : {});

  // The URL is the source of truth: when the applied range changes from outside
  // (Back, a deep link, the default arriving) the draft follows.
  const appliedKey = JSON.stringify(range);
  const [syncedKey, setSyncedKey] = useState(appliedKey);
  if (syncedKey !== appliedKey) {
    setSyncedKey(appliedKey);
    setDraft(range ?? empty);
    setErrors(range ? validateRange(range) : {});
  }

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const found = validateRange(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) onApply(draft);
  }

  const toError = errors.to ?? serverError;
  return (
    <form
      className="sale-filters"
      aria-label={t("salesDaily.range.label")}
      // A range is not unsaved work: no Stay / Discard prompt for it (RT-268).
      data-dirty-guard="off"
      onSubmit={submit}
      noValidate
    >
      <DateField
        id="sd-from"
        label={t("sales.filter.from")}
        value={draft.from}
        error={errors.from}
        onChange={(from) => setDraft((d) => ({ ...d, from }))}
      />
      <DateField
        id="sd-to"
        label={t("sales.filter.to")}
        value={draft.to}
        error={toError}
        onChange={(to) => setDraft((d) => ({ ...d, to }))}
      />
      <p id="sd-range-note" className="sale-filters__zone">
        {zoneNote}
      </p>
      <div className="sale-filters__actions">
        <GatedButton type="submit" className="btn-primary">
          {t("salesDaily.range.apply")}
        </GatedButton>
      </div>
    </form>
  );
}
