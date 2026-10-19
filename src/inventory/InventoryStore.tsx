/**
 * RT-728 — one store's inventory: its stock locations (`listStockLocations`,
 * primary first) and its movement ledger (`listStockMovements` with
 * `scope=all`: every movement of the store, newest first, keyset paged with a
 * deliberate Load more; a failed continuation keeps the loaded rows).
 *
 * A movement with a product links to that product's on-hand at this store; an
 * ad-hoc (null-product) movement has no link. There is no free-text product
 * entry. Quantities are the API's exact strings. Read-only: no movement,
 * transfer or count is written from here. ERPNext book stock is not shown (it
 * stays on the stock-discrepancy view). A store outside the caller's scope is
 * the API's non-disclosing 404 and reads as not available.
 */
import { NoAccess } from "@/auth/NoAccess";
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { ListState } from "@/components/ListState";
import { DateTime, type T, useT } from "@/i18n";
import type { StockLocation, StockMovement } from "@/lib/inventory-queries";
import { ScopeMismatchBanner } from "@/shell/ScopeMismatchBanner";
import { useSignOut } from "@/shell/useSignOut";
import { useStoreList } from "@/stores/useStoreQueries";
import { Link, useParams } from "react-router";
import {
  canReadInventory,
  integrationStateKey,
  inventoryStatusKey,
  isUuid,
  locationKindKey,
  locationLabel,
  movementProductId,
  movementTypeKey,
} from "./inventoryLogic";
import { BackLink, LoadMore, Machine, Quantity, ReadError, StaleError, Unknown } from "./parts";
import {
  type InventoryScope,
  type PagedState,
  type ReadState,
  useInventoryScope,
  useStockLocations,
  useStoreMovements,
} from "./useInventory";
import "../shell/surface.css";
import "./inventory.css";

type LocationsState = ReadState<{ items: StockLocation[] }>;

// --- Locations ------------------------------------------------------------------

