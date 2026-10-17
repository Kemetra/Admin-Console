/**
 * RT-372 — The pairing-code issue form, shared by Replace, Move and a plain
 * pairing. The five terminal-binding fields are required by the contract
 * (decision C1): the POS pins them at pairing and prints them on receipts, and
 * Backend-Core has no other source for them. Form checks only; the server
 * re-validates, and decides what the action may do.
 */
import { InlineError } from "@/components/InlineError";
import { useT } from "@/i18n";
import type { StoreInfo } from "@/shift-closes/useShiftCloses";
import type { FieldProblem, IssueDraft, IssueProblems } from "./pairingLogic";
import "./devices.css";

export type IssueMode = "replace" | "move" | "pair";

interface InputProps {
  id: string;
  label: string;
  help?: string;
  value: string;
  problem?: FieldProblem;
  ltr?: boolean;
  /** Free text in either script: its direction follows what is typed. */
  auto?: boolean;
  /** The contract allows a newline (the address). */
  multiline?: boolean;
  inputMode?: "numeric";
  onChange: (value: string) => void;
}

interface ControlProps {
  id: string;
  value: string;
  dir?: "ltr" | "auto";
  multiline?: boolean;
  inputMode?: "numeric";
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}

/** The text control: a line, or a few lines where the contract allows a newline. */
function Control({ multiline, invalid, describedBy, onChange, ...rest }: Readonly<ControlProps>) {
  const common = {
    id: rest.id,
    className: "input",
    value: rest.value,
    dir: rest.dir,
    autoComplete: "off",
    "aria-invalid": invalid ? ("true" as const) : undefined,
    "aria-describedby": describedBy,
  };
  return multiline ? (
    <textarea {...common} rows={3} onChange={(e) => onChange(e.target.value)} />
  ) : (
    <input {...common} inputMode={rest.inputMode} onChange={(e) => onChange(e.target.value)} />
  );
}

function Input({
  id,
  label,
  help,
  value,
  problem,
  ltr,
  auto,
  multiline,
  inputMode,
  onChange,
}: Readonly<InputProps>): React.JSX.Element {
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
      <Control
        id={id}
        value={value}
        dir={ltr ? "ltr" : auto ? "auto" : undefined}
        multiline={multiline}
        inputMode={inputMode}
        invalid={problem !== undefined}
        describedBy={
          [help ? helpId : null, problem ? errorId : null].filter(Boolean).join(" ") || undefined
        }
        onChange={onChange}
      />
      <span id={errorId}>
        <InlineError message={problem ? t(problem.key, problem.params) : undefined} />
      </span>
    </div>
  );
}

export interface IssueFieldsProps {
  mode: IssueMode;
  draft: IssueDraft;
  problems: IssueProblems;
  /** The stores the code can be issued into (a move never offers the device's own store). */
  stores: readonly StoreInfo[];
  /** A replace stays in the device's own store: shown, not chosen. */
  fixedStoreName?: string;
  onChange: (patch: Partial<IssueDraft>) => void;
}

export function IssueFields({
  mode,
  draft,
  problems,
  stores,
  fixedStoreName,
  onChange,
}: Readonly<IssueFieldsProps>): React.JSX.Element {
  const t = useT();
  return (
    <>
      <p className="content__sub">{t(`devices.issue.intro.${mode}`)}</p>
      {mode === "replace" ? (
        <div className="field">
          <span className="field-row__label">{t("devices.issue.field.store")}</span>
          <bdi>{fixedStoreName ?? ""}</bdi>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="issue-store">
            {t(mode === "move" ? "devices.issue.field.targetStore" : "devices.issue.field.store")}
          </label>
          <select
            id="issue-store"
            className="input"
            value={draft.storeId}
            aria-invalid={problems.storeId ? "true" : undefined}
            aria-describedby={problems.storeId ? "issue-store-error" : undefined}
            onChange={(e) => onChange({ storeId: e.target.value })}
          >
            <option value="">{t("devices.issue.field.storeChoose")}</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <span id="issue-store-error">
            <InlineError message={problems.storeId ? t(problems.storeId.key) : undefined} />
          </span>
        </div>
      )}
      <Input
        id="issue-label"
        auto
        label={t("devices.issue.field.terminalLabel")}
        help={t("devices.issue.field.terminalLabelHelp")}
        value={draft.terminalLabel}
        problem={problems.terminalLabel}
        onChange={(terminalLabel) => onChange({ terminalLabel })}
      />
      <Input
        id="issue-ttl"
        label={t("devices.issue.field.ttl")}
        help={t("devices.issue.field.ttlHelp")}
        value={draft.ttlMinutes}
        problem={problems.ttlMinutes}
        ltr
        inputMode="numeric"
        onChange={(ttlMinutes) => onChange({ ttlMinutes })}
      />
      <fieldset className="device-reasons__group">
        <legend>{t("devices.issue.bindingTitle")}</legend>
        <small className="device-quiet">{t("devices.issue.bindingHelp")}</small>
        <Input
          id="issue-branch-name"
          auto
          label={t("devices.issue.field.branchName")}
          value={draft.branchName}
          problem={problems.branchName}
          onChange={(branchName) => onChange({ branchName })}
        />
        <Input
          id="issue-branch-address"
          auto
          multiline
          label={t("devices.issue.field.branchAddress")}
          value={draft.branchAddress}
          problem={problems.branchAddress}
          onChange={(branchAddress) => onChange({ branchAddress })}
        />
        <Input
          id="issue-tax-id"
          label={t("devices.issue.field.taxRegistrationId")}
          value={draft.taxRegistrationId}
          problem={problems.taxRegistrationId}
          ltr
          onChange={(taxRegistrationId) => onChange({ taxRegistrationId })}
        />
        <Input
          id="issue-printer-vendor"
          label={t("devices.issue.field.printerVendorId", { bus: "USB" })}
          help={t("devices.issue.field.usbHelp")}
          value={draft.printerVendorId}
          problem={problems.printerVendorId}
          ltr
          onChange={(printerVendorId) => onChange({ printerVendorId })}
        />
        <Input
          id="issue-printer-product"
          label={t("devices.issue.field.printerProductId", { bus: "USB" })}
          help={t("devices.issue.field.usbHelp")}
          value={draft.printerProductId}
          problem={problems.printerProductId}
          ltr
          onChange={(printerProductId) => onChange({ printerProductId })}
        />
        <Input
          id="issue-printer-com"
          label={t("devices.issue.field.printerComPort", { port: "COM" })}
          value={draft.printerComPort}
          problem={problems.printerComPort}
          ltr
          onChange={(printerComPort) => onChange({ printerComPort })}
        />
      </fieldset>
    </>
  );
}
