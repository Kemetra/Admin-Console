/**
 * RT-726 — Sales needing repair (`consoleListNeedsRepair`), for owner /
 * tenant_admin. The server's open NEEDS_REPAIR queue, newest first, keyset
 * paged with a deliberate Load more; a failed continuation keeps the loaded
 * rows. Read-only: each row links to the sale, whose page carries the guarded
 * repair request. There is no bulk or "repair all" action here.
 *
 * Gate first: any other role gets NoAccess and nothing is requested. The
 * optional store filter lives in the URL (`?store=`), offers only the caller's
 * in-scope stores and is a filter, not a scope change. An out-of-scope or
 * malformed store reads as not available (the API's non-disclosing 404).
 */
import { NoAccess } from "@/auth/NoAccess";
import { Banner } from "@/components/Banner";
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { ListState } from "@/components/ListState";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { DateTime, type T, useT } from "@/i18n";
import type { NeedsRepairItem } from "@/lib/sale-sync-ops-queries";
import { type SaleScope, useSaleScope } from "@/sales/useSales";
import { type ScopeMembership, scopeMenuStores } from "@/shell/scope-stores";
import { useSignOut } from "@/shell/useSignOut";
import { useStoreList } from "@/stores/useStoreQueries";
import { Link, useSearchParams } from "react-router";
import { Machine, ReadError, StaleError } from "./parts";
import { canUseSaleSyncOps, isStoreFilter } from "./saleSyncLogic";
import { type NeedsRepairState, useNeedsRepairList } from "./useSaleSync";
import "../shell/surface.css";
import "./sale-sync.css";

interface FilterStore {
  id: string;
  name?: string;
}

/** The caller's in-scope stores (the scope menu's own rule, RT-354). */
function useFilterStores(tenantId: string | null): FilterStore[] {
  const { context } = useActiveContextValue();
  const { result } = useStoreList(tenantId);
  const rows = result?.kind === "rows" ? result.rows : [];
  const membership = context?.memberships?.find((m) => m.tenant_id === tenantId) as
    | ScopeMembership
    | undefined;
  return scopeMenuStores(rows, membership, null).map((s) => ({ id: s.id, name: s.name }));
}

function StoreFilter({
  stores,
  value,
  onChange,
}: Readonly<{
  stores: readonly FilterStore[];
  value: string;
  onChange: (storeId: string) => void;
}>): React.JSX.Element {
  const t = useT();
  // A URL store the roster does not list stays selectable, so its 404 is visible.
  const listed = value && !stores.some((s) => s.id === value) ? [...stores, { id: value }] : stores;
  return (
    <div className="sale-sync__filter">
      <label htmlFor="needs-repair-store">{t("saleSync.filter.store")}</label>
      <select
        id="needs-repair-store"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t("saleSync.filter.allStores")}</option>
        {listed.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name ?? store.id}
          </option>
        ))}
      </select>
    </div>
  );
}

function headers(t: T): { key: string; header: string }[] {
  return [
    { key: "externalId", header: t("saleSync.col.externalId") },
    { key: "store", header: t("saleSync.col.store") },
    { key: "source", header: t("saleSync.col.source") },
    { key: "reason", header: t("saleSync.col.reason") },
    { key: "retries", header: t("saleSync.col.retries") },
    { key: "quarantinedAt", header: t("saleSync.col.quarantinedAt") },
  ];
}

function Row({
  item,
  storeName,
}: Readonly<{ item: NeedsRepairItem; storeName?: string }>): React.JSX.Element {
  const t = useT();
  return (
    <tr className="data-table__row data-table__row--static">
      <th scope="row">
        <Link
          to={`/sales/${item.saleRef}`}
          aria-label={t("saleSync.list.openSale", { ref: item.externalId })}
        >
          <Machine value={item.externalId} />
        </Link>
      </th>
      <td>{storeName ? <bdi dir="auto">{storeName}</bdi> : t("saleSync.list.unknownStore")}</td>
      <td>
        <Machine value={item.sourceSystem} />
      </td>
      <td>
        <Machine value={item.reasonCode} />
      </td>
      <td className="sale-amount">
        {item.retryCount ?? <span className="muted">{t("saleSync.value.notRecorded")}</span>}
      </td>
      <td>
        <DateTime value={item.quarantinedAt} />
      </td>
    </tr>
  );
}

