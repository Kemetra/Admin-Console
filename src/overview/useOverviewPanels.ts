/**
 * RT-559 the Overview's five reads (spec 009 §5.1–§5.2). Each uses an
 * operation that already exists in the generated client, through its existing
 * typed wrapper, and each is narrowed by the active store when one is selected
 * (§6.1): `store_id` on P-2…P-5, only that store's row on P-1.
 *
 * Roles: the nav's own helpers skip the two reads the API is known to refuse
 * (stock discrepancies, shift closes); everything else asks the backend, and a
 * 403/404 omits the panel (§6.2).
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { consoleListReceivables, listAuditEvents } from "@/lib/client";
import { consoleListShiftCloses } from "@/lib/shift-close-queries";
import {
  type SnapshotStatusCode,
  type StoreNegativeOnHandSummary,
  listErpnextNegativeOnHandStores,
} from "@/lib/stock-discrepancy-queries";
import { listUnknownItems } from "@/lib/unknown-items-queries";
import { canReadShiftCloses } from "@/shift-closes/shiftCloseLogic";
import { canReadStockDiscrepancies, statusView } from "@/stock-discrepancies/stockDiscrepancyLogic";
import { useStoreList } from "@/stores/useStoreQueries";
import { useState } from "react";
import { type PageCount, pageCount, shiftAttention } from "./overviewLogic";
import {
  type ApiResult,
  type OverviewScope,
  type PanelGate,
  type PanelRead,
  type PanelState,
  itemsOf,
  overviewKey,
  readResult,
  usePanelQuery,
} from "./usePanelQuery";

export interface OverviewSession extends OverviewScope {
  role: string | null;
}

/** Active tenant, active store and role, from RF-1's provider. */
export function useOverviewSession(): OverviewSession {
  const { context } = useActiveContextValue();
  return {
    tenantId: context?.active_tenant?.id ?? null,
    activeStoreId: context?.active_store?.id ?? null,
    role: context?.active_role_code ?? null,
  };
}

function storeQuery(scope: OverviewScope): { store_id?: string } {
  return scope.activeStoreId ? { store_id: scope.activeStoreId } : {};
}

function roleGate(allowed: boolean): PanelGate {
  return allowed ? "run" : "skip";
}

/** One page's count, from a body whose cursor field is `cursorField`. */
function countOf(cursorField: "nextCursor" | "next_cursor") {
  return (data: unknown): PageCount | undefined => {
    const items = itemsOf(data);
    if (!items) return undefined;
    const cursor = (data as Record<string, unknown>)[cursorField];
    return pageCount(items.length, typeof cursor === "string" ? cursor : null);
  };
}

// --- P-1 Stock discrepancies --------------------------------------------------------

export interface StockPanel {
  stores: StoreNegativeOnHandSummary[];
  /** The page cap was reached before the last page: some stores are not listed. */
  truncated: boolean;
}

/** A bound on the store walk; one page already holds 50 stores. */
export const MAX_STORE_PAGES = 20;

type StoresPage = { items: StoreNegativeOnHandSummary[]; nextCursor?: string | null };

/**
 * A summary the ledger can render: a store and a snapshot status the stock
 * screen's own vocabulary (`statusView`) knows.
 */
function isSummary(item: unknown): item is StoreNegativeOnHandSummary {
  const summary = item as Partial<StoreNegativeOnHandSummary> | null;
  const status = summary?.snapshot?.status;
  // `statusView` has no entry (so no `labelKey`) for a status outside the contract.
  const known =
    typeof status === "string" && statusView(status as SnapshotStatusCode)?.labelKey !== undefined;
  return typeof summary?.storeId === "string" && known;
}

/** A page whose every item is a renderable summary; anything else is malformed. */
function storesPage(data: unknown): StoresPage | undefined {
  const items = itemsOf(data);
  return items?.every(isSummary) ? (data as StoresPage) : undefined;
}

/**
 * The one walk §5.2 allows: following `nextCursor` to list stores (each count is
 * per store, so nothing is summed across pages). With an active store the walk
 * stops once that store is found; if it never appears, the panel is omitted.
 */
