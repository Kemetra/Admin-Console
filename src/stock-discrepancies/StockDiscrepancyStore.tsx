import { BackArrow } from "@/components/BackArrow";
import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { type MessageKey, useT } from "@/i18n";
import type { NegativeOnHandItem, StockSnapshotStatus } from "@/lib/stock-discrepancy-queries";
import { ScopeMismatchBanner } from "@/shell/ScopeMismatchBanner";
/**
 * RT-178 — one store's ERPNext negative on-hand items. Header: the API's
 * snapshot block ("ERPNext snapshot as of {readAt}", stale / no_snapshot /
 * no_warehouse_mapping / pending states). Table: product name or a "Not mapped"
 * badge, ERPNext Item ref, warehouse, the signed `quantity` string EXACTLY as
 * the API sent it (never parsed or float-formatted), and stock UOM. Static
 * ERPNext Desk guidance; no acknowledge, no re_sync / re_map, no ERPNext call.
 * "Request fresh snapshot" (owner / tenant_admin only) calls the existing
 * `triggerReconciliationRun`. A 404 renders as not-found.
 * RT-399: the quantity stays the exact API string, LTR-isolated and tabular.
 */
import { useState } from "react";
import { Link, useParams } from "react-router";
import { SnapshotStatusPanel } from "./SnapshotStatusPanel";
import { InlineLoadError, LoadMoreButton, TenantScopePrompt, useDiscrepancyScope } from "./shared";
import {
  type TriggerOutcome,
  canRequestSnapshot,
  newSnapshotRequestKey,
  outcomeBannerView,
  refreshBlockReason,
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
  const t = useT();
  return (
    <Link to="/stock-discrepancies" className="surface__back">
      <BackArrow /> {t("stock.store.back")}
    </Link>
  );
}

function DeskGuidance(): React.JSX.Element {
  const t = useT();
  return (
    <aside className="desk-guidance" aria-label={t("stock.desk.label")}>
      <h2 className="desk-guidance__title">{t("stock.desk.title")}</h2>
      <ul>
        <li>{t("stock.desk.receipt")}</li>
        <li>{t("stock.desk.count")}</li>
        <li>{t("stock.desk.noBlindEntry")}</li>
      </ul>
      <p>{t("stock.desk.note")}</p>
    </aside>
  );
}

/**
 * Refresh state: one `triggerReconciliationRun` per click, with its outcome
 * kept for the banner. The Idempotency-Key is minted here, once per click, and
 * passed to the mutation. A thrown request maps to the generic error outcome.
 */
function useSnapshotRequest(storeId: string | undefined) {
  const request = useRequestSnapshot(storeId);
  const [outcome, setOutcome] = useState<TriggerOutcome | null>(null);

  async function requestSnapshot(): Promise<void> {
    setOutcome(null);
    try {
      setOutcome(await request.mutateAsync(newSnapshotRequestKey()));
    } catch {
      setOutcome({ kind: "error" });
    }
  }

  return { isPending: request.isPending, outcome, requestSnapshot };
}

interface RefreshButtonProps {
  isPending: boolean;
  /** Why the button is disabled (no mapping / request pending), or null. */
  blockReason: MessageKey | null;
  onRequest: () => void;
}

/** "Request fresh snapshot" (owner / tenant_admin only). */
function RefreshButton({
  isPending,
  blockReason,
  onRequest,
}: RefreshButtonProps): React.JSX.Element {
  const t = useT();
  return (
    <div className="refresh-action">
      <button
        type="button"
        className="btn-primary"
        onClick={onRequest}
        disabled={isPending || blockReason !== null}
      >
        {isPending ? t("stock.refresh.requesting") : t("stock.refresh.action")}
      </button>
      {blockReason ? <small className="muted">{t(blockReason)}</small> : null}
    </div>
  );
}

/** Shown after a later page came from a newer snapshot and the list reloaded. */
function SnapshotChangedNotice({ show }: { show: boolean }): React.JSX.Element | null {
  const t = useT();
  if (!show) return null;
  return <Banner variant="info" message={t("stock.store.snapshotChanged")} />;
}

