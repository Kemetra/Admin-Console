import { ListState } from "@/components/ListState";
/**
 * RT-726 — the sale sync-ops sections of the sale detail (`/sales/:saleRef`):
 * the server's sync status for the sale (with its open quarantined item and
 * the guarded repair request) and the sale's redacted sync timeline.
 *
 * Shown only to the roles the API serves (owner / tenant_admin); any other
 * role sees nothing and nothing is requested. The sections never speak for
 * ERPNext: `synced` is not "posted", an unknown status is not "not posted",
 * and no open quarantined item is not "posted" (RT-642). The sale's ERPNext
 * posting state stays in its own section.
 */
import { DateTime, useT } from "@/i18n";
import type {
  AuditTimelineEntry,
  DeadLetterDetail,
  SaleSyncStatus,
} from "@/lib/sale-sync-ops-queries";
import { Field, Section } from "@/sales/SaleDetailSections";
import { useSaleScope } from "@/sales/useSales";
import { RepairControl, RepairOutcomeBanner } from "./RepairControl";
import { Machine, ReadError, StaleError, SyncStatusBadge } from "./parts";
import {
  canUseSaleSyncOps,
  classificationKey,
  eventKey,
  isKnownEvent,
  isRepairable,
  syncStatusView,
} from "./saleSyncLogic";
import {
  type RepairState,
  useRepairSale,
  useSaleAuditTimeline,
  useSaleSyncStatus,
} from "./useSaleSync";
import "./sale-sync.css";

interface SectionProps {
  saleRef: string;
  /** The store zone the sale detail reports; times here use it too. */
  timeZone?: string;
}

function DeadLetterBlock({
  dead,
  timeZone,
}: Readonly<{ dead: DeadLetterDetail; timeZone?: string }>): React.JSX.Element {
  const t = useT();
  return (
    <div className="sale-sync__dead-letter">
      <h3 className="sale-sync__subtitle">{t("saleSync.deadLetter.title")}</h3>
      <dl className="surface__detail">
        <Field label={t("saleSync.field.classification")}>
          {t(classificationKey(dead.classification))}
        </Field>
        <Field label={t("saleSync.field.reasonCode")}>
          <Machine value={dead.reasonCode} />
        </Field>
        <Field label={t("saleSync.field.retryCount")}>
          <span className="sale-amount">{dead.retryCount}</span>
        </Field>
        <Field label={t("saleSync.field.quarantinedAt")}>
          <DateTime value={dead.quarantinedAt} timeZone={timeZone} />
        </Field>
        <Field label={t("saleSync.field.resolvedAt")}>
          {dead.resolvedAt ? (
            <DateTime value={dead.resolvedAt} timeZone={timeZone} />
          ) : (
            t("saleSync.deadLetter.open")
          )}
        </Field>
      </dl>
    </div>
  );
}

function StatusBody({
  status,
  timeZone,
  repair,
}: Readonly<{
  status: SaleSyncStatus;
  timeZone?: string;
  repair: RepairState;
}>): React.JSX.Element {
  const t = useT();
  return (
    <>
      <dl className="surface__detail">
        <Field label={t("saleSync.field.status")}>
          <SyncStatusBadge code={status.syncStatus} />
        </Field>
        <Field label={t("saleSync.field.source")}>
          <Machine value={status.sourceSystem} />
        </Field>
        <Field label={t("saleSync.field.externalId")}>
          <Machine value={status.externalId} />
        </Field>
        <Field label={t("saleSync.field.processedAt")}>
          {status.processedAt ? (
            <DateTime value={status.processedAt} timeZone={timeZone} />
          ) : (
            t("saleSync.processedAt.none")
          )}
        </Field>
      </dl>
      <p className="content__sub">{t(syncStatusView(status.syncStatus).meaningKey)}</p>
      {status.deadLetter ? (
        <DeadLetterBlock dead={status.deadLetter} timeZone={timeZone} />
      ) : (
        <p className="content__sub">{t("saleSync.deadLetter.none")}</p>
      )}
      {isRepairable(status) ? (
        <RepairControl reference={status.externalId} repair={repair} />
      ) : null}
    </>
  );
}

