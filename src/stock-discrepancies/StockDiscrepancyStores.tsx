import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { DateTime, useT } from "@/i18n";
import type { StoreNegativeOnHandSummary } from "@/lib/stock-discrepancy-queries";
/**
 * RT-178 — ERPNext stock discrepancies, store summary list. One row per store
 * the API returns for the caller (owner / tenant_admin: their membership's
 * stores; store_manager: its scoped stores — the list is exactly what the API
 * returns, never filtered or widened here). Each row shows the API's snapshot
 * status, the "as of" time when a snapshot exists, and the negative item count;
 * `no_snapshot` / `no_warehouse_mapping` read "Unknown", never "0 issues".
 * A 404 (role not allowed) renders as not-found. Each store's "as of" time is
 * an operational instant (`<DateTime>`, UTC-labelled until RT-401).
 */
import { Link } from "react-router";
import { InlineLoadError, LoadMoreButton, TenantScopePrompt, useDiscrepancyScope } from "./shared";
import { asOfTime, negativeCountLabel, statusView } from "./stockDiscrepancyLogic";
import { type StockDiscrepancyError, useNegativeOnHandStores } from "./useStockDiscrepancies";
import "../shell/surface.css";
import "./stock-discrepancies.css";

type StoresData = ReturnType<typeof useNegativeOnHandStores>;

function StoresHeader(): React.JSX.Element {
  const t = useT();
  return (
    <header className="surface__head">
      <div>
        <h1 className="content__title">{t("stock.title")}</h1>
        <p className="content__sub">{t("stock.stores.sub")}</p>
      </div>
    </header>
  );
}

function StoresErrorBanner({
  error,
  onRetry,
}: Readonly<{ error: StockDiscrepancyError; onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  if (error.kind === "not-found") {
    return (
      <Banner variant="danger" message={t("stock.stores.notFound")} requestId={error.requestId} />
    );
  }
  return (
    <Banner
      variant="danger"
      message={t("stock.loadFailed")}
      requestId={error.requestId}
      action={
        <button type="button" className="btn-secondary" onClick={onRetry}>
          {t("stock.retry")}
        </button>
      }
    />
  );
}

function AsOfCell({ row }: Readonly<{ row: StoreNegativeOnHandSummary }>): React.JSX.Element {
  const t = useT();
  const asOf = asOfTime(row.snapshot);
  const reasonKey = statusView(row.snapshot.status).noSnapshotReasonKey;
  return (
    <td>
      {asOf ? (
        <DateTime value={asOf} />
      ) : (
        <span className="muted">{reasonKey ? t(reasonKey) : null}</span>
      )}
    </td>
  );
}

function PendingCell({ row }: Readonly<{ row: StoreNegativeOnHandSummary }>): React.JSX.Element {
  const t = useT();
  return (
    <td>
      {row.snapshot.pendingRequest ? (
        <span className="badge badge--pending">{t("stock.stores.pending")}</span>
      ) : (
        <span className="muted">{t("stock.stores.noPending")}</span>
      )}
    </td>
  );
}

function StoreRow({ row }: Readonly<{ row: StoreNegativeOnHandSummary }>): React.JSX.Element {
  const t = useT();
  const view = statusView(row.snapshot.status);
  const count = negativeCountLabel(row.snapshot.status, row.negativeItemCount);
  return (
    <tr className="data-table__row">
      <td>
        <Link to={`/stock-discrepancies/${row.storeId}`}>{row.storeName}</Link>
      </td>
      <td className="nowrap">
        <span className={view.badgeClass}>{t(view.labelKey)}</span>
      </td>
      <AsOfCell row={row} />
      <td>{t(count.key, count.params)}</td>
      <PendingCell row={row} />
    </tr>
  );
}

function StoresTable({
  stores,
}: Readonly<{ stores: StoreNegativeOnHandSummary[] }>): React.JSX.Element {
  const t = useT();
  return (
    <div className="table-scroll">
      <table className="data-table stock-table">
        <caption className="data-table__caption">{t("stock.stores.caption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("stock.stores.col.store")}</th>
            <th scope="col">{t("stock.stores.col.snapshot")}</th>
            <th scope="col">{t("stock.stores.col.asOf")}</th>
            <th scope="col">{t("stock.stores.col.negativeItems")}</th>
            <th scope="col">{t("stock.stores.col.request")}</th>
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
function StoresBody({ data }: Readonly<{ data: StoresData }>): React.JSX.Element {
  const t = useT();
  if (data.error) return <StoresErrorBanner error={data.error} onRetry={data.refetch} />;
  if (data.isLoading) return <ListState state="loading" label={t("stock.stores.loadingNoun")} />;
  if (data.stores.length === 0) {
    return <ListState state="empty" emptyMessage={t("stock.stores.empty")} />;
  }
  return <StoresTable stores={data.stores} />;
}

export function StockDiscrepancyStores(): React.JSX.Element {
  const t = useT();
  const { scope } = useDiscrepancyScope();
  const data = useNegativeOnHandStores(scope);

  if (!scope.tenantId) return <TenantScopePrompt />;
  return (
    <div className="surface">
      <StoresHeader />
      <StoresBody data={data} />
      <InlineLoadError error={data.inlineError} onRetry={data.retryInline} />
      <LoadMoreButton
        hasMore={data.hasMore}
        isFetching={data.isFetchingNextPage}
        label={t("stock.stores.loadMore")}
        onLoadMore={data.loadMore}
      />
    </div>
  );
}
