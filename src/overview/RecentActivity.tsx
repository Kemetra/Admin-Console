/**
 * RT-559 recent activity (spec 009 P-5, AC-10). The latest audit events in
 * scope, as a short semantic table: the exact recorded instant (evidence, UTC,
 * as the audit screen shows it), the actor, and catalog copy for the action
 * (the machine code picks the copy and is never shown). Newest-first is the
 * runtime's order (BC-009-3); nothing is re-sorted here. A refused read (403/404)
 * omits the section.
 */
import { formatEvidenceTime, useT } from "@/i18n";
import { Link } from "react-router";
import { auditActionKey } from "./overviewLogic";
import type { ActivityEvent, OverviewSession } from "./useOverviewPanels";
import { useActivityPanel } from "./useOverviewPanels";
import type { PanelState } from "./usePanelQuery";

function shortId(id?: string | null): string {
  if (!id) return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function ActivityTable({ events }: Readonly<{ events: ActivityEvent[] }>): React.JSX.Element {
  const t = useT();
  return (
    <div className="table-scroll">
      <table className="data-table activity-table">
        <caption className="data-table__caption">{t("overview.activity.caption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("overview.activity.col.time")}</th>
            <th scope="col">{t("overview.activity.col.actor")}</th>
            <th scope="col">{t("overview.activity.col.action")}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="data-table__row">
              <td className="activity-table__time">
                <bdi dir="ltr">{formatEvidenceTime(event.occurred_at)}</bdi>
              </td>
              <td>
                {event.actor_label != null ? (
                  <bdi>{event.actor_label}</bdi>
                ) : (
                  <bdi dir="ltr">{shortId(event.actor_user_id)}</bdi>
                )}
              </td>
              <td>{t(auditActionKey(event.action ?? ""))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityBody({
  state,
}: Readonly<{
  state: Exclude<PanelState<ActivityEvent[]>, { status: "hidden" }>;
}>): React.JSX.Element {
  const t = useT();
  if (state.status === "loading") {
    return (
      <p className="ledger__pending" aria-busy="true">
        <span className="spinner" aria-hidden="true" />
        {t("overview.row.loading")}
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p className="ledger__error" role="alert">
        {t("overview.activity.failed")}
        <button type="button" className="btn-secondary ledger__retry" onClick={state.retry}>
          {t("overview.row.retry")}
        </button>
      </p>
    );
  }
  if (state.data.length === 0) {
    return <p className="ledger__quiet">{t("overview.activity.empty")}</p>;
  }
  return <ActivityTable events={state.data} />;
}

export function RecentActivity({
  session,
}: Readonly<{ session: OverviewSession }>): React.JSX.Element | null {
  const t = useT();
  const state = useActivityPanel(session);
  if (state.status === "hidden") return null;
  return (
    <section className="overview__section" aria-labelledby="overview-activity">
      <h2 id="overview-activity" className="overview__heading">
        {t("overview.activity.title")}
      </h2>
      <ActivityBody state={state} />
      <p>
        <Link className="ledger__link" to="/audit">
          {t("overview.activity.open")}
        </Link>
      </p>
    </section>
  );
}
