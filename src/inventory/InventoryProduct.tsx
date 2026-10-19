/**
 * RT-728 — one product's on-hand at one store (`getOnHand`), reached from a
 * movement row of the store's ledger; there is no free-text product entry.
 * Shows the derived physical on-hand, its sellable share and the split by
 * inventory status, exactly as the API's strings, with the API's negative
 * flag. A failed read is Unknown, never zero. This is Retail Tower's derived
 * on-hand, not ERPNext book stock (that stays on the stock-discrepancy view).
 *
 * Tracking identities (`listTrackingIdentities`) are requested only for owner /
 * tenant_admin, the API's roles; a 403 / 404 omits the section. Read-only.
 */
import { NoAccess } from "@/auth/NoAccess";
import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { useT } from "@/i18n";
import type { OnHand, TrackingIdentity } from "@/lib/inventory-queries";
import { ScopeMismatchBanner } from "@/shell/ScopeMismatchBanner";
import { useSignOut } from "@/shell/useSignOut";
import { useParams } from "react-router";
import {
  canReadInventory,
  canReadTracking,
  inventoryStatusKey,
  isHiddenSection,
  isUuid,
  trackingKindKey,
} from "./inventoryLogic";
import { BackLink, LoadMore, Machine, Quantity, ReadError, StaleError, Unknown } from "./parts";
import {
  type InventoryScope,
  type PagedState,
  type ProductTarget,
  type ReadState,
  useInventoryScope,
  useOnHand,
  useTrackingIdentities,
} from "./useInventory";
import "../shell/surface.css";
import "./inventory.css";

interface Target {
  storeId: string;
  productId: string;
}

// --- On-hand ---------------------------------------------------------------------

function Unit({ unit }: Readonly<{ unit: string | null | undefined }>): React.JSX.Element {
  return unit ? <Machine value={unit} /> : <Unknown />;
}

