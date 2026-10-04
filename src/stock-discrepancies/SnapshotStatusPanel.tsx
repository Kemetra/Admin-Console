import { Banner } from "@/components/Banner";
import type { StockSnapshotStatus } from "@/lib/stock-discrepancy-queries";
/**
 * RT-178 snapshot freshness block for one store (RT-51 D4). Renders the API's
 * `snapshot` as received:
 *   - fresh / stale            → "ERPNext snapshot as of {readAt}" (always)
 *   - stale                    → warning banner; items stay listed
 *   - no_snapshot              → explicit "No ERPNext snapshot" state
 *   - no_warehouse_mapping     → explicit "No ERPNext snapshot" state
 *   - pendingRequest           → "Snapshot requested, awaiting Connector"
 * A snapshot is a point-in-time ERPNext read; the copy never calls it live.
 */
import {
  formatStaleAfter,
  hasSnapshot,
  isPendingOverdue,
  snapshotStatusLabel,
} from "./stockDiscrepancyLogic";

export interface SnapshotStatusPanelProps {
  snapshot: StockSnapshotStatus;
  /** Injected clock for the pending-overdue note (tests pass a fixed value). */
  nowMs?: number;
}

export function SnapshotStatusPanel({
  snapshot,
  nowMs = Date.now(),
}: SnapshotStatusPanelProps): React.JSX.Element {
  const status = snapshotStatusLabel(snapshot.status);
  const pending = snapshot.pendingRequest;

  return (
    <section className="snapshot-panel" aria-label="ERPNext snapshot">
      <div className="snapshot-panel__head">
        {hasSnapshot(snapshot.status) && snapshot.readAt ? (
          <h2 className="snapshot-panel__asof">
            ERPNext snapshot as of <time dateTime={snapshot.readAt}>{snapshot.readAt}</time>
          </h2>
        ) : (
          <h2 className="snapshot-panel__asof">No ERPNext snapshot</h2>
        )}
        <span className={status.badgeClass}>{status.label}</span>
      </div>

      <dl className="snapshot-panel__meta">
        {snapshot.erpnextWarehouseRef ? (
          <div>
            <dt>ERPNext warehouse</dt>
            <dd className="mono">{snapshot.erpnextWarehouseRef}</dd>
          </div>
        ) : null}
        {snapshot.recordedAt ? (
          <div>
            <dt>Recorded by Retail Tower</dt>
            <dd>
              <time dateTime={snapshot.recordedAt}>{snapshot.recordedAt}</time>
            </dd>
          </div>
        ) : null}
        {snapshot.reportedEntryCount !== null ? (
          <div>
            <dt>ERPNext Bins in snapshot</dt>
            <dd>{snapshot.reportedEntryCount}</dd>
          </div>
        ) : null}
      </dl>

      {snapshot.status === "stale" ? (
        <Banner
          variant="warning"
          message={`This ERPNext snapshot is older than ${formatStaleAfter(
            snapshot.staleAfterSeconds,
          )}. The items below come from that snapshot and may no longer match ERPNext. Request a fresh snapshot to re-read ERPNext.`}
        />
      ) : null}

      {snapshot.status === "no_snapshot" ? (
        <Banner
          variant="info"
          message="No ERPNext snapshot has been recorded for this store yet, so its ERPNext stock is unknown. This is not the same as having no discrepancies."
        />
      ) : null}

      {snapshot.status === "no_warehouse_mapping" ? (
        <Banner
          variant="info"
          message="No ERPNext snapshot: this store has no ERPNext stock warehouse mapping, so its ERPNext stock is unknown. This is not the same as having no discrepancies."
        />
      ) : null}

      {pending ? (
        <div className="snapshot-panel__pending">
          <span className="badge badge--pending">Snapshot requested, awaiting Connector</span>{" "}
          <span>
            Requested <time dateTime={pending.requestedAt}>{pending.requestedAt}</time>.
          </span>
          {isPendingOverdue(pending, nowMs) ? (
            <p className="snapshot-panel__overdue">
              Snapshot requested but not yet reported. The ERPNext Connector may be offline, or the
              warehouse may hold more than 500 items, which the Connector does not report yet.
              {hasSnapshot(snapshot.status) ? " The previous snapshot is still shown." : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
