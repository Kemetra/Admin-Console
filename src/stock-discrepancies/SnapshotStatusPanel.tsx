import { Banner } from "@/components/Banner";
import { DateTime, formatNumber, useT } from "@/i18n";
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
 * RT-399: snapshot instants render as operational times (`<DateTime>`, UTC-
 * labelled until the Store time zone is exposed, RT-401), with the exact ISO
 * value kept in the `<time>` element.
 */
import { asOfTime, formatStaleAfter, isPendingOverdue, statusView } from "./stockDiscrepancyLogic";

export interface SnapshotStatusPanelProps {
  snapshot: StockSnapshotStatus;
  /** Injected clock for the pending-overdue note (tests pass a fixed value). */
  nowMs?: number;
}

function SnapshotHeading({ snapshot }: { snapshot: StockSnapshotStatus }): React.JSX.Element {
  const t = useT();
  const view = statusView(snapshot.status);
  const asOf = asOfTime(snapshot);
  return (
    <div className="snapshot-panel__head">
      <h2 className="snapshot-panel__asof">
        {asOf
          ? t.rich("stock.panel.asOf", { time: <DateTime value={asOf} /> })
          : t("stock.panel.noSnapshot")}
      </h2>
      <span className={view.badgeClass}>{t(view.labelKey)}</span>
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
  const t = useT();
  const { erpnextWarehouseRef, recordedAt, reportedEntryCount } = snapshot;
  return (
    <dl className="snapshot-panel__meta">
      {erpnextWarehouseRef ? (
        <MetaField label={t("stock.panel.warehouse")}>
          <bdi dir="ltr" className="mono">
            {erpnextWarehouseRef}
          </bdi>
        </MetaField>
      ) : null}
      {recordedAt ? (
        <MetaField label={t("stock.panel.recordedAt")}>
          <DateTime value={recordedAt} />
        </MetaField>
      ) : null}
      {reportedEntryCount !== null ? (
        <MetaField label={t("stock.panel.entryCount")}>
          {formatNumber(reportedEntryCount, t.locale)}
        </MetaField>
      ) : null}
    </dl>
  );
}

/** The stale warning (AC3) or the explicit no-snapshot notice (AC2). */
function SnapshotStateBanner({
  snapshot,
}: { snapshot: StockSnapshotStatus }): React.JSX.Element | null {
  const t = useT();
  if (snapshot.status === "stale") {
    return (
      <Banner
        variant="warning"
        message={t("stock.notice.stale", {
          age: formatStaleAfter(snapshot.staleAfterSeconds, t.locale),
        })}
      />
    );
  }
  const notice = statusView(snapshot.status).notice;
  return notice ? <Banner variant={notice.variant} message={t(notice.messageKey)} /> : null;
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
  const t = useT();
  return (
    <div className="snapshot-panel__pending">
      <span className="badge badge--pending">{t("stock.pending.badge")}</span>{" "}
      <span>
        {t.rich("stock.pending.requestedAt", { time: <DateTime value={pending.requestedAt} /> })}
      </span>
      {overdue ? (
        <p className="snapshot-panel__overdue">
          {t(keepsPrevious ? "stock.pending.overdueWithPrevious" : "stock.pending.overdue")}
        </p>
      ) : null}
    </div>
  );
}

export function SnapshotStatusPanel({
  snapshot,
  nowMs = Date.now(),
}: SnapshotStatusPanelProps): React.JSX.Element {
  const t = useT();
  const pending = snapshot.pendingRequest;
  return (
    <section className="snapshot-panel" aria-label={t("stock.panel.label")}>
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
