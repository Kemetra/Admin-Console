import { BackArrow } from "@/components/BackArrow";
import { Banner } from "@/components/Banner";
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { ListState } from "@/components/ListState";
import { DateTime, type MessageKey, type T, useT } from "@/i18n";
import type { PairingCodeSummary } from "@/lib/device-queries";
import { type StoreDirectory, useStoreDirectory } from "@/shift-closes/useShiftCloses";
/**
 * RT-372 — Pending pairing codes: the live codes in the caller's scope (pending
 * and not expired), newest first, keyset paged in the server's order. A code is
 * never listed (the server keeps only a hash): it is shown once, when issued.
 * Each row can be cancelled after an explicit confirm; cancelling is idempotent
 * (`already_cancelled` succeeds) and a used code can't be cancelled. A kind
 * the console does not know is shown as unknown, and a move or replace whose
 * target device is outside the caller's scope says so instead of "none".
 */
import { useState } from "react";
import { Link } from "react-router";
import { PairDrawer } from "./PairDrawer";
import { classifyMutationFailure, requestIdOfFailure } from "./lifecycleLogic";
import { type DeviceError, useDeviceScope } from "./useDevices";
import {
  type PairingCodeListState,
  useCancelPairingCode,
  usePairingCodes,
} from "./usePairingCodes";
import "../shell/surface.css";
import "../components/data-table.css";
import "./devices.css";

const KIND_KEYS: Record<string, MessageKey> = {
  pair: "devices.codes.kind.pair",
  replace: "devices.codes.kind.replace",
  move: "devices.codes.kind.move",
};

interface Result {
  key: MessageKey;
  variant: "success" | "warning" | "danger";
  requestId?: string;
}

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

interface TableProps {
  rows: readonly PairingCodeSummary[];
  directory: StoreDirectory;
  onCancel: (code: PairingCodeSummary) => void;
  t: T;
}