function LocationsTable({ items }: Readonly<{ items: StockLocation[] }>): React.JSX.Element {
  const t = useT();
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="data-table__caption">{t("inventory.locations.caption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("inventory.locations.col.name")}</th>
            <th scope="col">{t("inventory.locations.col.code")}</th>
            <th scope="col">{t("inventory.locations.col.kind")}</th>
            <th scope="col">{t("inventory.locations.col.active")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((loc) => (
            <tr key={loc.id} className="data-table__row data-table__row--static">
              <th scope="row">
                <bdi dir="auto">{loc.name}</bdi>
              </th>
              <td>
                <Machine value={loc.code} />
              </td>
              <td>{t(locationKindKey(loc.kind))}</td>
              <td>
                <span className={loc.isActive ? "badge badge--active" : "badge badge--suspended"}>
                  {t(loc.isActive ? "inventory.locations.active" : "inventory.locations.inactive")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LocationsSection({ locations }: Readonly<{ locations: LocationsState }>) {
  const t = useT();
  let body: React.JSX.Element;
  if (locations.isLoading) {
    body = <ListState state="loading" label={t("inventory.locations.loadingNoun")} />;
  } else if (locations.error) {
    body = (
      <ReadError
        error={locations.error}
        failedKey="inventory.locations.loadFailed"
        notFoundKey="inventory.store.notFound"
        onRetry={locations.retry}
      />
    );
  } else if (!locations.data || locations.data.items.length === 0) {
    body = <ListState state="empty" emptyMessage={t("inventory.locations.empty")} />;
  } else {
    body = (
      <>
        <LocationsTable items={locations.data.items} />
        <StaleError error={locations.inlineError} onRetry={locations.retry} />
      </>
    );
  }
  return (
    <section className="inventory__section" aria-labelledby="inventory-locations">
      <h2 id="inventory-locations" className="inventory__section-title">
        {t("inventory.locations.title")}
      </h2>
      {body}
    </section>
  );
}

// --- Movement ledger -------------------------------------------------------------

function columns(t: T): { key: string; header: string }[] {
  return [
    { key: "occurredAt", header: t("inventory.movements.col.occurredAt") },
    { key: "type", header: t("inventory.movements.col.type") },
    { key: "product", header: t("inventory.movements.col.product") },
    { key: "quantity", header: t("inventory.movements.col.quantity") },
    { key: "position", header: t("inventory.movements.col.position") },
    { key: "reason", header: t("inventory.movements.col.reason") },
    { key: "erp", header: t("inventory.movements.col.erp") },
  ];
}

function ProductCell({
  storeId,
  movement,
}: Readonly<{ storeId: string; movement: StockMovement }>) {
  const t = useT();
  const productId = movementProductId(movement);
  if (!productId) return <span className="muted">{t("inventory.movements.adhoc")}</span>;
  return (
    <Link
      to={`/inventory/stores/${storeId}/products/${productId}`}
      aria-label={t("inventory.movements.openProduct", { ref: productId })}
    >
      <Machine value={productId} />
    </Link>
  );
}

function MovementRow({
  storeId,
  movement,
  locations,
}: Readonly<{
  storeId: string;
  movement: StockMovement;
  locations: StockLocation[] | undefined;
}>): React.JSX.Element {
  const t = useT();
  const location = locationLabel(locations, movement.stockLocationId);
  return (
    <tr className="data-table__row data-table__row--static">
      <td>
        <DateTime value={movement.occurredAt} />
      </td>
      <td>{t(movementTypeKey(movement.movementType))}</td>
      <td>
        <ProductCell storeId={storeId} movement={movement} />
      </td>
      <td className="num" data-testid="movement-quantity">
        <Quantity value={movement.quantity} /> <Machine value={movement.stockingUnit} />
      </td>
      <td>
        {location ? <bdi dir="auto">{location}</bdi> : <Unknown />}
        {" · "}
        {t(inventoryStatusKey(movement.inventoryStatus))}
      </td>
      <td>
        {movement.reason ? (
          <bdi dir="auto">{movement.reason}</bdi>
        ) : (
          <span className="muted">{t("inventory.value.none")}</span>
        )}
      </td>
      <td>{t(integrationStateKey(movement.integrationState))}</td>
    </tr>
  );
}

function MovementsBody({
  storeId,
  movements,
  locations,
}: Readonly<{
  storeId: string;
  movements: PagedState<StockMovement>;
  locations: StockLocation[] | undefined;
}>): React.JSX.Element {
  const t = useT();
  const cols = columns(t);
  const caption = t("inventory.movements.caption");
  if (movements.isLoading) {
    return (
      <DataTableSkeleton
        caption={caption}
        columns={cols}
        label={t("inventory.movements.loadingNoun")}
      />
    );
  }
  if (movements.error) {
    return (
      <ReadError
        error={movements.error}
        failedKey="inventory.movements.loadFailed"
        notFoundKey="inventory.store.notFound"
        onRetry={movements.retry}
      />
    );
  }
  if (movements.rows.length === 0 && !movements.hasMore) {
    return <ListState state="empty" emptyMessage={t("inventory.movements.empty")} />;
  }
  return (
    <>
      <div className="table-scroll">
        <table className="data-table">
          <caption className="data-table__caption">{caption}</caption>
          <thead>
            <tr>
              {cols.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={col.key === "quantity" ? "num" : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {movements.rows.map((m) => (
              <MovementRow key={m.id} storeId={storeId} movement={m} locations={locations} />
            ))}
          </tbody>
        </table>
      </div>
      {/* A failed continuation keeps the rows above and retries at the boundary. */}
      <StaleError error={movements.inlineError} onRetry={movements.retry} />
      <LoadMore
        hasMore={movements.hasMore}
        isFetching={movements.isFetchingNextPage}
        label={t("inventory.movements.loadMore")}
        onLoadMore={movements.loadMore}
      />
    </>
  );
}

// --- Page ------------------------------------------------------------------------

function useStoreName(tenantId: string | null, storeId: string): string | undefined {
  const { result } = useStoreList(tenantId);
  return result?.kind === "rows" ? result.rows.find((s) => s.id === storeId)?.name : undefined;
}

function StoreView({
  scope,
  storeId,
}: Readonly<{ scope: InventoryScope; storeId: string }>): React.JSX.Element {
  const t = useT();
  const name = useStoreName(scope.tenantId, storeId);
  const locations = useStockLocations({ scope, storeId });
  const movements = useStoreMovements({ scope, storeId });
  return (
    <div className="surface">
      <BackLink to="/inventory" label={t("inventory.store.back")} />
      <header className="surface__head">
        <div>
          <h1 className="content__title">
            {name ? <bdi dir="auto">{name}</bdi> : t("inventory.store.title")}
          </h1>
          <p className="content__sub">{t("inventory.store.sub")}</p>
        </div>
      </header>
      <p className="inventory__note">{t("inventory.note.erpBook")}</p>
      <LocationsSection locations={locations} />
      <section className="inventory__section" aria-labelledby="inventory-movements">
        <h2 id="inventory-movements" className="inventory__section-title">
          {t("inventory.movements.title")}
        </h2>
        <p className="content__sub">{t("inventory.movements.sub")}</p>
        <MovementsBody storeId={storeId} movements={movements} locations={locations.data?.items} />
      </section>
    </div>
  );
}

function NotAvailable(): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      <BackLink to="/inventory" label={t("inventory.store.back")} />
      <ReadError
        error={{ kind: "not-found" }}
        failedKey="inventory.movements.loadFailed"
        notFoundKey="inventory.store.notFound"
        onRetry={() => undefined}
      />
    </div>
  );
}

export function InventoryStore(): React.JSX.Element {
  const t = useT();
  const { storeId } = useParams();
  const scope = useInventoryScope();
  const signOut = useSignOut();
  if (!canReadInventory(scope.role)) return <NoAccess onSignOut={signOut} />;
  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("inventory.scopePrompt")}</p>
      </div>
    );
  }
  return (
    <>
      {/* A deep link to another store's view never switches scope (RT-268). */}
      <ScopeMismatchBanner storeId={storeId} />
      {/* A malformed route id would be a contract 400: it is never sent. */}
      {isUuid(storeId) ? <StoreView scope={scope} storeId={storeId} /> : <NotAvailable />}
    </>
  );
}
