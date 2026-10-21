/**
 * RT-765 list results (CAT-C1a, RT-752 AC 4): the table, its loading skeleton,
 * the error views and the empty states. Completeness is honest: only
 * `items: []` with `nextCursor: null` is "no items"; a short or empty page with
 * a cursor shows the rows so far and Load more. A 400 is a validation message,
 * never an empty list, and offers no Retry: the same query would be rejected
 * again. A 404 with a store in scope is a stale store, never "no items".
 *
 * The columns follow UX-10: Item, Status and Price must survive; SKU, Barcode,
 * Category (and, with a store in scope, Store availability) are contextual; tax
 * category, tracking and updated-at are metadata, dropped first when narrow
 * (`catalog.css`). Every value is the server's: no price or availability is
 * computed here.
 */
import { Banner } from "@/components/Banner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { DateTime, Money, type T, useT } from "@/i18n";
import type { CatalogProduct } from "@/lib/catalog-queries";
import { Notice, Pager, StoreStale, Unavailable } from "./CatalogPager";
import { availabilityKey, statusKey, trackingKey } from "./catalogLogic";
import type { CatalogError, CatalogListState } from "./useCatalog";

/** A machine value (SKU, barcode, tax category): isolated LTR, "—" when absent. */
function Code({ value }: Readonly<{ value: string | null }>): React.JSX.Element {
  if (value === null) return <>—</>;
  return <bdi dir="ltr">{value}</bdi>;
}

/** The store's resolved price with a store in scope, else the tenant default. */
function Price({
  product,
  storeInScope,
}: Readonly<{ product: CatalogProduct; storeInScope: boolean }>): React.JSX.Element {
  const t = useT();
  // With a store in scope the price is the store's. A row without its storeView
  // (the contract always sends one) shows no price rather than the tenant's.
  if (storeInScope && !product.storeView) return <>—</>;
  const money = storeInScope ? product.storeView?.effectivePrice : product.defaultPrice;
  if (!money) return <>{t("catalog.value.noPrice")}</>;
  return <Money value={money.amount} currency={money.currencyCode} />;
}

function Availability({ product }: Readonly<{ product: CatalogProduct }>): React.JSX.Element {
  const t = useT();
  const view = product.storeView;
  if (!view) return <>—</>;
  return (
    <span className="catalog-chips">
      <span className="badge">{t(availabilityKey(view.effectiveActive))}</span>
      {view.hasOverride ? (
        <span className="badge">{t("catalog.availability.override")}</span>
      ) : null}
    </span>
  );
}

function catalogColumns(t: T, storeInScope: boolean): DataTableColumn<CatalogProduct>[] {
  const columns: DataTableColumn<CatalogProduct>[] = [
    {
      key: "item",
      header: t("catalog.list.col.item"),
      cell: (p) => (
        <bdi className="catalog-item" dir="auto">
          {p.name}
        </bdi>
      ),
    },
    {
      key: "status",
      header: t("catalog.list.col.status"),
      cell: (p) => <span className="badge">{t(statusKey(p.status))}</span>,
    },
    {
      key: "price",
      header: t("catalog.list.col.price"),
      cell: (p) => <Price product={p} storeInScope={storeInScope} />,
    },
    { key: "sku", header: t("catalog.list.col.sku"), cell: (p) => <Code value={p.primarySku} /> },
    {
      key: "barcode",
      header: t("catalog.list.col.barcode"),
      cell: (p) => <Code value={p.primaryBarcode} />,
    },
    {
      key: "category",
      header: t("catalog.list.col.category"),
      cell: (p) => p.categoryName ?? t("catalog.value.noCategory"),
    },
  ];
  if (storeInScope) {
    columns.push({
      key: "availability",
      header: t("catalog.list.col.availability"),
      cell: (p) => <Availability product={p} />,
    });
  }
  // Metadata comes last: `catalog.css` drops the last three columns first.
  columns.push(
    {
      key: "taxCategory",
      header: t("catalog.list.col.taxCategory"),
      cell: (p) => <Code value={p.taxCategory} />,
    },
    {
      key: "tracking",
      header: t("catalog.list.col.tracking"),
      cell: (p) => t(trackingKey(p.trackingMode)),
    },
    {
      key: "updatedAt",
      header: t("catalog.list.col.updatedAt"),
      cell: (p) => <DateTime value={p.updatedAt} />,
    },
  );
  return columns;
}