function OutcomeBanner({ outcome }: { outcome: TriggerOutcome | null }): React.JSX.Element | null {
  const t = useT();
  const view = outcome ? outcomeBannerView(outcome) : null;
  if (!outcome || !view) return null;
  const requestId = "requestId" in outcome ? outcome.requestId : undefined;
  return <Banner variant={view.variant} message={t(view.messageKey)} requestId={requestId} />;
}

function ProductCell({ item }: { item: NegativeOnHandItem }): React.JSX.Element {
  const t = useT();
  if (item.tenantProduct && item.mappingStatus === "mapped") {
    return <td>{item.tenantProduct.name}</td>;
  }
  return (
    <td>
      <span className="badge badge--suspended" title={t("stock.items.notMappedTitle")}>
        {t("stock.items.notMapped")}
      </span>
    </td>
  );
}

function ItemRow({ item }: { item: NegativeOnHandItem }): React.JSX.Element {
  return (
    <tr className="data-table__row">
      <ProductCell item={item} />
      <td>
        <code className="mono" dir="ltr">
          {item.erpnextItemRef.name}
        </code>
      </td>
      <td className="mono">
        <bdi dir="ltr">{item.erpnextWarehouseRef}</bdi>
      </td>
      {/* Exact-decimal string from the API — rendered verbatim, sign included,
          LTR-isolated so the minus sign stays in front in an RTL table. */}
      <td className="num mono" data-testid="negative-quantity">
        <bdi dir="ltr">{item.quantity}</bdi>
      </td>
      <td>{item.stockUom}</td>
    </tr>
  );
}

function ItemsTable({ items }: { items: NegativeOnHandItem[] }): React.JSX.Element | null {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <div className="table-scroll">
      <table className="data-table stock-table">
        <caption className="data-table__caption">{t("stock.items.caption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("stock.items.col.product")}</th>
            <th scope="col">{t("stock.items.col.erpnextItem")}</th>
            <th scope="col">{t("stock.items.col.warehouse")}</th>
            <th scope="col" className="num">
              {t("stock.items.col.quantity")}
            </th>
            <th scope="col">{t("stock.items.col.uom")}</th>
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
  const t = useT();
  if (!statusView(snapshot.status).hasSnapshot || itemCount > 0) return null;
  return <ListState state="empty" emptyMessage={t("stock.items.empty")} />;
}

function StoreErrorView({ error }: { error: StockDiscrepancyError }): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      <BackLink />
      {error.kind === "not-found" ? (
        <>
          <h1 className="content__title">{t("stock.store.notFoundTitle")}</h1>
          <Banner
            variant="danger"
            message={t("stock.store.notFound")}
            requestId={error.requestId}
          />
        </>
      ) : (
        <Banner variant="danger" message={t("stock.loadFailed")} requestId={error.requestId} />
      )}
    </div>
  );
}

function LoadingView(): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      <ListState state="loading" label={t("stock.store.loadingNoun")} />
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
  const t = useT();
  const refresh = useSnapshotRequest(storeId);
  return (
    <div className="surface">
      <BackLink />
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("stock.title")}</h1>
          <p className="content__sub">{t("stock.store.sub")}</p>
        </div>
        {showRefresh ? (
          <RefreshButton
            isPending={refresh.isPending}
            blockReason={refreshBlockReason(snapshot)}
            onRequest={() => void refresh.requestSnapshot()}
          />
        ) : null}
      </header>
      <OutcomeBanner outcome={refresh.outcome} />
      <SnapshotChangedNotice show={data.snapshotChanged} />
      <SnapshotStatusPanel snapshot={snapshot} />
      <NoNegativeItems snapshot={snapshot} itemCount={data.items.length} />
      <ItemsTable items={data.items} />
      <InlineLoadError error={data.inlineError} onRetry={data.retryInline} />
      <LoadMoreButton
        hasMore={data.hasMore}
        isFetching={data.isFetchingNextPage}
        label={t("stock.store.loadMore")}
        onLoadMore={data.loadMore}
      />
      <DeskGuidance />
    </div>
  );
}

export function StockDiscrepancyStore(): React.JSX.Element {
  const { storeId } = useParams();
  return (
    <>
      {/* A deep link to another store's view never switches scope (RT-268). */}
      <ScopeMismatchBanner storeId={storeId} />
      <StoreBody storeId={storeId} />
    </>
  );
}

function StoreBody({ storeId }: { storeId: string | undefined }): React.JSX.Element {
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
