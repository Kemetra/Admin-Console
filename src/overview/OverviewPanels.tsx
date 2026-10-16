/**
 * RT-559 the Overview's panels under the scope line (spec 009 v1: P-1…P-5).
 * Nothing renders and nothing is read without an active tenant (AC-2). Reads
 * happen on load and on scope change (the shell remounts the route per scope,
 * and every key carries the scope), plus one manual refresh (NG-7: no polling).
 * No sales or KPI element exists until BC-009-1 (AC-11).
 */
import { useT } from "@/i18n";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { AttentionLedger } from "./AttentionLedger";
import { RecentActivity } from "./RecentActivity";
import { useOverviewSession } from "./useOverviewPanels";
import { OVERVIEW_KEY } from "./usePanelQuery";
import "./overview.css";

function RefreshButton(): React.JSX.Element {
  const t = useT();
  const qc = useQueryClient();
  const fetching = useIsFetching({ queryKey: OVERVIEW_KEY }) > 0;
  return (
    <button
      type="button"
      className="btn-secondary overview__refresh"
      disabled={fetching}
      onClick={() => void qc.refetchQueries({ queryKey: OVERVIEW_KEY, type: "active" })}
    >
      {fetching ? t("overview.refreshing") : t("overview.refresh")}
    </button>
  );
}

export function OverviewPanels(): React.JSX.Element | null {
  const session = useOverviewSession();
  if (!session.tenantId) return null;
  return (
    <div className="overview">
      <div className="overview__toolbar">
        <RefreshButton />
      </div>
      <AttentionLedger session={session} />
      <RecentActivity session={session} />
    </div>
  );
}
