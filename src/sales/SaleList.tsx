import { Banner } from "@/components/Banner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { ListState } from "@/components/ListState";
import { DateTime, Money, type T, formatDateTime, useLocale, useT } from "@/i18n";
import type { SaleItem } from "@/lib/sale-queries";
import { useStoreDirectory } from "@/shift-closes/useShiftCloses";
/**
 * RT-587 — Sales search (spec 012 J1, read-only). One store's received sales
 * over an inclusive business-date range, newest first, keyset paged. Nothing
 * is read until a store and both dates are set (FR-004).
 *
 * Completeness is honest (G3, AC-13): every page says "received by the server
 * up to {asOf}". The empty state is only `items: []` with `nextCursor: null`;
 * a short or empty page with a cursor offers Load more and says nothing about
 * the end, because the server may bound the rows one request examines. A 404
 * is the one non-disclosing refusal (it never says whether the store exists),
 * and a 400 is a validation message, never an empty list. Times are in the
 * store zone the server reports. Filters live in the URL (FR-007).
 */
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { SaleFilterBar } from "./SaleFilterBar";
import { BusinessDate, DeviceName, RecordedName, SaleNumber, StatusChips } from "./SaleParts";
import {
  buildListQuery,
  filtersFromSearch,
  filtersToSearch,
  isQueryReady,
  validateFilters,
} from "./saleFilters";
import { type SaleError, type SaleListState, useSaleList, useSaleScope } from "./useSales";
import "../shell/surface.css";
import "./sales.css";

function saleColumns(t: T, timeZone: string | undefined): DataTableColumn<SaleItem>[] {
  return [
    {
      key: "saleNumber",
      header: t("sales.list.col.saleNumber"),
      cell: (s) => <SaleNumber value={s.saleNumber} />,
    },
    {
      key: "businessDate",
      header: t("sales.list.col.businessDate"),
      cell: (s) => <BusinessDate value={s.businessDate} />,
    },
    {
      key: "occurredAt",
      header: t("sales.list.col.occurredAt"),
      cell: (s) => <DateTime value={s.occurredAt} timeZone={timeZone} />,
    },
    {
      key: "device",
      header: t("sales.list.col.device"),
      cell: (s) => <DeviceName device={s.device} />,
    },
    {
      key: "operator",
      header: t("sales.list.col.operator"),
      cell: (s) => <RecordedName name={s.operator.displayName} source={s.operator.nameSource} />,
    },
    {
      key: "total",
      header: t("sales.list.col.total"),
      cell: (s) => <Money value={s.posTotal} currency={s.currencyCode} />,
    },
    {
      key: "status",
      header: t("sales.list.col.status"),
      cell: (s) => <StatusChips sale={s} />,
    },
  ];
}

