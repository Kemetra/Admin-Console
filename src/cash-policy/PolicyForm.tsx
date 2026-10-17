/**
 * RT-389 policy form shared by the tenant default and the store override.
 *
 * Fields are exactly the contract's: `mode` (`none` | `limit`), `limitAmount`
 * with a fixed read-only `EGP` currency (V1 accepts only EGP), a required
 * `reason` and, for an override, an optional `effectiveUntil` read in the
 * store's zone. Only the shape is validated here; stricter-only, the horizon,
 * owner approval and the server clock are the server's, and their refusals are
 * shown by the section. Remounting the form (a new `key`) resets the draft; a
 * refused publish leaves it as typed so the operator can retry.
 */
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import { useState } from "react";
import {
  type DraftErrors,
  POLICY_CURRENCY,
  type PolicyDraft,
  type PolicyMode,
  validateDraft,
} from "./policyLogic";

export interface ExpiryOptions {
  timeZone: string;
  horizonDays: number;
  /** A tenant_admin cannot publish a permanent override, so an expiry is required. */
  required: boolean;
}

export interface PolicyFormProps {
  idPrefix: string;
  titleKey: MessageKey;
  initial: { mode: PolicyMode; limitAmount: string };
  pending: boolean;
  onSubmit: (draft: PolicyDraft) => void;
  /** Override only: the expiry field, read in `timeZone`. */
  expiry?: ExpiryOptions;
}

/** What each field part needs: its ids, the draft, its translated error and the setter. */
interface PartProps {
  ids: (name: string) => string;
  draft: PolicyDraft;
  error: string | undefined;
  set: (patch: Partial<PolicyDraft>) => void;
}

const MODE_LABEL: Record<PolicyMode, MessageKey> = {
  none: "cashPolicy.form.modeNone",
  limit: "cashPolicy.form.modeLimit",
};

function ModeFieldset({
  name,
  mode,
  onChange,
}: Readonly<{ name: string; mode: PolicyMode; onChange: (mode: PolicyMode) => void }>) {
  const t = useT();
  return (
    <fieldset className="cash-policy__mode">
      <legend>{t("cashPolicy.form.mode")}</legend>
      {(["none", "limit"] as const).map((option) => (
        <label key={option} className="cash-policy__radio">
          <input
            type="radio"
            name={name}
            value={option}
            checked={mode === option}
            onChange={() => onChange(option)}
          />
          <span>{t(MODE_LABEL[option])}</span>
        </label>
      ))}
    </fieldset>
  );
}

function LimitFields({ ids, draft, error, set }: Readonly<PartProps>) {
  const t = useT();
  return (
    <div className="surface__form-grid">
      <div className="field">
        <label htmlFor={ids("amount")}>{t("cashPolicy.form.limitAmount")}</label>
        <input
          id={ids("amount")}
          className="input input--mono"
          inputMode="decimal"
          dir="ltr"
          autoComplete="off"
          value={draft.limitAmount}
          onChange={(e) => set({ limitAmount: e.target.value })}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={`${ids("amount-hint")} ${ids("amount-error")}`}
        />
        <span id={ids("amount-hint")} className="field__hint">
          {t("cashPolicy.form.limitHint")}
        </span>
        <span id={ids("amount-error")}>
          <InlineError message={error} />
        </span>
      </div>
      <div className="field">
        <label htmlFor={ids("currency")}>{t("cashPolicy.form.currency")}</label>
        <input
          id={ids("currency")}
          className="input input--mono"
          dir="ltr"
          value={POLICY_CURRENCY}
          readOnly
        />
      </div>
    </div>
  );
}

function ReasonField({ ids, draft, error, set }: Readonly<PartProps>) {
  const t = useT();
  return (
    <div className="field">
      <label htmlFor={ids("reason")}>{t("cashPolicy.form.reason")}</label>
      <input
        id={ids("reason")}
        className="input"
        autoComplete="off"
        value={draft.reason}
        onChange={(e) => set({ reason: e.target.value })}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={`${ids("reason-hint")} ${ids("reason-error")}`}
      />
      <span id={ids("reason-hint")} className="field__hint">
        {t("cashPolicy.form.reasonHint")}
      </span>
      <span id={ids("reason-error")}>
        <InlineError message={error} />
      </span>
    </div>
  );
}

function ExpiryField({
  ids,
  draft,
  error,
  set,
  expiry,
}: Readonly<PartProps & { expiry: ExpiryOptions }>) {
  const t = useT();
  return (
    <div className="field">
      <label htmlFor={ids("expiry")}>{t("cashPolicy.form.expiry")}</label>
      <input
        id={ids("expiry")}
        type="datetime-local"
        className="input"
        dir="ltr"
        value={draft.expiry}
        onChange={(e) => set({ expiry: e.target.value })}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={`${ids("expiry-hint")} ${ids("expiry-note")} ${ids("expiry-error")}`}
      />
      <span id={ids("expiry-hint")} className="field__hint">
        {t.rich("cashPolicy.form.expiryHint", { zone: <bdi dir="ltr">{expiry.timeZone}</bdi> })}
      </span>
      <span id={ids("expiry-note")} className="field__hint">
        {t("cashPolicy.override.permanentNote", { days: expiry.horizonDays })}
      </span>
      <span id={ids("expiry-error")}>
        <InlineError message={error} />
      </span>
    </div>
  );
}

export function PolicyForm({
  idPrefix,
  titleKey,
  initial,
  pending,
  onSubmit,
  expiry,
}: Readonly<PolicyFormProps>): React.JSX.Element {
  const t = useT();
  const [draft, setDraft] = useState<PolicyDraft>({ ...initial, reason: "", expiry: "" });
  const [errors, setErrors] = useState<DraftErrors>({});
  const set = (patch: Partial<PolicyDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const ids = (name: string) => `${idPrefix}-${name}`;
  const message = (key: MessageKey | undefined) => (key ? t(key) : undefined);

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const found = validateDraft(draft, { requireExpiry: expiry?.required ?? false });
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(draft);
  }

  return (
    <form className="surface__form cash-policy__form" onSubmit={submit} noValidate>
      <h3 className="surface__section-title">{t(titleKey)}</h3>
      <ModeFieldset name={ids("mode")} mode={draft.mode} onChange={(mode) => set({ mode })} />
      {draft.mode === "limit" ? (
        <LimitFields ids={ids} draft={draft} error={message(errors.limitAmount)} set={set} />
      ) : null}
      <ReasonField ids={ids} draft={draft} error={message(errors.reason)} set={set} />
      {expiry ? (
        <ExpiryField
          ids={ids}
          draft={draft}
          error={message(errors.expiry)}
          set={set}
          expiry={expiry}
        />
      ) : null}
      <p className="field__hint">{t("cashPolicy.form.applyNowHint")}</p>
      <div className="surface__actions">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {t("cashPolicy.form.applyNow")}
        </button>
      </div>
    </form>
  );
}
