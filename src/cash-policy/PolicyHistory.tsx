/**
 * RT-389 revision history: every change is an immutable revision, newest first
 * (D-3). A permanent override is labelled, never hidden; an expired override is
 * shown as the revision's `expired` state, which is how the reversion reads
 * (the `override_expired` audit event is not a revision). Actors are ids: the
 * contract carries no names.
 */
import { DateTime, type MessageKey, useT } from "@/i18n";
import type { CashVariancePolicyRevision } from "@/lib/cash-variance-policy-queries";
import { MachineId, PolicyValue } from "./PolicyParts";
import type { RevisionList } from "./useCashPolicy";
import "@/components/data-table.css";

const STATE_KEY: Record<CashVariancePolicyRevision["state"], MessageKey> = {
  current: "cashPolicy.history.state.current",
  superseded: "cashPolicy.history.state.superseded",
  expired: "cashPolicy.history.state.expired",
};

function Row({
  revision,
  timeZone,
}: Readonly<{ revision: CashVariancePolicyRevision; timeZone?: string }>): React.JSX.Element {
  const t = useT();
  return (
    <tr>
      <td>
        <DateTime value={revision.effectiveFrom} timeZone={timeZone} />
      </td>
      <td>
        {t(
          revision.kind === "set" ? "cashPolicy.history.kind.set" : "cashPolicy.history.kind.clear",
        )}
        {revision.permanent ? (
          <>
            {" "}
            <span className="badge">{t("cashPolicy.override.permanent")}</span>
          </>
        ) : null}
      </td>
      <td>
        {revision.policyValue ? (
          <PolicyValue value={revision.policyValue} />
        ) : (
          t("cashPolicy.history.noValue")
        )}
      </td>
      <td>
        <bdi dir="auto">{revision.reason}</bdi>
        {revision.effectiveUntil ? (
          <span className="field__hint cash-policy__line">
            {t("cashPolicy.field.until")}:{" "}
            <DateTime value={revision.effectiveUntil} timeZone={timeZone} />
          </span>
        ) : null}
      </td>
      <td>
        <MachineId value={revision.createdByUserId} />
        {revision.approvedByUserId ? (
          <span className="field__hint cash-policy__line">
            {t("cashPolicy.field.approvedBy")}: <MachineId value={revision.approvedByUserId} />
          </span>
        ) : null}
      </td>
      <td>
        {t(STATE_KEY[revision.state])}
        {revision.state === "expired" ? (
          <span className="field__hint cash-policy__line">
            {t("cashPolicy.history.expiredNote")}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

export function PolicyHistory({
  list,
  timeZone,
}: Readonly<{ list: RevisionList; timeZone?: string }>): React.JSX.Element {
  const t = useT();
  return (
    <section className="cash-policy__history" aria-labelledby="cash-policy-history-title">
      <h3 id="cash-policy-history-title" className="surface__section-title">
        {t("cashPolicy.history.title")}
      </h3>

      {list.failed ? (
        <p className="field__hint" role="alert">
          {t("cashPolicy.history.loadFailed")}{" "}
          <button type="button" className="btn-ghost" onClick={list.refetch}>
            {t("cashPolicy.retry")}
          </button>
        </p>
      ) : null}

      {list.rows.length > 0 ? (
        <div className="cash-policy__table-wrap">
          <table className="data-table">
            <caption className="data-table__caption">{t("cashPolicy.history.caption")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("cashPolicy.history.col.when")}</th>
                <th scope="col">{t("cashPolicy.history.col.change")}</th>
                <th scope="col">{t("cashPolicy.history.col.value")}</th>
                <th scope="col">{t("cashPolicy.history.col.reason")}</th>
                <th scope="col">{t("cashPolicy.history.col.by")}</th>
                <th scope="col">{t("cashPolicy.history.col.state")}</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((revision) => (
                <Row key={revision.revisionId} revision={revision} timeZone={timeZone} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!list.isLoading && !list.failed && list.rows.length === 0 ? (
        <p className="field__hint">{t("cashPolicy.history.empty")}</p>
      ) : null}

      {list.hasMore ? (
        <button
          type="button"
          className="btn-secondary"
          onClick={list.loadMore}
          disabled={list.isFetchingNextPage}
        >
          {t("cashPolicy.history.loadMore")}
        </button>
      ) : null}
    </section>
  );
}
