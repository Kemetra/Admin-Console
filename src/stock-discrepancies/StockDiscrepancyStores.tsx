import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import type { StoreNegativeOnHandSummary } from "@/lib/stock-discrepancy-queries";
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
import { LoadMoreButton, TenantScopePrompt, useDiscrepancyScope } from "./shared";
import { asOfTime, negativeCountLabel, statusView } from "./stockDiscrepancyLogic";
import { type StockDiscrepancyError, useNegativeOnHandStores } from "./useStockDiscrepancies";
import "../shell/surface.css";
import "./stock-discrepancies.css";

type StoresData = ReturnType<typeof useNegativeOnHandStores>;

function StoresHeader(): React.JSX.Element {
  return (
    <header className="surface__head">
      <div>
        <h1 className="content__title">ERPNext stock discrepancies</h1>
        <p className="content__sub">
          Items with negative on-hand quantity in each store's latest recorded ERPNext snapshot.
          Read-only; resolve the cause in ERPNext Desk.
        </p>
      </div>
    </header>
  );
}

function StoresErrorBanner({
  error,
  onRetry,
}: { error: StockDiscrepancyError; onRetry: () => void }): React.JSX.Element {
  if (error.kind === "not-found") {
    return (
      <Banner
        variant="danger"
        message="Not found. ERPNext stock discrepancies are not available to you in this tenant."
        requestId={error.requestId}
      />
    );
  }
  return (
    <Banner
      variant="danger"
      message="ERPNext stock discrepancies could not be loaded."
      requestId={error.requestId}
      action={
        <button type="button" className="btn-secondary" onClick={onRetry}>
          Retry
        </button>
      }
    />
  );
}

function AsOfCell({ row }: { row: StoreNegativeOnHandSummary }): React.JSX.Element {
  const asOf = asOfTime(row.snapshot);
  return (
    <td>
      {asOf ? (
        <time dateTime={asOf}>{asOf}</time>
      ) : (
        <span className="muted">{statusView(row.snapshot.status).noSnapshotReason}</span>
      )}
    </td>
  );
}

function PendingCell({ row }: { row: StoreNegativeOnHandSummary }): React.JSX.Element {
  return (
    <td>
      {row.snapshot.pendingRequest ? (
        <span className="badge badge--pending">Requested, awaiting Connector</span>
      ) : (
        <span className="muted">None</span>
      )}
    </td>
  );
}

function StoreRow({ row }: { row: StoreNegativeOnHandSummary }): React.JSX.Element {
  const view = statusView(row.snapshot.status);
  return (
    <tr className="data-table__row">
      <td>
        <Link to={`/stock-discrepancies/${row.storeId}`}>{row.storeName}</Link>
      </td>
      <td className="nowrap">
        <span className={view.badgeClass}>{view.label}</span>
      </td>
      <AsOfCell row={row} />
      <td>{negativeCountLabel(row.snapshot.status, row.negativeItemCount)}</td>
      <PendingCell row={row} />
    </tr>
  );
}

function StoresTable({ stores }: { stores: StoreNegativeOnHandSummary[] }): React.JSX.Element {
  return (
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
          {stores.map((row) => (
            <StoreRow key={row.storeId} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Loading, error, empty, or the table — exactly one of them. */
function StoresBody({ data }: { data: StoresData }): React.JSX.Element {
  if (data.error) return <StoresErrorBanner error={data.error} onRetry={data.refetch} />;
  if (data.isLoading) return <ListState state="loading" label="stores" />;
  if (data.stores.length === 0) {
    return (
      <ListState state="empty" emptyMessage="No stores are available to you in this tenant." />
    );
  }
  return <StoresTable stores={data.stores} />;
}

export function StockDiscrepancyStores(): React.JSX.Element {
  const { scope } = useDiscrepancyScope();
  const data = useNegativeOnHandStores(scope);

  if (!scope.tenantId) return <TenantScopePrompt />;
  return (
    <div className="surface">
      <StoresHeader />
      <StoresBody data={data} />
      <LoadMoreButton
        hasMore={data.hasMore}
        isFetching={data.isFetchingNextPage}
        label="Load more stores"
        onLoadMore={data.loadMore}
      />
    </div>
  );
}