function SyncStatusSection({ saleRef, timeZone }: Readonly<SectionProps>): React.JSX.Element {
  const t = useT();
  const scope = useSaleScope();
  const read = useSaleSyncStatus({ scope, saleRef });
  const repair = useRepairSale({ scope, saleRef });
  let body: React.ReactNode = null;
  if (read.isLoading) {
    body = <ListState state="loading" label={t("saleSync.status.loadingNoun")} />;
  } else if (read.error) {
    body = (
      <ReadError
        error={read.error}
        failedKey="saleSync.status.loadFailed"
        notFoundKey="saleSync.status.notFound"
        onRetry={read.retry}
      />
    );
  } else if (read.data) {
    body = <StatusBody status={read.data} timeZone={timeZone} repair={repair} />;
  }
  return (
    <Section id="sale-sync-status" titleKey="saleSync.section.status">
      <StaleError error={read.inlineError} onRetry={read.retry} />
      <RepairOutcomeBanner outcome={repair.outcome} />
      {body}
    </Section>
  );
}

function TimelineRow({
  entry,
  timeZone,
}: Readonly<{ entry: AuditTimelineEntry; timeZone?: string }>): React.JSX.Element {
  const t = useT();
  return (
    <tr className="data-table__row data-table__row--static">
      <td>
        <DateTime value={entry.at} timeZone={timeZone} />
      </td>
      <th scope="row">
        {t(eventKey(entry.event))}
        {isKnownEvent(entry.event) ? null : (
          <>
            {" "}
            <Machine value={entry.event} />
          </>
        )}
      </th>
      <td>
        {entry.correlationId ? (
          <Machine value={entry.correlationId} />
        ) : (
          <span className="muted">{t("saleSync.value.notRecorded")}</span>
        )}
      </td>
    </tr>
  );
}

function TimelineSection({ saleRef, timeZone }: Readonly<SectionProps>): React.JSX.Element {
  const t = useT();
  const scope = useSaleScope();
  const read = useSaleAuditTimeline({ scope, saleRef });
  const entries = read.data?.entries ?? [];
  let body: React.ReactNode = null;
  if (read.isLoading) {
    body = <ListState state="loading" label={t("saleSync.timeline.loadingNoun")} />;
  } else if (read.error) {
    body = (
      <ReadError
        error={read.error}
        failedKey="saleSync.timeline.loadFailed"
        notFoundKey="saleSync.timeline.notFound"
        onRetry={read.retry}
      />
    );
  } else if (read.data && entries.length === 0) {
    body = <p className="content__sub">{t("saleSync.timeline.empty")}</p>;
  } else if (read.data) {
    body = (
      <div className="table-scroll">
        <table className="data-table">
          <caption className="data-table__caption">{t("saleSync.timeline.caption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("saleSync.timeline.col.at")}</th>
              <th scope="col">{t("saleSync.timeline.col.event")}</th>
              <th scope="col">{t("saleSync.timeline.col.correlation")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              // Entries carry no id; the server's order and time identify them.
              <TimelineRow key={`${index}-${entry.at}`} entry={entry} timeZone={timeZone} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <Section id="sale-sync-timeline" titleKey="saleSync.section.timeline">
      <p className="content__sub">{t("saleSync.timeline.sub")}</p>
      <StaleError error={read.inlineError} onRetry={read.retry} />
      {body}
    </Section>
  );
}

/** Both sections, for the roles the API serves; nothing (and no request) otherwise. */
export function SaleSyncSections({
  saleRef,
  timeZone,
}: Readonly<SectionProps>): React.JSX.Element | null {
  const scope = useSaleScope();
  if (!canUseSaleSyncOps(scope.role)) return null;
  return (
    <>
      <SyncStatusSection saleRef={saleRef} timeZone={timeZone} />
      <TimelineSection saleRef={saleRef} timeZone={timeZone} />
    </>
  );
}
