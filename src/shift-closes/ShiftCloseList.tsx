import { Banner } from "@/components/Banner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { ListState } from "@/components/ListState";
import { DateTime, Money, type T, useT } from "@/i18n";
import type { ShiftCloseSummary } from "@/lib/shift-close-queries";
/**
 * RT-18 — Shift closes with a cash variance (read-only). One row per recorded
 * close, newest first, keyset paged. "Exception" is non-zero variance only: the
 * query always carries the `min_abs_variance` floor, and the view never filters
 * loaded rows. Variance is the API's counted − expected, shown signed with a text
 * label and no colour for direction (UX-13). An approver is attribution only: it
 * never changes the variance shown. Times are in each row's store zone (UTC,
 * labelled, when the zone is unknown).
 *
 * A failed continuation keeps the loaded rows and offers an inline retry
 * (UX-10). A 404 is the API's uniform refusal and reads as unavailable, never
 * as an empty list. Filters live in the URL so Back from a detail restores them.
 */
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { ShiftCloseFilterBar } from "./ShiftCloseFilterBar";
import { ShiftScopePrompt } from "./ShiftScopePrompt";
import {
  type ShiftCloseFilters,
  buildListQuery,
  filtersFromSearch,
  filtersToSearch,
  validateFilters,
} from "./shiftCloseFilters";
import { closeKindKey, varianceDirectionKey } from "./shiftCloseLogic";
import {
  type ListGate,
  type ShiftCloseError,
  type ShiftCloseListState,
  type StoreDirectory,
  useShiftCloseList,
  useShiftCloseScope,
  useStoreDirectory,
} from "./useShiftCloses";
import "../shell/surface.css";
import "./shift-closes.css";

function shiftColumns(t: T, directory: StoreDirectory): DataTableColumn<ShiftCloseSummary>[] {
  return [
    {
      key: "store",
      header: t("shift.list.col.store"),
      cell: (s) => directory.nameOf(s.storeId) ?? t("shift.list.unknownStore"),
    },
    {
      key: "closedAt",
      header: t("shift.list.col.closedAt"),
      cell: (s) => <DateTime value={s.closedAt} timeZone={directory.timeZoneOf(s.storeId)} />,
    },
    {
      key: "kind",
      header: t("shift.list.col.kind"),
      cell: (s) => <span className="badge">{t(closeKindKey(s))}</span>,
    },
    {
      key: "expected",
      header: t("shift.list.col.expected"),
      cell: (s) => <Money value={s.expectedCash} currency={s.currencyCode} />,
    },
    {
      key: "counted",
      header: t("shift.list.col.counted"),
      cell: (s) => <Money value={s.countedCash} currency={s.currencyCode} />,
    },
    {
      key: "variance",
      header: t("shift.list.col.variance"),
      cell: (s) => (
        <span className="shift-variance">
          <Money signed value={s.variance} currency={s.currencyCode} />
          <small className="shift-variance__label">{t(varianceDirectionKey(s))}</small>
        </span>
      ),
    },
    {
      key: "approver",
      header: t("shift.list.col.approver"),
      cell: (s) =>
        s.varianceApprovedByUserId ? t("shift.approver.recorded") : t("shift.approver.none"),
    },
  ];
}

