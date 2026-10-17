import { BackArrow } from "@/components/BackArrow";
import { Banner } from "@/components/Banner";
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { ListState } from "@/components/ListState";
import { useT } from "@/i18n";
import { type StoreDirectory, useStoreDirectory } from "@/shift-closes/useShiftCloses";
/**
 * RT-372 — Pending pairing codes: the live codes in the caller's scope (pending
 * and not expired), newest first, keyset paged in the server's order. A code is
 * never listed (the server keeps only a hash): it is shown once, when issued.
 * Each row can be cancelled after an explicit confirm that opens under that row;
 * cancelling is idempotent (`already_cancelled` succeeds) and a used code can't be
 * cancelled. A kind the console does not know is shown as unknown, and a move or
 * replace whose target device is outside the caller's scope says so instead of
 * "none".
 */
import { useRef, useState } from "react";
import { Link } from "react-router";
import { PairDrawer } from "./PairDrawer";
import { CodesTable } from "./PairingCodesTable";
import { type CancelFlow, type CancelResult, useCancelFlow } from "./useCancelFlow";
import { useCancelFocus } from "./useCancelFocus";
import { type DeviceError, useDeviceScope } from "./useDevices";
import { type PairingCodeListState, usePairingCodes } from "./usePairingCodes";
import "../shell/surface.css";
import "./devices.css";

const COLUMN_KEYS = [
  { key: "terminal", header: "devices.codes.col.terminal" },
  { key: "kind", header: "devices.codes.col.kind" },
  { key: "store", header: "devices.codes.col.store" },
  { key: "replaces", header: "devices.codes.col.replaces" },
  { key: "expires", header: "devices.codes.col.expires" },
  { key: "actions", header: "devices.codes.col.actions" },
] as const;

/** A refusal reads as one thing; only a server failure is worth asking again. */
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
        error.kind === "rejected" ? undefined : (
          <button type="button" className="btn-secondary" onClick={onRetry}>
            {t("devices.codes.retry")}
          </button>
        )
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

function ResultNotice({ result }: Readonly<{ result?: CancelResult }>): React.JSX.Element | null {
  const t = useT();
  if (!result) return null;
  if (result.variant === "success") {
    return <output className="device-impact__verdict">{t(result.key)}</output>;
  }
  return <Banner variant={result.variant} message={t(result.key)} requestId={result.requestId} />;
}

interface BodyProps {
  list: PairingCodeListState;
  directory: StoreDirectory;
  cancel: CancelFlow;
}

/**
 * Rows are held back until the store roster has settled, so a store is never
 * shown as unknown just because the roster had not arrived yet.
 */
function isAwaiting(list: PairingCodeListState, directory: StoreDirectory): boolean {
  const rosterPending = list.rows.length > 0 && !directory.ready;
  return list.isLoading || rosterPending;
}

/** The table, or why there isn't one: loading, a refusal, or nothing pending. */
function CodesBody({ list, directory, cancel }: Readonly<BodyProps>): React.JSX.Element {
  const t = useT();
  if (isAwaiting(list, directory)) {
    return (
      <DataTableSkeleton
        caption={t("devices.codes.caption")}
        columns={COLUMN_KEYS.map(({ key, header }) => ({ key, header: t(header) }))}
        label={t("devices.codes.loadingNoun")}
      />
    );
  }
  if (list.error) return <ListFailure error={list.error} onRetry={list.retry} />;
  if (list.rows.length === 0) {
    return (
      <ListState
        state="empty"
        emptyMessage={t("devices.codes.empty")}
        emptyHint={t("devices.codes.emptyHint")}
      />
    );
  }
  return (
    <>
      <CodesTable rows={list.rows} directory={directory} cancel={cancel} t={t} />
      <Pager list={list} />
    </>
  );
}

export function PairingCodes(): React.JSX.Element {
  const t = useT();
  const scope = useDeviceScope();
  const directory = useStoreDirectory(scope.tenantId);
  const list = usePairingCodes(scope);
  const region = useRef<HTMLDivElement>(null);
  const cancel = useCancelFocus(useCancelFlow(), region);
  const [pairing, setPairing] = useState(false);

  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("devices.list.scopePrompt")}</p>
      </div>
    );
  }

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
      <ResultNotice result={cancel.result} />
      <div ref={region} tabIndex={-1} className="device-codes-region">
        <CodesBody list={list} directory={directory} cancel={cancel} />
      </div>
      {pairing ? <PairDrawer onClose={() => setPairing(false)} /> : null}
    </div>
  );
}
