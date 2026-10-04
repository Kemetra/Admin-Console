import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
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
import { type TriggerOutcome, canRequestSnapshot, hasSnapshot } from "./stockDiscrepancyLogic";
import { useRequestSnapshot, useStoreNegativeOnHand } from "./useStockDiscrepancies";
import "../shell/surface.css";
import "./stock-discrepancies.css";

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

function outcomeBanner(outcome: TriggerOutcome): React.JSX.Element | null {
  switch (outcome.kind) {
    case "requested":
      return null;
    case "not-found":
      return (
        <Banner
          variant="danger"
          message="Not found. A snapshot cannot be requested for this store."
          requestId={outcome.requestId}
        />
      );
    case "key-conflict":
      return (
        <Banner
          variant="warning"
          message="That snapshot request conflicted with an earlier one. Try again."
          requestId={outcome.requestId}
        />
      );
    case "error":
      return (
        <Banner
          variant="danger"
          message="The snapshot request could not be sent. Try again."
          requestId={outcome.requestId}
        />
      );
  }
}

export function StockDiscrepancyStore(): React.JSX.Element {
  const { storeId } = useParams();
  const { context } = useActiveContextValue();
  const tenantId = context?.active_tenant?.id ?? null;
  const scope = { tenantId, activeStoreId: context?.active_store?.id ?? null };
  const { snapshot, items, isLoading, error, hasMore, isFetchingNextPage, loadMore } =
    useStoreNegativeOnHand(scope, storeId);
  const request = useRequestSnapshot(storeId);
  const [outcome, setOutcome] = useState<TriggerOutcome | null>(null);
  const showRefresh = canRequestSnapshot(context?.active_role_code);

  if (!tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">Select a tenant to view ERPNext stock discrepancies.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="surface">
        <ListState state="loading" label="ERPNext snapshot" />
      </div>
    );
  }

  if (error) {
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

  if (!snapshot) {
    return <div className="surface" />;
  }

  async function onRequest(): Promise<void> {
    setOutcome(null);
    try {
      setOutcome(await request.mutateAsync());
    } catch {
      setOutcome({ kind: "error" });
    }
  }

  const mapped = snapshot.status !== "no_warehouse_mapping";

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
          <div className="refresh-action">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void onRequest()}
              disabled={request.isPending || !mapped}
            >
              {request.isPending ? "Requesting…" : "Request fresh snapshot"}
            </button>
            {!mapped ? (
              <small className="muted">Map an ERPNext stock warehouse for this store first.</small>
            ) : null}
          </div>
        ) : null}
      </header>

      {outcome ? outcomeBanner(outcome) : null}

      <SnapshotStatusPanel snapshot={snapshot} />

      {hasSnapshot(snapshot.status) && items.length === 0 ? (
        <ListState state="empty" emptyMessage="No items below zero in this ERPNext snapshot." />
      ) : null}

      {items.length > 0 ? (
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
                <tr
                  key={`${item.erpnextWarehouseRef}/${item.erpnextItemRef.name}`}
                  className="data-table__row"
                >
                  <td>
                    {item.mappingStatus === "mapped" && item.tenantProduct ? (
                      item.tenantProduct.name
                    ) : (
                      <span
                        className="badge badge--suspended"
                        title="Not mapped to a Retail Tower product"
                      >
                        Not mapped
                      </span>
                    )}
                  </td>
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
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {hasMore ? (
        <div>
          <button
            type="button"
            className="btn-secondary"
            onClick={loadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading…" : "Load more items"}
          </button>
        </div>
      ) : null}

      <DeskGuidance />
    </div>
  );
}
