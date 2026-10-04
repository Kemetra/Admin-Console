import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import type { NegativeOnHandItem, StockSnapshotStatus } from "@/lib/stock-discrepancy-queries";
/**
 * RT-178 — one store's ERPNext negative on-hand items. Header: the API's
 * snapshot block ("ERPNext snapshot as of {readAt}", stale / no_snapshot /
 * no_warehouse_mapping / pending states). Table: product name or a "Not mapped"
 * badge, ERPNext Item ref, warehouse, the signed `quantity` string EXACTLY as
 * the API sent it (never parsed or float-formatted), and stock UOM. Static
 * ERPNext Desk guidance; no acknowledge, no re_sync / re_map, no ERPNext call.
 * "Request fresh snapshot" (owner / tenant_admin only) calls the existing
 * `triggerReconciliationRun`. A 404 renders as not-found.
 */
import { useState } from "react";
import { Link, useParams } from "react-router";
import { SnapshotStatusPanel } from "./SnapshotStatusPanel";
import { LoadMoreButton, TenantScopePrompt, useDiscrepancyScope } from "./shared";
import {
  type TriggerOutcome,
  canRequestSnapshot,
  outcomeBannerView,
  statusView,
} from "./stockDiscrepancyLogic";
import {
  type StockDiscrepancyError,
  useRequestSnapshot,
  useStoreNegativeOnHand,
} from "./useStockDiscrepancies";
import "../shell/surface.css";
import "./stock-discrepancies.css";

type StoreData = ReturnType<typeof useStoreNegativeOnHand>;

function BackLink(): React.JSX.Element {
  return (
    <Link to="/stock-discrepancies" className="surface__back">
      ← Back to stores
    </Link>
  );
}

function DeskGuidance(): React.JSX.Element {
  return (
    <aside className="desk-guidance" aria-label="Resolving in ERPNext Desk">
      <h2 className="desk-guidance__title">Resolving a negative quantity in ERPNext Desk</h2>
      <ul>
        <li>
          Post the missing Purchase Receipt, or a Stock Entry (Material Receipt or Material
          Transfer), for the item and warehouse.
        </li>
        <li>Or record a physical count with a Stock Reconciliation.</li>
        <li>Do not post a balancing entry blindly; find the missing document first.</li>
      </ul>
      <p>
        Retail Tower creates no stock documents. A row clears only when a later ERPNext snapshot
        shows the item at zero or above.
      </p>
    </aside>
  );
}

/**
 * Refresh state: one `triggerReconciliationRun` per click, with its outcome
 * kept for the banner. A thrown request maps to the generic error outcome.
 */
function useSnapshotRequest(storeId: string | undefined) {
  const request = useRequestSnapshot(storeId);
  const [outcome, setOutcome] = useState<TriggerOutcome | null>(null);

  async function requestSnapshot(): Promise<void> {
    setOutcome(null);
    try {
      setOutcome(await request.mutateAsync());
    } catch {
      setOutcome({ kind: "error" });
    }
  }

  return { isPending: request.isPending, outcome, requestSnapshot };
}

interface RefreshButtonProps {
  isPending: boolean;
  canRefresh: boolean;
  onRequest: () => void;
}

/** "Request fresh snapshot" (owner / tenant_admin only; disabled without a mapping). */
function RefreshButton({
  isPending,
  canRefresh,
  onRequest,
}: RefreshButtonProps): React.JSX.Element {
  return (
    <div className="refresh-action">
      <button
        type="button"
        className="btn-primary"
        onClick={onRequest}
        disabled={isPending || !canRefresh}
      >
        {isPending ? "Requesting…" : "Request fresh snapshot"}
      </button>
      {canRefresh ? null : (
        <small className="muted">Map an ERPNext stock warehouse for this store first.</small>
      )}
    </div>
  );
}

function OutcomeBanner({ outcome }: { outcome: TriggerOutcome | null }): React.JSX.Element | null {
  const view = outcome ? outcomeBannerView(outcome) : null;
  if (!outcome || !view) return null;
  const requestId = "requestId" in outcome ? outcome.requestId : undefined;
  return <Banner variant={view.variant} message={view.message} requestId={requestId} />;
}