function CodesTable({ rows, directory, onCancel, t }: Readonly<TableProps>): React.JSX.Element {
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
          <tr key={code.pairingCodeId}>
            <td>
              <bdi dir="auto">{code.terminalLabel}</bdi>
            </td>
            <td>
              <span className="badge">
                {t(KIND_KEYS[code.kind] ?? "devices.codes.kind.unknown")}
              </span>
            </td>
            <td>{directory.nameOf(code.storeId) ?? t("devices.list.unknownStore")}</td>
            <td>
              <ReplacesCell code={code} />
            </td>
            <td>
              <DateTime value={code.expiresAt} timeZone={directory.timeZoneOf(code.storeId)} />
            </td>
            <td>
              <button type="button" className="btn-secondary" onClick={() => onCancel(code)}>
                {t("devices.codes.cancel")}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ListFailure({
  error,
  onRetry,
}: Readonly<{ error: DeviceError; onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  if (error.kind === "not-found") {
    return <ListState state="empty" emptyMessage={t("devices.codes.unavailable")} />;
  }
  if (error.kind === "session") {
    return (
      <Banner
        variant="danger"
        message={t("devices.list.sessionExpired")}
        requestId={error.requestId}
      />
    );
  }
  return (
    <Banner
      variant="danger"
      message={t("devices.codes.loadFailed")}
      requestId={error.requestId}
      action={
        <button type="button" className="btn-secondary" onClick={onRetry}>
          {t("devices.codes.retry")}
        </button>
      }
    />
  );
}

function Pager({ list }: Readonly<{ list: PairingCodeListState }>): React.JSX.Element {
  const t = useT();
  return (
    <>
      {list.inlineError ? (
        <Banner
          variant="danger"
          message={t("devices.list.inlineError")}
          requestId={list.inlineError.requestId}
          action={
            <button type="button" className="btn-secondary" onClick={list.retry}>
              {t("devices.codes.retry")}
            </button>
          }
        />
      ) : null}
      <div className="device-pager">
        <span>{t("devices.codes.loaded", { count: list.rows.length })}</span>
        {list.hasMore ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={list.loadMore}
            disabled={list.isFetchingNextPage}
          >
            {list.isFetchingNextPage ? <span className="spinner" aria-hidden="true" /> : null}
            {t("devices.codes.loadMore")}
          </button>
        ) : null}
      </div>
    </>
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
        <button type="button" className="btn-secondary" onClick={onKeep} disabled={pending}>
          {t("devices.codes.cancelKeep")}
        </button>
      </div>
    </fieldset>
  );
}

export function PairingCodes(): React.JSX.Element {
  const t = useT();
  const scope = useDeviceScope();
  const directory = useStoreDirectory(scope.tenantId);
  const list = usePairingCodes(scope);
  const cancel = useCancelPairingCode();
  const [confirming, setConfirming] = useState<PairingCodeSummary | null>(null);
  const [result, setResult] = useState<Result | undefined>();
  const [pairing, setPairing] = useState(false);

  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("devices.list.scopePrompt")}</p>
      </div>
    );
  }

  async function confirmCancel(code: PairingCodeSummary): Promise<void> {
    setResult(undefined);
    try {
      const res = await cancel.mutateAsync(code.pairingCodeId);
      if (res.status === 200 && res.data) {
        setResult({
          key:
            res.data.outcome === "already_cancelled"
              ? "devices.codes.alreadyCancelled"
              : "devices.codes.cancelled",
          variant: "success",
        });
      } else {
        const failure = classifyMutationFailure(res);
        const key: MessageKey =
          failure.kind === "conflict"
            ? "devices.codes.error.used"
            : failure.kind === "not-found"
              ? "devices.codes.error.notFound"
              : failure.kind === "session"
                ? "devices.list.sessionExpired"
                : "devices.codes.error.generic";
        setResult({
          key,
          variant: failure.kind === "conflict" ? "warning" : "danger",
          requestId: requestIdOfFailure(failure),
        });
      }
    } catch {
      setResult({ key: "devices.codes.error.generic", variant: "danger" });
    }
    setConfirming(null);
  }

  const pending = list.isLoading || (list.rows.length > 0 && !directory.ready);
  const columns = [
    { key: "terminal", header: t("devices.codes.col.terminal") },
    { key: "kind", header: t("devices.codes.col.kind") },
    { key: "store", header: t("devices.codes.col.store") },
    { key: "replaces", header: t("devices.codes.col.replaces") },
    { key: "expires", header: t("devices.codes.col.expires") },
    { key: "actions", header: t("devices.codes.col.actions") },
  ];

  return (
    <div className="surface">
      <Link to="/devices" className="surface__back">
        <BackArrow /> {t("devices.codes.back")}
      </Link>
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("devices.codes.title")}</h1>
          <p className="content__sub">
            {t.rich("devices.codes.sub", { tenant: <bdi>{scope.tenantName}</bdi> })}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setPairing(true)}>
          {t("devices.codes.issue")}
        </button>
      </header>

      {result ? (
        result.variant === "success" ? (
          <output className="device-impact__verdict">{t(result.key)}</output>
        ) : (
          <Banner variant={result.variant} message={t(result.key)} requestId={result.requestId} />
        )
      ) : null}
      {confirming ? (
        <CancelConfirm
          code={confirming}
          pending={cancel.isPending}
          onConfirm={() => void confirmCancel(confirming)}
          onKeep={() => setConfirming(null)}
        />
      ) : null}

      {pending ? (
        <DataTableSkeleton
          caption={t("devices.codes.caption")}
          columns={columns}
          label={t("devices.codes.loadingNoun")}
        />
      ) : list.error ? (
        <ListFailure error={list.error} onRetry={list.retry} />
      ) : list.rows.length === 0 ? (
        <ListState
          state="empty"
          emptyMessage={t("devices.codes.empty")}
          emptyHint={t("devices.codes.emptyHint")}
        />
      ) : (
        <>
          <CodesTable rows={list.rows} directory={directory} onCancel={setConfirming} t={t} />
          <Pager list={list} />
        </>
      )}
      {pairing ? <PairDrawer onClose={() => setPairing(false)} /> : null}
    </div>
  );
}