function Rows({
  list,
  filtered,
  nameOf,
}: Readonly<{
  list: NeedsRepairState;
  filtered: boolean;
  nameOf: (id: string) => string | undefined;
}>): React.JSX.Element {
  const t = useT();
  const columns = headers(t);
  const caption = t("saleSync.list.caption");
  if (list.isLoading) {
    return (
      <DataTableSkeleton
        caption={caption}
        columns={columns}
        label={t("saleSync.list.loadingNoun")}
      />
    );
  }
  if (list.error) {
    return (
      <ReadError
        error={list.error}
        failedKey="saleSync.list.loadFailed"
        notFoundKey="saleSync.list.storeNotFound"
        onRetry={list.retry}
      />
    );
  }
  if (list.rows.length === 0 && !list.hasMore) {
    return (
      <>
        <ListState
          state="empty"
          emptyMessage={t(filtered ? "saleSync.list.emptyStore" : "saleSync.list.empty")}
        />
        <p className="content__sub">{t("saleSync.list.emptyHint")}</p>
      </>
    );
  }
  return (
    <>
      <div className="table-scroll">
        <table className="data-table">
          <caption className="data-table__caption">{caption}</caption>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} scope="col">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.rows.map((item) => (
              <Row key={item.saleRef} item={item} storeName={nameOf(item.storeId)} />
            ))}
          </tbody>
        </table>
      </div>
      {/* A failed continuation keeps the rows above and retries at the boundary. */}
      <StaleError error={list.inlineError} onRetry={list.retry} />
      {list.hasMore ? (
        <div>
          <button
            type="button"
            className="btn-secondary"
            onClick={list.loadMore}
            disabled={list.isFetchingNextPage}
          >
            {list.isFetchingNextPage ? <span className="spinner" aria-hidden="true" /> : null}
            {t("saleSync.list.loadMore")}
          </button>
        </div>
      ) : null}
    </>
  );
}

function Content({ scope }: Readonly<{ scope: SaleScope }>): React.JSX.Element {
  const t = useT();
  const [search, setSearch] = useSearchParams();
  const storeId = search.get("store") ?? "";
  const stores = useFilterStores(scope.tenantId);
  const validStore = isStoreFilter(storeId);
  const list = useNeedsRepairList({ scope, storeId, enabled: validStore });
  const nameOf = (id: string) => stores.find((s) => s.id === id)?.name;

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("saleSync.list.title")}</h1>
          <p className="content__sub">
            {t.rich("saleSync.list.sub", { tenant: <bdi>{scope.tenantName}</bdi> })}
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={list.refresh}
          disabled={!validStore}
        >
          {t("saleSync.list.refresh")}
        </button>
      </header>
      <p className="sale-sync__note">{t("saleSync.list.note")}</p>
      <StoreFilter
        stores={stores}
        value={storeId}
        onChange={(next) => setSearch(next ? new URLSearchParams({ store: next }) : {})}
      />
      {validStore ? (
        <Rows list={list} filtered={storeId !== ""} nameOf={nameOf} />
      ) : (
        // A malformed store filter is never sent: it reads as not available.
        <Banner variant="warning" message={t("saleSync.list.storeNotFound")} />
      )}
      {list.asOf ? (
        <p className="sale-sync__asof">
          {t.rich("saleSync.list.asOf", {
            time: <DateTime value={new Date(list.asOf).toISOString()} />,
          })}
        </p>
      ) : null}
    </div>
  );
}

export function NeedsRepairList(): React.JSX.Element {
  const t = useT();
  const scope = useSaleScope();
  const signOut = useSignOut();
  if (!canUseSaleSyncOps(scope.role)) return <NoAccess onSignOut={signOut} />;
  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("saleSync.list.scopePrompt")}</p>
      </div>
    );
  }
  return <Content scope={scope} />;
}
