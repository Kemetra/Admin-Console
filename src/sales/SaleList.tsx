import { Banner } from "@/components/Banner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { ListState } from "@/components/ListState";
import { DateTime, Money, type T, formatNumber, useLocale, useT } from "@/i18n";
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
import { useEffect, useRef } from "react";
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
import { canReadSales } from "./saleLogic";
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

/**
 * A result notice (empty, not available): the list-state look, announced as a
 * polite status message so a screen reader hears the outcome of a search.
 */
function Notice({
  message,
  hint,
}: Readonly<{ message: React.ReactNode; hint: string }>): React.JSX.Element {
  return (
    <output className="list-state list-state--empty">
      <span className="list-state__msg">{message}</span>
      <span className="list-state__hint">{hint}</span>
    </output>
  );
}

function Unavailable(): React.JSX.Element {
  const t = useT();
  return <Notice message={t("sales.list.unavailable")} hint={t("sales.list.unavailableHint")} />;
}

function ErrorView({
  error,
  onRetry,
}: Readonly<{ error: SaleError; onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  if (error.kind === "not-found") return <Unavailable />;
  if (error.kind === "session") {
    return (
      <Banner
        variant="danger"
        message={t("sales.list.sessionExpired")}
        requestId={error.requestId}
      />
    );
  }
  if (error.kind === "rejected") {
    // The same query would be rejected again: change the search instead.
    return (
      <Banner
        variant="warning"
        message={t("sales.list.filterRejected")}
        requestId={error.requestId}
      />
    );
  }
  return (
    <Banner
      variant="danger"
      message={t("sales.list.loadFailed")}
      requestId={error.requestId}
      action={
        <button type="button" className="btn-secondary" onClick={onRetry}>
          {t("sales.list.retry")}
        </button>
      }
    />
  );
}

/** A failed continuation: a refused cursor restarts the walk; anything else retries it. */
function InlineFailure({
  list,
  error,
}: Readonly<{ list: SaleListState; error: SaleError }>): React.JSX.Element {
  const t = useT();
  const restart = error.kind === "rejected";
  return (
    <Banner
      variant={restart ? "warning" : "danger"}
      message={t(restart ? "sales.list.cursorRejected" : "sales.list.inlineError")}
      requestId={error.requestId}
      action={
        <button
          type="button"
          className="btn-secondary"
          onClick={restart ? list.restart : list.retry}
        >
          {t(restart ? "sales.list.restart" : "sales.list.retry")}
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

/**
 * Load more unmounts when the last page arrives. If it was used, focus moves to
 * the end-of-list message so keyboard users are not dropped to the page start.
 */
function useEndFocus(list: SaleListState) {
  const endRef = useRef<HTMLOutputElement>(null);
  const pending = useRef(false);
  useEffect(() => {
    if (pending.current && list.ended && !list.hasMore) {
      pending.current = false;
      endRef.current?.focus();
    }
  }, [list.ended, list.hasMore]);
  const loadMore = () => {
    pending.current = true;
    list.loadMore();
  };
  return { endRef, loadMore };
}

/** Loaded count, the inline continuation error, Load more, and the end of the walk. */
function Pager({ list }: Readonly<{ list: SaleListState }>): React.JSX.Element {
  const t = useT();
  const locale = useLocale();
  const { endRef, loadMore } = useEndFocus(list);
  return (
    <>
      {list.inlineError ? <InlineFailure list={list} error={list.inlineError} /> : null}
      <div className="sale-pager">
        <output>
          {t.rich("sales.list.loaded", {
            count: <bdi dir="ltr">{formatNumber(list.rows.length, locale)}</bdi>,
          })}
        </output>
        {list.hasMore ? (
          // aria-disabled, not disabled: a disabled button drops keyboard focus
          // while the next page loads. loadMore ignores repeat presses.
          <button
            type="button"
            className="btn-secondary"
            onClick={loadMore}
            aria-disabled={list.isFetchingNextPage ? true : undefined}
            aria-busy={list.isFetchingNextPage ? true : undefined}
          >
            {list.isFetchingNextPage ? <span className="spinner" aria-hidden="true" /> : null}
            {t("sales.list.loadMore")}
          </button>
        ) : null}
        {list.ended ? (
          <output ref={endRef} tabIndex={-1}>
            {t("sales.list.ended")}
          </output>
        ) : null}
      </div>
    </>
  );
}

function Results({
  list,
  onOpen,
}: Readonly<{ list: SaleListState; onOpen: (row: SaleItem) => void }>): React.JSX.Element {
  const t = useT();
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
    const asOf = list.asOf ? <DateTime value={list.asOf} timeZone={list.storeTimezone} /> : "";
    return (
      <Notice message={t.rich("sales.list.empty", { asOf })} hint={t("sales.list.emptyHint")} />
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
  // A role the API refuses (store_staff) reads nothing: the server would answer
  // the same non-disclosing 404, so the form is not offered at all (AC-5).
  const permitted = canReadSales(scope.role);
  const directory = useStoreDirectory(permitted ? scope.tenantId : null);

  const filters = filtersFromSearch(search);
  const errors = validateFilters(filters);
  const valid = Object.keys(errors).length === 0;
  const ready = permitted && valid && isQueryReady(filters);
  const list = useSaleList(scope, ready ? buildListQuery(filters) : null);

  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("sales.list.scopePrompt")}</p>
      </div>
    );
  }
  if (!permitted) {
    return (
      <div className="surface">
        <h1 className="content__title">{t("sales.list.title")}</h1>
        <Unavailable />
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