function ErrorView({
  error,
  onRetry,
}: Readonly<{ error: SaleError; onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  if (error.kind === "not-found") {
    return (
      <ListState
        state="empty"
        emptyMessage={t("sales.list.unavailable")}
        emptyHint={t("sales.list.unavailableHint")}
      />
    );
  }
  if (error.kind === "session") {
    return (
      <Banner
        variant="danger"
        message={t("sales.list.sessionExpired")}
        requestId={error.requestId}
      />
    );
  }
  const rejected = error.kind === "rejected";
  return (
    <Banner
      variant={rejected ? "warning" : "danger"}
      message={t(rejected ? "sales.list.filterRejected" : "sales.list.loadFailed")}
      requestId={error.requestId}
      action={
        <button type="button" className="btn-secondary" onClick={onRetry}>
          {t("sales.list.retry")}
        </button>
      }
    />
  );
}

/** "Received by the server up to {asOf}" and the zone times are shown in. */
function Freshness({ list }: Readonly<{ list: SaleListState }>): React.JSX.Element | null {
  const t = useT();
  if (!list.asOf) return null;
  return (
    <div className="sale-freshness">
      <p className="content__sub">
        {t.rich("sales.list.asOf", {
          asOf: <DateTime value={list.asOf} timeZone={list.storeTimezone} />,
        })}
      </p>
      {list.storeTimezone ? (
        <p className="content__sub">
          {t.rich("sales.list.zoneNote", { zone: <bdi dir="ltr">{list.storeTimezone}</bdi> })}
        </p>
      ) : null}
    </div>
  );
}

/** Loaded count, the inline continuation error, Load more, and the end of the walk. */
function Pager({ list }: Readonly<{ list: SaleListState }>): React.JSX.Element {
  const t = useT();
  return (
    <>
      {list.inlineError ? (
        <Banner
          variant="danger"
          message={t("sales.list.inlineError")}
          requestId={list.inlineError.requestId}
          action={
            <button type="button" className="btn-secondary" onClick={list.retry}>
              {t("sales.list.retry")}
            </button>
          }
        />
      ) : null}
      <div className="sale-pager">
        <span>{t("sales.list.loaded", { count: list.rows.length })}</span>
        {list.hasMore ? (
          // aria-disabled, not disabled: a disabled button drops keyboard focus
          // while the next page loads. loadMore ignores repeat presses.
          <button
            type="button"
            className="btn-secondary"
            onClick={list.loadMore}
            aria-disabled={list.isFetchingNextPage ? true : undefined}
            aria-busy={list.isFetchingNextPage ? true : undefined}
          >
            {list.isFetchingNextPage ? <span className="spinner" aria-hidden="true" /> : null}
            {t("sales.list.loadMore")}
          </button>
        ) : null}
        {list.ended ? <output>{t("sales.list.ended")}</output> : null}
      </div>
    </>
  );
}

function Results({
  list,
  onOpen,
}: Readonly<{ list: SaleListState; onOpen: (row: SaleItem) => void }>): React.JSX.Element {
  const t = useT();
  const locale = useLocale();
  const columns = saleColumns(t, list.storeTimezone);
  if (list.isLoading) {
    return (
      <DataTableSkeleton
        caption={t("sales.list.caption")}
        columns={columns}
        label={t("sales.list.loadingNoun")}
      />
    );
  }
  if (list.error) return <ErrorView error={list.error} onRetry={list.retry} />;
  if (list.rows.length === 0 && list.ended) {
    const asOf = list.asOf
      ? formatDateTime(list.asOf, { timeZone: list.storeTimezone, locale })
      : "";
    return (
      <ListState
        state="empty"
        emptyMessage={t("sales.list.empty", { asOf })}
        emptyHint={t("sales.list.emptyHint")}
      />
    );
  }
  return (
    <>
      <Freshness list={list} />
      {list.rows.length > 0 ? (
        <DataTable
          caption={t("sales.list.caption")}
          columns={columns}
          rows={list.rows}
          rowKey={(s) => s.saleRef}
          onRowActivate={onOpen}
        />
      ) : (
        <output className="sale-partial">{t("sales.list.partialPage")}</output>
      )}
      <Pager list={list} />
    </>
  );
}

function QueryPrompt(): React.JSX.Element {
  const t = useT();
  return (
    <ListState
      state="empty"
      emptyMessage={t("sales.list.queryPrompt")}
      emptyHint={t("sales.list.queryPromptHint")}
    />
  );
}

export function SaleList(): React.JSX.Element {
  const t = useT();
  const scope = useSaleScope();
  const [search, setSearch] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const directory = useStoreDirectory(scope.tenantId);

  const filters = filtersFromSearch(search);
  const errors = validateFilters(filters);
  const valid = Object.keys(errors).length === 0;
  const ready = valid && isQueryReady(filters);
  const list = useSaleList(scope, ready ? buildListQuery(filters) : null);

  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("sales.list.scopePrompt")}</p>
      </div>
    );
  }

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("sales.list.title")}</h1>
          <p className="content__sub">
            {t.rich("sales.list.sub", { tenant: <bdi>{scope.tenantName}</bdi> })}
          </p>
        </div>
      </header>

      <SaleFilterBar
        applied={filters}
        stores={directory.stores}
        activeStoreId={scope.activeStoreId}
        initialErrors={errors}
        onApply={(next) => setSearch(filtersToSearch(next))}
        onClear={() => setSearch(new URLSearchParams())}
      />

      {ready ? (
        <Results
          list={list}
          onOpen={(row) => navigate(`/sales/${row.saleRef}`, { state: { list: location.search } })}
        />
      ) : null}
      {valid && !ready ? <QueryPrompt /> : null}
    </div>
  );
}
