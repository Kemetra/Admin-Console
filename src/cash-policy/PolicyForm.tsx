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

export interface PolicyFormProps {
  idPrefix: string;
  titleKey: MessageKey;
  initial: { mode: PolicyMode; limitAmount: string };
  pending: boolean;
  onSubmit: (draft: PolicyDraft) => void;
  /** Override only: the expiry field, read in `timeZone`. */
  expiry?: {
    timeZone: string;
    horizonDays: number;
    /** A tenant_admin cannot publish a permanent override, so an expiry is required. */
    required: boolean;
  };
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

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const found = validateDraft(draft, { requireExpiry: expiry?.required ?? false });
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(draft);
  }

  const id = (name: string) => `${idPrefix}-${name}`;
  const errorFor = (key: keyof DraftErrors) =>
    errors[key] ? t(errors[key] as MessageKey) : undefined;

  return (
    <form className="surface__form cash-policy__form" onSubmit={submit} noValidate>
      <h3 className="surface__section-title">{t(titleKey)}</h3>

      <fieldset className="cash-policy__mode">
        <legend>{t("cashPolicy.form.mode")}</legend>
        {(["none", "limit"] as const).map((mode) => (
          <label key={mode} className="cash-policy__radio">
            <input
              type="radio"
              name={id("mode")}
              value={mode}
              checked={draft.mode === mode}
              onChange={() => set({ mode })}
            />
            <span>
              {t(mode === "none" ? "cashPolicy.form.modeNone" : "cashPolicy.form.modeLimit")}
            </span>
          </label>
        ))}
      </fieldset>

      {draft.mode === "limit" ? (
        <div className="surface__form-grid">
          <div className="field">
            <label htmlFor={id("amount")}>{t("cashPolicy.form.limitAmount")}</label>
            <input
              id={id("amount")}
              className="input input--mono"
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
              value={draft.limitAmount}
              onChange={(e) => set({ limitAmount: e.target.value })}
              aria-invalid={errors.limitAmount ? "true" : undefined}
              aria-describedby={`${id("amount-hint")} ${id("amount-error")}`}
            />
            <span id={id("amount-hint")} className="field__hint">
              {t("cashPolicy.form.limitHint")}
            </span>
            <span id={id("amount-error")}>
              <InlineError message={errorFor("limitAmount")} />
            </span>
          </div>
          <div className="field">
            <label htmlFor={id("currency")}>{t("cashPolicy.form.currency")}</label>
            <input
              id={id("currency")}
              className="input input--mono"
              dir="ltr"
              value={POLICY_CURRENCY}
              readOnly
            />
          </div>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor={id("reason")}>{t("cashPolicy.form.reason")}</label>
        <input
          id={id("reason")}
          className="input"
          autoComplete="off"
          value={draft.reason}
          onChange={(e) => set({ reason: e.target.value })}
          aria-invalid={errors.reason ? "true" : undefined}
          aria-describedby={`${id("reason-hint")} ${id("reason-error")}`}
        />
        <span id={id("reason-hint")} className="field__hint">
          {t("cashPolicy.form.reasonHint")}
        </span>
        <span id={id("reason-error")}>
          <InlineError message={errorFor("reason")} />
        </span>
      </div>

      {expiry ? (
        <div className="field">
          <label htmlFor={id("expiry")}>{t("cashPolicy.form.expiry")}</label>
          <input
            id={id("expiry")}
            type="datetime-local"
            className="input"
            dir="ltr"
            value={draft.expiry}
            onChange={(e) => set({ expiry: e.target.value })}
            aria-invalid={errors.expiry ? "true" : undefined}
            aria-describedby={`${id("expiry-hint")} ${id("expiry-note")} ${id("expiry-error")}`}
          />
          <span id={id("expiry-hint")} className="field__hint">
            {t.rich("cashPolicy.form.expiryHint", { zone: <bdi dir="ltr">{expiry.timeZone}</bdi> })}
          </span>
          <span id={id("expiry-note")} className="field__hint">
            {t("cashPolicy.override.permanentNote", { days: expiry.horizonDays })}
          </span>
          <span id={id("expiry-error")}>
            <InlineError message={errorFor("expiry")} />
          </span>
        </div>
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