function OnHandFigures({ onHand }: Readonly<{ onHand: OnHand }>): React.JSX.Element {
  const t = useT();
  return (
    <>
      {onHand.negativeBalance ? (
        <Banner variant="warning" message={t("inventory.onHand.negative")} />
      ) : null}
      <dl className="inventory__figures">
        <div>
          <dt>{t("inventory.onHand.physical")}</dt>
          <dd data-testid="on-hand-quantity">
            <Quantity value={onHand.quantity} /> <Unit unit={onHand.stockingUnit} />
          </dd>
        </div>
        <div>
          <dt>{t("inventory.onHand.sellable")}</dt>
          <dd data-testid="on-hand-sellable">
            <Quantity value={onHand.sellableQuantity} /> <Unit unit={onHand.stockingUnit} />
          </dd>
        </div>
      </dl>
      <div className="table-scroll">
        <table className="data-table">
          <caption className="data-table__caption">{t("inventory.onHand.byStatus")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("inventory.onHand.col.status")}</th>
              <th scope="col" className="num">
                {t("inventory.onHand.col.quantity")}
              </th>
            </tr>
          </thead>
          <tbody>
            {onHand.statusQuantities.map((row) => (
              <tr key={row.inventoryStatus} className="data-table__row data-table__row--static">
                <th scope="row">{t(inventoryStatusKey(row.inventoryStatus))}</th>
                <td className="num">
                  <Quantity value={row.quantity} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="inventory__note">{t("inventory.onHand.note")}</p>
    </>
  );
}

function OnHandSection({ onHand }: Readonly<{ onHand: ReadState<OnHand> }>): React.JSX.Element {
  const t = useT();
  let body: React.JSX.Element;
  if (onHand.isLoading) {
    body = <ListState state="loading" label={t("inventory.onHand.loadingNoun")} />;
  } else if (onHand.data) {
    body = (
      <>
        <OnHandFigures onHand={onHand.data} />
        <StaleError error={onHand.inlineError} onRetry={onHand.retry} />
      </>
    );
  } else {
    body = (
      <>
        {/* No answer: the quantity is Unknown, never shown as zero. */}
        <p data-testid="on-hand-quantity">
          {t("inventory.onHand.physical")}: <Unknown />
        </p>
        {onHand.error ? (
          <ReadError
            error={onHand.error}
            failedKey="inventory.onHand.loadFailed"
            notFoundKey="inventory.product.notFound"
            onRetry={onHand.retry}
          />
        ) : null}
      </>
    );
  }
  return (
    <section className="inventory__section" aria-labelledby="inventory-on-hand">
      <h2 id="inventory-on-hand" className="inventory__section-title">
        {t("inventory.onHand.title")}
      </h2>
      {body}
    </section>
  );
}

// --- Tracking identities ------------------------------------------------------------

function TrackingTable({ items }: Readonly<{ items: TrackingIdentity[] }>): React.JSX.Element {
  const t = useT();
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="data-table__caption">{t("inventory.tracking.caption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("inventory.tracking.col.kind")}</th>
            <th scope="col">{t("inventory.tracking.col.code")}</th>
            <th scope="col">{t("inventory.tracking.col.expiry")}</th>
            <th scope="col">{t("inventory.tracking.col.manufactured")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((id) => (
            <tr key={id.id} className="data-table__row data-table__row--static">
              <td>{t(trackingKindKey(id.kind))}</td>
              <th scope="row">
                <Machine value={id.code} />
              </th>
              <td>
                {id.expiryDate ? <Machine value={id.expiryDate} /> : t("inventory.value.none")}
              </td>
              <td>
                {id.manufacturedOn ? (
                  <Machine value={id.manufacturedOn} />
                ) : (
                  t("inventory.value.none")
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrackingBody({ list }: Readonly<{ list: PagedState<TrackingIdentity> }>) {
  const t = useT();
  if (list.isLoading) {
    return <ListState state="loading" label={t("inventory.tracking.loadingNoun")} />;
  }
  if (list.error) {
    return (
      <ReadError
        error={list.error}
        failedKey="inventory.tracking.loadFailed"
        notFoundKey="inventory.product.notFound"
        onRetry={list.retry}
      />
    );
  }
  if (list.rows.length === 0 && !list.hasMore) {
    return <ListState state="empty" emptyMessage={t("inventory.tracking.empty")} />;
  }
  return (
    <>
      <TrackingTable items={list.rows} />
      <StaleError error={list.inlineError} onRetry={list.retry} />
      <LoadMore
        hasMore={list.hasMore}
        isFetching={list.isFetchingNextPage}
        label={t("inventory.tracking.loadMore")}
        onLoadMore={list.loadMore}
      />
    </>
  );
}

function TrackingSection({ target }: Readonly<{ target: ProductTarget }>) {
  const t = useT();
  const list = useTrackingIdentities(target);
  // The API's refusal (403 / non-disclosing 404) means: not for this caller. Omit.
  if (list.error && isHiddenSection(list.error.kind)) return null;
  return (
    <section className="inventory__section" aria-labelledby="inventory-tracking">
      <h2 id="inventory-tracking" className="inventory__section-title">
        {t("inventory.tracking.title")}
      </h2>
      <TrackingBody list={list} />
    </section>
  );
}

// --- Page ------------------------------------------------------------------------

function ProductView({
  scope,
  target,
}: Readonly<{ scope: InventoryScope; target: Target }>): React.JSX.Element {
  const t = useT();
  const onHand = useOnHand({ scope, ...target });
  return (
    <div className="surface">
      <BackLink to={`/inventory/stores/${target.storeId}`} label={t("inventory.product.back")} />
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("inventory.product.title")}</h1>
          <p className="content__sub">
            {t.rich("inventory.product.sub", { ref: <Machine value={target.productId} /> })}
          </p>
        </div>
      </header>
      <OnHandSection onHand={onHand} />
      {canReadTracking(scope.role) ? <TrackingSection target={{ scope, ...target }} /> : null}
    </div>
  );
}

function NotAvailable({ storeId }: Readonly<{ storeId: string | undefined }>): React.JSX.Element {
  const t = useT();
  const back = isUuid(storeId) ? `/inventory/stores/${storeId}` : "/inventory";
  return (
    <div className="surface">
      <BackLink to={back} label={t("inventory.product.back")} />
      <Banner variant="warning" message={t("inventory.product.notFound")} />
    </div>
  );
}

export function InventoryProduct(): React.JSX.Element {
  const t = useT();
  const { storeId, productId } = useParams();
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
      <ScopeMismatchBanner storeId={storeId} />
      {isUuid(storeId) && isUuid(productId) ? (
        <ProductView scope={scope} target={{ storeId, productId }} />
      ) : (
        <NotAvailable storeId={storeId} />
      )}
    </>
  );
}
