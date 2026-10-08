import { Banner } from "@/components/Banner";
import type { PendingSnapshotRequest, StockSnapshotStatus } from "@/lib/stock-discrepancy-queries";
/**
 * RT-178 snapshot freshness block for one store (RT-51 D4). Renders the API's
 * `snapshot` as received:
 *   - fresh / stale            → "ERPNext snapshot as of {readAt}" (always)
 *   - stale                    → warning banner; items stay listed
 *   - no_snapshot              → explicit "No ERPNext snapshot" state
 *   - no_warehouse_mapping     → explicit "No ERPNext snapshot" state
 *   - pendingRequest           → "Snapshot requested, awaiting Connector"
 * A snapshot is a point-in-time ERPNext read; the copy never calls it live.
 * State → view derivations live in `stockDiscrepancyLogic` (`statusView`).
 */
import { asOfTime, formatStaleAfter, isPendingOverdue, statusView } from "./stockDiscrepancyLogic";

export interface SnapshotStatusPanelProps {
  snapshot: StockSnapshotStatus;
  /** Injected clock for the pending-overdue note (tests pass a fixed value). */
  nowMs?: number;
}

function SnapshotHeading({ snapshot }: { snapshot: StockSnapshotStatus }): React.JSX.Element {
  const view = statusView(snapshot.status);
  const asOf = asOfTime(snapshot);
  return (
    <div className="snapshot-panel__head">
      <h2 className="snapshot-panel__asof">
        {asOf ? (
          <>
            ERPNext snapshot as of <time dateTime={asOf}>{asOf}</time>
          </>
        ) : (
          "No ERPNext snapshot"
        )}
      </h2>
      <span className={view.badgeClass}>{view.label}</span>
    </div>
  );
}

function MetaField({
  label,
  children,
}: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function SnapshotMeta({ snapshot }: { snapshot: StockSnapshotStatus }): React.JSX.Element {
  const { erpnextWarehouseRef, recordedAt, reportedEntryCount } = snapshot;
  return (
    <dl className="snapshot-panel__meta">
      {erpnextWarehouseRef ? (
        <MetaField label="ERPNext warehouse">
          <span className="mono">{erpnextWarehouseRef}</span>
        </MetaField>
      ) : null}
      {recordedAt ? (
        <MetaField label="Recorded by Retail Tower">
          <time dateTime={recordedAt}>{recordedAt}</time>
        </MetaField>
      ) : null}
      {reportedEntryCount !== null ? (
        <MetaField label="ERPNext Bins in snapshot">{reportedEntryCount}</MetaField>
      ) : null}
    </dl>
  );
}

/** The stale warning (AC3) or the explicit no-snapshot notice (AC2). */
function SnapshotStateBanner({
  snapshot,
}: { snapshot: StockSnapshotStatus }): React.JSX.Element | null {
  if (snapshot.status === "stale") {
    return (
      <Banner
        variant="warning"
        message={`This ERPNext snapshot is older than ${formatStaleAfter(
          snapshot.staleAfterSeconds,
        )}. The items below come from that snapshot and may no longer match ERPNext. Request a fresh snapshot to re-read ERPNext.`}
      />
    );
  }
  const notice = statusView(snapshot.status).notice;
  return notice ? <Banner variant={notice.variant} message={notice.message} /> : null;
}

interface PendingNoteProps {
  pending: PendingSnapshotRequest;
  overdue: boolean;
  keepsPrevious: boolean;
}

/** AC4: "Snapshot requested, awaiting Connector"; causes once overdue. */
function PendingRequestNote({
  pending,
  overdue,
  keepsPrevious,
}: PendingNoteProps): React.JSX.Element {
  return (
    <div className="snapshot-panel__pending">
      <span className="badge badge--pending">Snapshot requested, awaiting Connector</span>{" "}
      <span>
        Requested <time dateTime={pending.requestedAt}>{pending.requestedAt}</time>.
      </span>
      {overdue ? (
        <p className="snapshot-panel__overdue">
          Snapshot requested but not yet reported. The ERPNext Connector may be offline, or the
          warehouse may hold more than 500 items, which the Connector does not report yet.
          {keepsPrevious ? " The previous snapshot is still shown." : ""}
        </p>
      ) : null}
    </div>
  );
}

export function SnapshotStatusPanel({
  snapshot,
  nowMs = Date.now(),
}: SnapshotStatusPanelProps): React.JSX.Element {
  const pending = snapshot.pendingRequest;
  return (
    <section className="snapshot-panel" aria-label="ERPNext snapshot">
      <SnapshotHeading snapshot={snapshot} />
      <SnapshotMeta snapshot={snapshot} />
      <SnapshotStateBanner snapshot={snapshot} />
      {pending ? (
        <PendingRequestNote
          pending={pending}
          overdue={isPendingOverdue(pending, nowMs)}
          keepsPrevious={statusView(snapshot.status).hasSnapshot}
        />
      ) : null}
    </section>
  );
}
