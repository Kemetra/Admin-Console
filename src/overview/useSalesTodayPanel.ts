/**
 * RT-820 P-6 read (spec 009 OD-009-1, RT-751 D4/D7): one page of
 * `consoleGetSalesSummary` over a UTC -1..+1 day window, no cursor and no walk.
 * Narrowed by the active store when one is selected (§6.1). A 403/404 omits the
 * panel (§6.2); a body without a store list is an error, never zero.
 *
 * Store names come from the shared store roster read, tenant-wide. A roster that
 * fails or lacks a store never hides the figures: that store shows its machine ref.
 */
import { consoleGetSalesSummary } from "@/lib/sales-summary-queries";
import type { SalesSummary } from "@/lib/sales-summary-queries";
import { canReadSales } from "@/sales/saleLogic";
import { useStoreList } from "@/stores/useStoreQueries";
import { asSalesSummary, readWindow } from "./salesTodayLogic";
import type { OverviewSession } from "./useOverviewPanels";
import { type PanelState, overviewKey, readResult, usePanelQuery } from "./usePanelQuery";

/** The server returns at most this many stores per page (contract maximum). */
export const SALES_PAGE_SIZE = 50;

export interface SalesTodayPanel {
  state: PanelState<SalesSummary>;
  /** Store id to display name, for the stores the roster knows. */
  names: ReadonlyMap<string, string>;
}

/** `nowMs` is the Overview's last load or refresh, so a Refresh after UTC midnight moves the window. */
export function useSalesTodayPanel(session: OverviewSession, nowMs: number): SalesTodayPanel {
  const allowed = canReadSales(session.role);
  const roster = useStoreList(allowed ? session.tenantId : null);
  const window = readWindow(nowMs);
  const query = {
    ...(session.activeStoreId ? { store_id: session.activeStoreId } : {}),
    ...window,
    page_size: SALES_PAGE_SIZE,
  };
  const state = usePanelQuery({
    key: [...overviewKey("sales", session), window.from, window.to],
    gate: !allowed ? "skip" : roster.isLoading ? "wait" : "run",
    read: async () => readResult(await consoleGetSalesSummary(query), asSalesSummary),
  });
  const rows =
    roster.result?.kind === "rows" && Array.isArray(roster.result.rows) ? roster.result.rows : [];
  return { state, names: new Map(rows.map((s) => [s.id, s.name])) };
}
