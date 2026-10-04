import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
/**
 * RT-178 — ERPNext stock discrepancies, store summary list. One row per store
 * the API returns for the caller (owner / tenant_admin: their membership's
 * stores; store_manager: its scoped stores — the list is exactly what the API
 * returns, never filtered or widened here). Each row shows the API's snapshot
 * status, the "as of" time when a snapshot exists, and the negative item count;
 * `no_snapshot` / `no_warehouse_mapping` read "Unknown", never "0 issues".
 * A 404 (role not allowed) renders as not-found.
 */
import { Link } from "react-router";
import {
  hasSnapshot,
  negativeCountLabel,
  noSnapshotReason,
  snapshotStatusLabel,
} from "./stockDiscrepancyLogic";
import { useNegativeOnHandStores } from "./useStockDiscrepancies";
import "../shell/surface.css";
import "./stock-discrepancies.css";

export function StockDiscrepancyStores(): React.JSX.Element {
  const { context } = useActiveContextValue();
  const tenantId = context?.active_tenant?.id ?? null;
  const scope = { tenantId, activeStoreId: context?.active_store?.id ?? null };
  const { stores, isLoading, error, hasMore, isFetchingNextPage, loadMore, refetch } =
    useNegativeOnHandStores(scope);

  if (!tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">Select a tenant to view ERPNext stock discrepancies.</p>
      </div>
    );
  }

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">ERPNext stock discrepancies</h1>
          <p className="content__sub">
            Items with negative on-hand quantity in each store's latest recorded ERPNext snapshot.
            Read-only; resolve the cause in ERPNext Desk.
          </p>
        </div>
      </header>

      {error?.kind === "not-found" ? (
        <Banner
          variant="danger"
          message="Not found. ERPNext stock discrepancies are not available to you in this tenant."
          requestId={error.requestId}
        />
      ) : null}
      {error?.kind === "generic" ? (
        <Banner
          variant="danger"
          message="ERPNext stock discrepancies could not be loaded."
          requestId={error.requestId}
          action={
            <button type="button" className="btn-secondary" onClick={refetch}>
              Retry
            </button>
          }
        />
      ) : null}

      {isLoading ? <ListState state="loading" label="stores" /> : null}

      {!isLoading && !error && stores.length === 0 ? (
        <ListState state="empty" emptyMessage="No stores are available to you in this tenant." />
      ) : null}

      {!isLoading && !error && stores.length > 0 ? (
        <div className="table-scroll">
          <table className="data-table stock-table">
            <caption className="data-table__caption">Stores</caption>
            <thead>
              <tr>
                <th scope="col">Store</th>
                <th scope="col">ERPNext snapshot</th>
                <th scope="col">As of</th>
                <th scope="col">Negative items</th>
                <th scope="col">Snapshot request</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((row) => {
                const status = snapshotStatusLabel(row.snapshot.status);
                return (
                  <tr key={row.storeId} className="data-table__row">
                    <td>
                      <Link to={`/stock-discrepancies/${row.storeId}`}>{row.storeName}</Link>
                    </td>
                    <td className="nowrap">
                      <span className={status.badgeClass}>{status.label}</span>
                    </td>
                    <td>
                      {hasSnapshot(row.snapshot.status) && row.snapshot.readAt ? (
                        <time dateTime={row.snapshot.readAt}>{row.snapshot.readAt}</time>
                      ) : (
                        <span className="muted">{noSnapshotReason(row.snapshot.status)}</span>
                      )}
                    </td>
                    <td>{negativeCountLabel(row.snapshot.status, row.negativeItemCount)}</td>
                    <td>
                      {row.snapshot.pendingRequest ? (
                        <span className="badge badge--pending">Requested, awaiting Connector</span>
                      ) : (
                        <span className="muted">None</span>
                      )}
                    </td>
                  </tr>
                );
              })}
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
            {isFetchingNextPage ? "Loading…" : "Load more stores"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