function ProductCell({ item }: { item: NegativeOnHandItem }): React.JSX.Element {
  if (item.tenantProduct && item.mappingStatus === "mapped") {
    return <td>{item.tenantProduct.name}</td>;
  }
  return (
    <td>
      <span className="badge badge--suspended" title="Not mapped to a Retail Tower product">
        Not mapped
      </span>
    </td>
  );
}

function ItemRow({ item }: { item: NegativeOnHandItem }): React.JSX.Element {
  return (
    <tr className="data-table__row">
      <ProductCell item={item} />
      <td>
        <code className="mono">{item.erpnextItemRef.name}</code>
      </td>
      <td className="mono">{item.erpnextWarehouseRef}</td>
      {/* Exact-decimal string from the API — rendered verbatim, sign included. */}
      <td className="num mono" data-testid="negative-quantity">
        {item.quantity}
      </td>
      <td>{item.stockUom}</td>
    </tr>
  );
}

function ItemsTable({ items }: { items: NegativeOnHandItem[] }): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div className="table-scroll">
      <table className="data-table stock-table">
        <caption className="data-table__caption">Items below zero in ERPNext</caption>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">ERPNext Item</th>
            <th scope="col">Warehouse</th>
            <th scope="col" className="num">
              Quantity
            </th>
            <th scope="col">Stock UOM</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ItemRow key={`${item.erpnextWarehouseRef}/${item.erpnextItemRef.name}`} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "No items below zero" only when a snapshot exists — never for no-snapshot states (AC2). */
function NoNegativeItems({
  snapshot,
  itemCount,
}: { snapshot: StockSnapshotStatus; itemCount: number }): React.JSX.Element | null {
  if (!statusView(snapshot.status).hasSnapshot || itemCount > 0) return null;
  return <ListState state="empty" emptyMessage="No items below zero in this ERPNext snapshot." />;
}

function StoreErrorView({ error }: { error: StockDiscrepancyError }): React.JSX.Element {
  return (
    <div className="surface">
      <BackLink />
      {error.kind === "not-found" ? (
        <>
          <h1 className="content__title">Store not found</h1>
          <Banner
            variant="danger"
            message="Not found. This store does not exist or is not available to you."
            requestId={error.requestId}
          />
        </>
      ) : (
        <Banner
          variant="danger"
          message="ERPNext stock discrepancies could not be loaded."
          requestId={error.requestId}
        />
      )}
    </div>
  );
}

function LoadingView(): React.JSX.Element {
  return (
    <div className="surface">
      <ListState state="loading" label="ERPNext snapshot" />
    </div>
  );
}

interface StoreViewProps {
  storeId: string | undefined;
  snapshot: StockSnapshotStatus;
  data: StoreData;
  showRefresh: boolean;
}

function StoreView({ storeId, snapshot, data, showRefresh }: StoreViewProps): React.JSX.Element {
  const refresh = useSnapshotRequest(storeId);
  return (
    <div className="surface">
      <BackLink />
      <header className="surface__head">
        <div>
          <h1 className="content__title">ERPNext stock discrepancies</h1>
          <p className="content__sub">
            Items below zero in this store's latest recorded ERPNext snapshot.
          </p>
        </div>
        {showRefresh ? (
          <RefreshButton
            isPending={refresh.isPending}
            canRefresh={statusView(snapshot.status).canRefresh}
            onRequest={() => void refresh.requestSnapshot()}
          />
        ) : null}
      </header>
      <OutcomeBanner outcome={refresh.outcome} />
      <SnapshotStatusPanel snapshot={snapshot} />
      <NoNegativeItems snapshot={snapshot} itemCount={data.items.length} />
      <ItemsTable items={data.items} />
      <LoadMoreButton
        hasMore={data.hasMore}
        isFetching={data.isFetchingNextPage}
        label="Load more items"
        onLoadMore={data.loadMore}
      />
      <DeskGuidance />
    </div>
  );
}

export function StockDiscrepancyStore(): React.JSX.Element {
  const { storeId } = useParams();
  const { scope, role } = useDiscrepancyScope();
  const data = useStoreNegativeOnHand(scope, storeId);

  if (!scope.tenantId) return <TenantScopePrompt />;
  if (data.isLoading) return <LoadingView />;
  if (data.error) return <StoreErrorView error={data.error} />;
  if (!data.snapshot) return <div className="surface" />;
  return (
    <StoreView
      storeId={storeId}
      snapshot={data.snapshot}
      data={data}
      showRefresh={canRequestSnapshot(role)}
    />
  );
}
