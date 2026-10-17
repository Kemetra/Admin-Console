/**
 * RT-372 — The pending pairing codes as a table. The confirm before a cancel opens
 * in place, directly under the row it belongs to, with focus on the safe choice
 * (Keep code); while a cancel is pending no other row can start one.
 */
import { type MessageKey, type T, useT } from "@/i18n";
import type { PairingCodeSummary } from "@/lib/device-queries";
import type { StoreDirectory } from "@/shift-closes/useShiftCloses";
import { Fragment, useEffect, useRef } from "react";
import { Link } from "react-router";
import { LtrTime } from "./DeviceParts";
import type { CancelFlow } from "./useCancelFlow";
import "../components/data-table.css";
import "./devices.css";

const KIND_KEYS: Record<string, MessageKey> = {
  pair: "devices.codes.kind.pair",
  replace: "devices.codes.kind.replace",
  move: "devices.codes.kind.move",
};

const COLUMN_COUNT = 6;

function ReplacesCell({ code }: Readonly<{ code: PairingCodeSummary }>): React.JSX.Element {
  const t = useT();
  if (code.replacesDeviceId) {
    return (
      <Link to={`/devices/${code.replacesDeviceId}`}>
        <bdi dir="ltr" className="device-impact__id">
          {code.replacesDeviceId}
        </bdi>
      </Link>
    );
  }
  // A replace or move whose device the caller can't see is not "none".
  return (
    <span className="device-quiet">
      {t(code.kind === "pair" ? "devices.codes.replaces.none" : "devices.codes.replaces.outside")}
    </span>
  );
}

/** The inline confirm before a cancel: names the code, one destructive primary. */
function CancelConfirm({
  code,
  pending,
  onConfirm,
  onKeep,
}: Readonly<{
  code: PairingCodeSummary;
  pending: boolean;
  onConfirm: () => void;
  onKeep: () => void;
}>): React.JSX.Element {
  const t = useT();
  const keep = useRef<HTMLButtonElement>(null);
  // Focus lands on the safe choice when the confirm opens.
  useEffect(() => keep.current?.focus(), []);
  return (
    <fieldset className="confirm-delete device-confirm" aria-label={t("devices.codes.cancel")}>
      <p className="confirm-delete__msg">
        {t.rich("devices.codes.cancelConfirm", {
          label: <bdi dir="auto">{code.terminalLabel}</bdi>,
        })}
      </p>
      <div className="confirm-delete__actions">
        <button type="button" className="btn-destructive" onClick={onConfirm} disabled={pending}>
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {t("devices.codes.cancel")}
        </button>
        <button
          type="button"
          className="btn-secondary"
          ref={keep}
          onClick={onKeep}
          disabled={pending}
        >
          {t("devices.codes.cancelKeep")}
        </button>
      </div>
    </fieldset>
  );
}

function CodeRow({
  code,
  directory,
  busy,
  onCancel,
}: Readonly<{
  code: PairingCodeSummary;
  directory: StoreDirectory;
  busy: boolean;
  onCancel: (code: PairingCodeSummary) => void;
}>): React.JSX.Element {
  const t = useT();
  return (
    <tr>
      <td>
        <bdi dir="auto">{code.terminalLabel}</bdi>
      </td>
      <td>
        <span className="badge">{t(KIND_KEYS[code.kind] ?? "devices.codes.kind.unknown")}</span>
      </td>
      <td>{directory.nameOf(code.storeId) ?? t("devices.list.unknownStore")}</td>
      <td>
        <ReplacesCell code={code} />
      </td>
      <td>
        <LtrTime value={code.expiresAt} timeZone={directory.timeZoneOf(code.storeId)} />
      </td>
      <td>
        <button
          type="button"
          className="btn-secondary"
          data-cancel-for={code.pairingCodeId}
          disabled={busy}
          onClick={() => onCancel(code)}
        >
          {t("devices.codes.cancel")}
        </button>
      </td>
    </tr>
  );
}

export function CodesTable({
  rows,
  directory,
  cancel,
  t,
}: Readonly<{
  rows: readonly PairingCodeSummary[];
  directory: StoreDirectory;
  cancel: CancelFlow;
  t: T;
}>): React.JSX.Element {
  return (
    <table className="data-table">
      <caption className="data-table__caption">{t("devices.codes.caption")}</caption>
      <thead>
        <tr>
          <th scope="col">{t("devices.codes.col.terminal")}</th>
          <th scope="col">{t("devices.codes.col.kind")}</th>
          <th scope="col">{t("devices.codes.col.store")}</th>
          <th scope="col">{t("devices.codes.col.replaces")}</th>
          <th scope="col">{t("devices.codes.col.expires")}</th>
          <th scope="col">{t("devices.codes.col.actions")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((code) => (
          <Fragment key={code.pairingCodeId}>
            <CodeRow
              code={code}
              directory={directory}
              busy={cancel.pending}
              onCancel={cancel.ask}
            />
            {cancel.confirming?.pairingCodeId === code.pairingCodeId ? (
              <tr>
                <td colSpan={COLUMN_COUNT}>
                  <CancelConfirm
                    code={code}
                    pending={cancel.pending}
                    onConfirm={() => void cancel.confirm(code)}
                    onKeep={cancel.keep}
                  />
                </td>
              </tr>
            ) : null}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