function ErrorView({
  error,
  onRetry,
}: Readonly<{ error: ShiftCloseError; onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  if (error.kind === "not-found") {
    return <ListState state="empty" emptyMessage={t("shift.list.unavailable")} />;
  }
  const retry = (
    <button type="button" className="btn-secondary" onClick={onRetry}>
      {t("shift.list.retry")}
    </button>
  );
  if (error.kind === "session") {
    return (
      <Banner
        variant="danger"
        message={t("shift.list.sessionExpired")}
        requestId={error.requestId}
      />
    );
  }
  if (error.kind === "rejected") {
    return (
      <Banner
        variant="warning"
        message={t("shift.list.filterRejected")}
        requestId={error.requestId}
        action={retry}
      />
    );
  }
  return (
    <Banner
      variant="danger"
      message={t("shift.list.loadFailed")}
      requestId={error.requestId}
      action={retry}
    />
  );
}

/** Loaded count, the inline continuation error, and Load more. */
function Pager({ list }: Readonly<{ list: ShiftCloseListState }>): React.JSX.Element {
  const t = useT();
  return (
    <>
      {list.inlineError ? (
        <Banner
          variant="danger"
          message={t("shift.list.inlineError")}
          requestId={list.inlineError.requestId}
          action={
            <button type="button" className="btn-secondary" onClick={list.retry}>
              {t("shift.list.retry")}
            </button>
          }
        />
      ) : null}
      <div className="shift-pager">
        <span className="shift-pager__count">
          {t("shift.list.loaded", { count: list.rows.length })}
        </span>
        {list.hasMore ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={list.loadMore}
            disabled={list.isFetchingNextPage}
          >
            {list.isFetchingNextPage ? <span className="spinner" aria-hidden="true" /> : null}
            {t("shift.list.loadMore")}
          </button>
        ) : null}
      </div>
    </>
  );
}

function isFiltered(filters: ShiftCloseFilters): boolean {
  return Object.values(filters).some((value) => value !== "");
}

interface ResultsProps {
  list: ShiftCloseListState;
  directory: StoreDirectory;
  filtered: boolean;
  onOpen: (row: ShiftCloseSummary) => void;
}

function Results({ list, directory, filtered, onOpen }: Readonly<ResultsProps>): React.JSX.Element {
  const t = useT();
  const columns = shiftColumns(t, directory);
  if (list.isLoading) {
    return (
      <DataTableSkeleton
        caption={t("shift.list.caption")}
        columns={columns}
        label={t("shift.list.loadingNoun")}
      />
    );
  }
  if (list.error) return <ErrorView error={list.error} onRetry={list.retry} />;
  if (list.rows.length === 0) {
    return (
      <ListState
        state="empty"
        emptyMessage={t(filtered ? "shift.list.emptyFiltered" : "shift.list.empty")}
        emptyHint={t(filtered ? "shift.list.emptyFilteredHint" : "shift.list.emptyHint")}
      />
    );
  }
  return (
    <>
      <DataTable
        caption={t("shift.list.caption")}
        columns={columns}
        rows={list.rows}
        rowKey={(s) => s.shiftId}
        onRowActivate={onOpen}
      />
      <Pager list={list} />
    </>
  );
}

function listGate(valid: boolean, waitingForZone: boolean): ListGate {
  if (!valid) return "block";
  return waitingForZone ? "wait" : "run";
}

export function ShiftCloseList(): React.JSX.Element {
  const t = useT();
  const scope = useShiftCloseScope();
  const [search, setSearch] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const directory = useStoreDirectory(scope.tenantId);

  const filters = filtersFromSearch(search);
  const errors = validateFilters(filters);
  const valid = Object.keys(errors).length === 0;
  // Dates are read in the selected store's zone, so wait for the roster that has it.
  const needsZone = Boolean(filters.storeId) && Boolean(filters.fromDate || filters.toDate);
  const zone = directory.timeZoneOf(filters.storeId) ?? "UTC";
  const gate = listGate(valid, needsZone && !directory.ready);
  const list = useShiftCloseList(scope, buildListQuery({ filters, timeZone: zone }), gate);

  if (!scope.tenantId) return <ShiftScopePrompt />;

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("shift.list.title")}</h1>
          <p className="content__sub">
            {t.rich("shift.list.sub", { tenant: <bdi>{scope.tenantName}</bdi> })}
          </p>
        </div>
      </header>
      <p className="content__sub">{t("shift.list.exceptionNote")}</p>

      <ShiftCloseFilterBar
        applied={filters}
        stores={directory.stores}
        initialErrors={errors}
        onApply={(next) => setSearch(filtersToSearch(next))}
        onClear={() => setSearch(new URLSearchParams())}
      />

      {valid ? (
        <Results
          list={list}
          directory={directory}
          filtered={isFiltered(filters)}
          onOpen={(row) =>
            navigate(`/shift-closes/${row.shiftId}`, { state: { list: location.search } })
          }
        />
      ) : null}
    </div>
  );
}