async function readStockStores(activeStoreId: string | null): Promise<PanelRead<StockPanel>> {
  const stores: StoreNegativeOnHandSummary[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_STORE_PAGES; page++) {
    const read = readResult(await listErpnextNegativeOnHandStores({ cursor }), storesPage);
    if (read.kind !== "ready") return read;
    stores.push(...read.data.items);
    const found = activeStoreId ? stores.filter((s) => s.storeId === activeStoreId) : null;
    if (found?.length) return { kind: "ready", data: { stores: found, truncated: false } };
    cursor = read.data.nextCursor ?? undefined;
    if (!cursor) {
      return found ? { kind: "hidden" } : { kind: "ready", data: { stores, truncated: false } };
    }
  }
  return activeStoreId ? { kind: "hidden" } : { kind: "ready", data: { stores, truncated: true } };
}

export function useStockPanel(session: OverviewSession): PanelState<StockPanel> {
  return usePanelQuery({
    key: overviewKey("stock", session),
    gate: roleGate(canReadStockDiscrepancies(session.role)),
    read: () => readStockStores(session.activeStoreId),
  });
}

// --- P-2 Shift-close variances (OD-009-2) -------------------------------------------

export interface ShiftPanel {
  state: PanelState<PageCount>;
  /** The destination with the same filters, known before the read lands. */
  href: string;
}

/**
 * The active store's zone, from the same roster the destination reads
 * (`useStoreDirectory` over RF-2's store list) with the same UTC fallback, so
 * row and list match. Read only when a store is active, and a roster that is
 * not a list reads as no zone: the landing page must never fail on it.
 */
function useActiveStoreZone(session: OverviewSession): { timeZone: string; ready: boolean } {
  const storeId = session.activeStoreId;
  const { result, isLoading } = useStoreList(storeId ? session.tenantId : null);
  const rows = result?.kind === "rows" && Array.isArray(result.rows) ? result.rows : [];
  const zone = rows.find((store) => store.id === storeId)?.timezone;
  return { timeZone: zone ?? "UTC", ready: !storeId || !isLoading };
}

export function useShiftPanel(session: OverviewSession): ShiftPanel {
  const { timeZone, ready } = useActiveStoreZone(session);
  const [nowMs] = useState(() => Date.now());
  const storeId = session.activeStoreId;
  const attention = shiftAttention({ storeId, timeZone, nowMs });
  const allowed = canReadShiftCloses(session.role);
  const state = usePanelQuery({
    key: [...overviewKey("shift", session), attention.query],
    gate: allowed && !ready ? "wait" : roleGate(allowed),
    read: async () =>
      readResult(await consoleListShiftCloses(attention.query), countOf("nextCursor")),
  });
  return { state, href: attention.href };
}

// --- P-3 Unknown items, P-4 Flagged receivables ---------------------------------------

export function useUnknownItemsPanel(session: OverviewSession): PanelState<PageCount> {
  return usePanelQuery({
    key: overviewKey("unknown-items", session),
    gate: "run",
    read: async () =>
      readResult(
        (await listUnknownItems({ status: "pending", ...storeQuery(session) })) as ApiResult,
        countOf("next_cursor"),
      ),
  });
}

export function useReceivablesPanel(session: OverviewSession): PanelState<PageCount> {
  return usePanelQuery({
    key: overviewKey("receivables", session),
    gate: "run",
    read: async () =>
      readResult(
        await consoleListReceivables({ state: "flagged", ...storeQuery(session) }),
        countOf("nextCursor"),
      ),
  });
}

// --- P-5 Recent activity --------------------------------------------------------------

export const ACTIVITY_LIMIT = 10;

export interface ActivityEvent {
  id: string;
  occurred_at: string;
  actor_user_id?: string | null;
  actor_label?: string | null;
  action: string;
}

export function useActivityPanel(session: OverviewSession): PanelState<ActivityEvent[]> {
  return usePanelQuery({
    key: overviewKey("activity", session),
    gate: "run",
    read: async () =>
      readResult(await listAuditEvents({ limit: ACTIVITY_LIMIT, ...storeQuery(session) }), (data) =>
        (itemsOf(data) as ActivityEvent[] | undefined)?.slice(0, ACTIVITY_LIMIT),
      ),
  });
}