/** How each error kind is told. Only a generic failure can succeed on a retry. */
const ERROR_BANNERS = {
  generic: { variant: "danger", message: "catalog.list.loadFailed", retry: true },
  session: { variant: "danger", message: "catalog.list.sessionExpired", retry: false },
  rejected: { variant: "warning", message: "catalog.list.filterRejected", retry: false },
} as const;

function ErrorView({
  error,
  storeInScope,
  onRetry,
}: Readonly<{
  error: CatalogError;
  storeInScope: boolean;
  onRetry: () => void;
}>): React.JSX.Element {
  const t = useT();
  if (error.kind === "not-found") return storeInScope ? <StoreStale /> : <Unavailable />;
  const banner = ERROR_BANNERS[error.kind];
  return (
    <Banner
      variant={banner.variant}
      message={t(banner.message)}
      requestId={error.requestId}
      action={
        banner.retry ? (
          <button type="button" className="btn-secondary" onClick={onRetry}>
            {t("catalog.list.retry")}
          </button>
        ) : undefined
      }
    />
  );
}

function EmptyNotice({
  filtered,
  summary,
  onClear,
}: Readonly<{
  filtered: boolean;
  summary: React.ReactNode;
  onClear: () => void;
}>): React.JSX.Element {
  const t = useT();
  if (!filtered) {
    // No create control: creating an item is its own slice, and waits on an owner decision (RT-752 D9).
    return <Notice message={t("catalog.list.empty")} hint={t("catalog.list.emptyHint")} />;
  }
  return (
    <Notice
      message={t.rich("catalog.list.emptyFiltered", { filters: summary })}
      hint={t("catalog.list.emptyFilteredHint")}
      action={
        <button type="button" className="btn-secondary" onClick={onClear}>
          {t("catalog.list.clearFilters")}
        </button>
      }
    />
  );
}

export interface CatalogResultsProps {
  list: CatalogListState;
  /** A store is in scope: the list was requested with `store_id`. */
  storeInScope: boolean;
  /** The applied filters differ from the default: an empty walk is a filtered one. */
  filtered: boolean;
  /** The applied filters in words, for the filtered-empty message. */
  summary: React.ReactNode;
  /** The search text is set: exact code matches are listed first (stated in the caption). */
  searching: boolean;
  onOpen: (row: CatalogProduct) => void;
  onClearFilters: () => void;
}

/** Only `items: []` with `nextCursor: null` is "no items". */
function isEmptyWalk(list: CatalogListState): boolean {
  return list.rows.length === 0 && list.ended;
}

export function Results({
  list,
  storeInScope,
  filtered,
  summary,
  searching,
  onOpen,
  onClearFilters,
}: Readonly<CatalogResultsProps>): React.JSX.Element {
  const t = useT();
  const columns = catalogColumns(t, storeInScope);
  const caption = t(searching ? "catalog.list.captionSearch" : "catalog.list.caption");
  if (list.isLoading) {
    return (
      <div className="catalog-table">
        <DataTableSkeleton
          caption={caption}
          columns={columns}
          label={t("catalog.list.loadingNoun")}
        />
      </div>
    );
  }
  if (list.error) {
    return <ErrorView error={list.error} storeInScope={storeInScope} onRetry={list.retry} />;
  }
  if (isEmptyWalk(list)) {
    return <EmptyNotice filtered={filtered} summary={summary} onClear={onClearFilters} />;
  }
  return (
    <>
      {list.rows.length > 0 ? (
        <div className="catalog-table">
          <DataTable
            caption={caption}
            columns={columns}
            rows={list.rows}
            rowKey={(p) => p.productId}
            onRowActivate={onOpen}
          />
        </div>
      ) : (
        <output className="catalog-partial">{t("catalog.list.partialPage")}</output>
      )}
      <Pager list={list} storeInScope={storeInScope} />
    </>
  );
}
