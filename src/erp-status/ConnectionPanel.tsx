/**
 * RT-560 connection panel (spec 016 §4.1). One row per C1 registration joined
 * with C2 by registration id. Liveness is C2's verdict: `never_seen`, a missing
 * C2 row or a failed C2 read reads "no signal", never connected and never an
 * error (A-1, A-2). Version and ERPNext reachability are the connector's own
 * report and are labelled so, with the time they were reported; null reads
 * "not reported" (A-3). No credential secret exists in these reads.
 */
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { ListState } from "@/components/ListState";
import { DateTime, type MessageKey, type T, formatDuration, useT } from "@/i18n";
import type { ConnectorHealthView } from "@/lib/erp-status-queries";
import { type ConnectionRow, reachabilityKey, signalView, sinceSeconds } from "./erpStatusLogic";
import { AsOf, Panel, PanelError, StaleError, StatusPill } from "./parts";
import type { ConnectionsState } from "./useErpStatus";

const ENV_KEYS: Record<string, MessageKey> = {
  dev: "erp.env.dev",
  staging: "erp.env.staging",
  pilot: "erp.env.pilot",
  prod: "erp.env.prod",
};

function envKey(environment: string): MessageKey {
  return Object.hasOwn(ENV_KEYS, environment) ? ENV_KEYS[environment] : "erp.env.unknown";
}

function headers(t: T): { key: string; header: string }[] {
  return [
    { key: "instance", header: t("erp.conn.col.instance") },
    { key: "environment", header: t("erp.conn.col.environment") },
    { key: "site", header: t("erp.conn.col.site") },
    { key: "signal", header: t("erp.conn.col.signal") },
    { key: "lastSeen", header: t("erp.conn.col.lastSeen") },
    { key: "version", header: t("erp.conn.col.version") },
    { key: "reachable", header: t("erp.conn.col.reachable") },
    { key: "credential", header: t("erp.conn.col.credential") },
  ];
}

/** No C2 row for this instance (or no readable C2): nothing is known about it. */
function Unknown(): React.JSX.Element {
  const t = useT();
  return <span className="muted">{t("erp.conn.unknown")}</span>;
}

function LastSeen({ health }: Readonly<{ health?: ConnectorHealthView }>): React.JSX.Element {
  const t = useT();
  if (!health) return <Unknown />;
  if (!health.lastSeenAt) return <span className="muted">{t("erp.conn.never")}</span>;
  const since = sinceSeconds(health.secondsSinceLastSeen);
  return (
    <span className="erp-stack">
      <DateTime value={health.lastSeenAt} />
      {since === null ? null : (
        <small className="muted">{t("erp.conn.since", { duration: formatDuration(since) })}</small>
      )}
    </span>
  );
}

/** A self-reported value with the time it was reported (A-3). */
function Reported({
  health,
  children,
}: Readonly<{ health?: ConnectorHealthView; children: React.ReactNode }>): React.JSX.Element {
  const t = useT();
  return (
    <span className="erp-stack">
      {children}
      {health?.reportedFieldsAt ? (
        <small className="muted">
          {t.rich("erp.conn.reportedAt", { time: <DateTime value={health.reportedFieldsAt} /> })}
        </small>
      ) : null}
    </span>
  );
}

function ConnectionTableRow({ row }: Readonly<{ row: ConnectionRow }>): React.JSX.Element {
  const t = useT();
  const { instance, health } = row;
  const credential = instance.active_credential;
  return (
    <tr className="data-table__row erp-row">
      <th scope="row" className="erp-row__name">
        <span className="erp-stack">
          <bdi>{instance.display_name}</bdi>
          {instance.disabled_at ? (
            <small className="muted">{t("erp.conn.registrationDisabled")}</small>
          ) : null}
        </span>
      </th>
      <td>{t(envKey(instance.environment))}</td>
      <td className="data-table__cell--mono">
        <bdi dir="ltr">{instance.erpnext_site_ref}</bdi>
      </td>
      <td className="nowrap">
        <StatusPill view={signalView(row.signal)} />
      </td>
      <td>
        <LastSeen health={health} />
      </td>
      <td>{health ? <Version health={health} /> : <Unknown />}</td>
      <td>
        {health ? (
          <Reported health={health}>{t(reachabilityKey(health.erpnextReachable))}</Reported>
        ) : (
          <Unknown />
        )}
      </td>
      <td>
        {credential ? (
          <DateTime value={credential.expires_at} />
        ) : (
          <span className="muted">{t("erp.conn.noCredential")}</span>
        )}
      </td>
    </tr>
  );
}

function Version({ health }: Readonly<{ health: ConnectorHealthView }>): React.JSX.Element {
  const t = useT();
  return (
    <Reported health={health}>
      {health.connectorVersion ? (
        <bdi dir="ltr" className="data-table__cell--mono">
          {health.connectorVersion}
        </bdi>
      ) : (
        <span className="muted">{t("erp.reported.notReported")}</span>
      )}
    </Reported>
  );
}

function ConnectionTable({ rows }: Readonly<{ rows: ConnectionRow[] }>): React.JSX.Element {
  const t = useT();
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="data-table__caption">{t("erp.conn.caption")}</caption>
        <thead>
          <tr>
            {headers(t).map((col) => (
              <th key={col.key} scope="col">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ConnectionTableRow key={row.instance.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConnectionBody({ state }: Readonly<{ state: ConnectionsState }>): React.JSX.Element {
  const t = useT();
  if (state.isLoading) {
    return (
      <DataTableSkeleton
        caption={t("erp.conn.caption")}
        columns={headers(t)}
        label={t("erp.conn.loadingNoun")}
      />
    );
  }
  if (state.error) {
    return (
      <PanelError
        error={state.error}
        failedMessage={t("erp.conn.loadFailed")}
        onRetry={state.retry}
      />
    );
  }
  if (state.rows.length === 0) {
    return (
      <ListState
        state="empty"
        emptyMessage={t("erp.conn.empty")}
        emptyHint={t("erp.conn.emptyHint")}
      />
    );
  }
  // The note explains the never_seen verdict only; other no-signal causes are not known here.
  const anyNeverSeen = state.rows.some((row) => row.health?.liveness === "never_seen");
  return (
    <>
      {state.healthFailed ? <p className="erp-note">{t("erp.conn.healthFailed")}</p> : null}
      <ConnectionTable rows={state.rows} />
      {anyNeverSeen ? <p className="erp-note">{t("erp.conn.noSignalNote")}</p> : null}
    </>
  );
}

export function ConnectionPanel({
  state,
}: Readonly<{ state: ConnectionsState }>): React.JSX.Element {
  const t = useT();
  return (
    <Panel id="erp-connection" title={t("erp.conn.title")}>
      <StaleError panel={state} />
      <ConnectionBody state={state} />
      <AsOf at={state.asOf} />
    </Panel>
  );
}
