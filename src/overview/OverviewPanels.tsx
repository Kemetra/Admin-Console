/**
 * RT-559 the Overview's panels under the scope line (spec 009 v1: P-1…P-4).
 * Nothing renders and nothing is read without an active tenant (AC-2). Reads
 * happen on load and on scope change (the shell remounts the route per scope,
 * and every key carries the scope), plus one manual refresh (NG-7: no polling).
 * No sales or KPI element exists until BC-009-1 (AC-11). Recent activity (P-5)
 * is deferred until Backend-Core can leave read-only audits out (OD-009-3,
 * RT-567): owner and tenant_admin get a plain link to `/audit` instead (AC-10).
 */
import { useT } from "@/i18n";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { AttentionLedger } from "./AttentionLedger";
import { canOpenAudit } from "./overviewLogic";
import { useOverviewSession } from "./useOverviewPanels";
import { OVERVIEW_KEY } from "./usePanelQuery";
import "./overview.css";

/**
 * One manual re-read of every panel. While it runs the button stays focusable
 * (`aria-disabled`, not `disabled`, which would drop keyboard focus) and ignores
 * presses; a polite status line announces it.
 */
function RefreshButton(): React.JSX.Element {
  const t = useT();
  const qc = useQueryClient();
  const fetching = useIsFetching({ queryKey: OVERVIEW_KEY }) > 0;
  const refresh = () => {
    if (!fetching) void qc.refetchQueries({ queryKey: OVERVIEW_KEY, type: "active" });
  };
  return (
    <>
      <button
        type="button"
        className="btn-secondary overview__refresh"
        aria-disabled={fetching}
        onClick={refresh}
      >
        {fetching ? t("overview.refreshing") : t("overview.refresh")}
      </button>
      <span className="sr-only" role="status">
        {fetching ? t("overview.refreshing") : ""}
      </span>
    </>
  );
}

export function OverviewPanels(): React.JSX.Element | null {
  const t = useT();
  const session = useOverviewSession();
  if (!session.tenantId) return null;
  return (
    <div className="overview">
      <div className="overview__toolbar">
        <RefreshButton />
      </div>
      <AttentionLedger session={session} />
      {canOpenAudit(session.role) ? (
        <p className="overview__related">
          <Link className="ledger__link" to="/audit">
            {t("shell.nav.audit")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
