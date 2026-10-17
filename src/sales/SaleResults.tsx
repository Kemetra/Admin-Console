/**
 * RT-587 list results (spec 012 J1, §8): the table, its loading skeleton, the
 * error views and the empty state. Completeness is honest: every page says
 * "received by the server up to {asOf}", and the empty state is only
 * `items: []` with `nextCursor: null`. A short or empty page with a cursor
 * shows the rows so far (none, if empty) and Load more. A 400 is a validation
 * message, never an empty list, and offers no Retry: the same query would be
 * rejected again.
 */
import { Banner } from "@/components/Banner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { DateTime, Money, type T, useT } from "@/i18n";
import type { SaleItem } from "@/lib/sale-queries";
import { Notice, Pager, Unavailable } from "./SalePager";
import { BusinessDate, DeviceName, RecordedName, SaleNumber, StatusChips } from "./SaleParts";
import type { SaleError, SaleListState } from "./useSales";

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

const ERROR_MESSAGES = {
  session: "sales.list.sessionExpired",
  rejected: "sales.list.filterRejected",
} as const;

function ErrorView({
  error,
  onRetry,
}: Readonly<{ error: SaleError; onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  if (error.kind === "not-found") return <Unavailable />;
  if (error.kind === "generic") {
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
  // An expired session or a rejected query: retrying the same request cannot succeed.
  return (
    <Banner
      variant={error.kind === "rejected" ? "warning" : "danger"}
      message={t(ERROR_MESSAGES[error.kind])}
      requestId={error.requestId}
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

function EmptyNotice({ list }: Readonly<{ list: SaleListState }>): React.JSX.Element {
  const t = useT();
  const asOf = list.asOf ? <DateTime value={list.asOf} timeZone={list.storeTimezone} /> : "";
  return <Notice message={t.rich("sales.list.empty", { asOf })} hint={t("sales.list.emptyHint")} />;
}

/** Only `items: []` with `nextCursor: null` is "no sales" (AC-13). */
function isEmptyWalk(list: SaleListState): boolean {
  return list.rows.length === 0 && list.ended;
}

function Loaded({
  list,
  columns,
  onOpen,
}: Readonly<{
  list: SaleListState;
  columns: DataTableColumn<SaleItem>[];
  onOpen: (row: SaleItem) => void;
}>): React.JSX.Element {
  const t = useT();
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

export function Results({
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
  if (isEmptyWalk(list)) return <EmptyNotice list={list} />;
  return <Loaded list={list} columns={columns} onOpen={onOpen} />;
}

export function QueryPrompt(): React.JSX.Element {
  const t = useT();
  return <Notice message={t("sales.list.queryPrompt")} hint={t("sales.list.queryPromptHint")} />;
}
