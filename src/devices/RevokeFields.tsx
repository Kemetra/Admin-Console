/**
 * RT-372 — The details step of the Revoke and Retire flows: the D-Q3 reason
 * picker (the security class set apart as its own group, by structure and
 * wording, not by colour alone) and the operator text fields. Form validation
 * only; what the action would do is the server's to say, on the next step.
 */
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import type { RevokeReason } from "@/lib/device-queries";
import { revokeReasonKey } from "./deviceLogic";
import { OPERATOR_TEXT_MAX, REVOKE_REASON_GROUPS } from "./lifecycleLogic";

export interface TextFieldProps {
  id: string;
  label: string;
  help?: string;
  value: string;
  problem?: MessageKey;
  required?: boolean;
  onChange: (value: string) => void;
}

/** A labelled multi-line operator text field with its help and error wired by id. */
export function TextArea({
  id,
  label,
  help,
  value,
  problem,
  required,
  onChange,
}: Readonly<TextFieldProps>): React.JSX.Element {
  const t = useT();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {help ? (
        <small id={helpId} className="device-quiet">
          {help}
        </small>
      ) : null}
      <textarea
        id={id}
        className="input device-textarea"
        rows={3}
        maxLength={OPERATOR_TEXT_MAX}
        value={value}
        required={required}
        aria-invalid={problem ? "true" : undefined}
        aria-describedby={
          [help ? helpId : null, problem ? errorId : null].filter(Boolean).join(" ") || undefined
        }
        onChange={(e) => onChange(e.target.value)}
      />
      <span id={errorId}>
        <InlineError message={problem ? t(problem) : undefined} />
      </span>
    </div>
  );
}

export interface RevokeDetailsProps {
  reason: RevokeReason | "";
  note: string;
  problems: { reason?: MessageKey; note?: MessageKey };
  onReason: (reason: RevokeReason) => void;
  onNote: (note: string) => void;
}

export function RevokeDetails({
  reason,
  note,
  problems,
  onReason,
  onNote,
}: Readonly<RevokeDetailsProps>): React.JSX.Element {
  const t = useT();
  const noteRequired = reason === "other";
  return (
    <>
      <p className="content__sub">{t("devices.revoke.intro")}</p>
      <div
        className="device-reasons"
        aria-describedby={problems.reason ? "revoke-reason-error" : undefined}
      >
        {REVOKE_REASON_GROUPS.map((group) => (
          <fieldset
            key={group.id}
            className={`device-reasons__group device-reasons__group--${group.id}`}
          >
            <legend>{t(group.legendKey)}</legend>
            {group.id === "security" ? (
              <small className="device-quiet">{t("devices.revoke.group.securityHelp")}</small>
            ) : null}
            {group.reasons.map((r) => (
              <label key={r} className="drawer__radio">
                <input
                  type="radio"
                  name="revoke-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => onReason(r)}
                />
                {t(revokeReasonKey({ revokeReason: r }))}
              </label>
            ))}
          </fieldset>
        ))}
        <span id="revoke-reason-error">
          <InlineError message={problems.reason ? t(problems.reason) : undefined} />
        </span>
      </div>
      <TextArea
        id="revoke-note"
        label={t("devices.revoke.note")}
        help={t(noteRequired ? "devices.revoke.noteHelpRequired" : "devices.revoke.noteHelp")}
        value={note}
        problem={problems.note}
        required={noteRequired}
        onChange={onNote}
      />
    </>
  );
}

export interface RetireDetailsProps {
  reason: string;
  problem?: MessageKey;
  onReason: (reason: string) => void;
}

export function RetireDetails({
  reason,
  problem,
  onReason,
}: Readonly<RetireDetailsProps>): React.JSX.Element {
  const t = useT();
  return (
    <>
      <p className="content__sub">{t("devices.retire.intro")}</p>
      <TextArea
        id="retire-reason"
        label={t("devices.retire.reason")}
        help={t("devices.retire.reasonHelp")}
        value={reason}
        problem={problem}
        required
        onChange={onReason}
      />
    </>
  );
}
