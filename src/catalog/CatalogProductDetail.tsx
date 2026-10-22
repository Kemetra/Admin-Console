/**
 * RT-766 — Catalog product detail «الصنف» (CAT-C1b, RT-752 AC 2 and D3). A
 * full, deep-linkable page: the tenant's values first, then the item's
 * identifiers, then each store's override as the raw deviation it is (RT-752
 * D8: the UI never computes `override ?? tenant`). The page itself edits
 * nothing. RT-768 adds, for owner and tenant_admin only and only on an item that
 * is not retired, a link to the edit route and the Retire action; a retired item
 * and `store_manager` see no control. The other edit surfaces are CAT-C2b / C2c. A product the API
 * refuses (another tenant, a role outside the catalog, an id that is not a UUID)
 * is one non-disclosing "not available" state. With a store in scope the page
 * links to that store's on-hand stock (RT-728); it shows no ERP data.
 */
import { BackArrow } from "@/components/BackArrow";
import { Banner } from "@/components/Banner";
import { GatedButton } from "@/components/GatedButton";
import { ListState } from "@/components/ListState";
import { useT } from "@/i18n";
import type { CatalogProductDetail as ProductDetail } from "@/lib/catalog-queries";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Identifiers, StoreOverrides, TenantValues } from "./CatalogDetailSections";
import { Notice } from "./CatalogPager";
import { ProductRetire } from "./ProductRetire";
import { inventoryPath, isProductId } from "./catalogDetailLogic";
import { canReadCatalog } from "./catalogLogic";
import { canWriteCatalog } from "./productFormLogic";
import { type CatalogScope, useCatalogScope } from "./useCatalog";
import { type CatalogProductError, useCatalogProduct, useStoreLabels } from "./useCatalogProduct";
import "../shell/surface.css";
import "./catalog.css";

function BackLink(): React.JSX.Element {
  const t = useT();
  return (
    <Link to="/catalog/products" className="surface__back">
      <BackArrow /> {t("catalog.detail.back")}
    </Link>
  );
}

/** The one non-disclosing state: it never says why, and it names no request. */
function NotAvailable(): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      <BackLink />
      <Notice
        message={t("catalog.detail.unavailable")}
        hint={t("catalog.detail.unavailableHint")}
      />
    </div>
  );
}

/** A failed read. Only a rate limit or a server failure can succeed on a retry. */
function ReadFailure({
  error,
  onRetry,
}: Readonly<{ error: CatalogProductError; onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  if (error.kind === "not-found") return <NotAvailable />;
  const retry = (
    <GatedButton type="button" className="btn-secondary" onClick={onRetry}>
      {t("catalog.detail.retry")}
    </GatedButton>
  );
  return (
    <div className="surface">
      <BackLink />
      {error.kind === "session" ? (
        <Banner
          variant="danger"
          message={t("catalog.detail.sessionExpired")}
          requestId={error.requestId}
        />
      ) : (
        <Banner
          variant={error.kind === "rate-limited" ? "warning" : "danger"}
          message={t(
            error.kind === "rate-limited"
              ? "catalog.detail.rateLimited"
              : "catalog.detail.loadFailed",
          )}
          requestId={error.requestId}
          action={retry}
        />
      )}
    </div>
  );
}

function Loaded({
  product,
  scope,
  reload,
}: Readonly<{
  product: ProductDetail;
  scope: CatalogScope;
  reload: () => Promise<ProductDetail | undefined>;
}>): React.JSX.Element {
  const t = useT();
  const { summary } = product;
  const retired = summary.status === "retired";
  const canWrite = canWriteCatalog(scope.role) && !retired && scope.tenantId !== null;
  const [justRetired, setJustRetired] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // After Retire the confirmation is gone: focus goes to the page title, which now says so.
  useEffect(() => {
    if (justRetired) titleRef.current?.focus();
  }, [justRetired]);
  const needsNames =
    product.storeOverrides.length > 0 || product.identifiers.some((i) => i.storeId !== null);
  const storeLabel = useStoreLabels(
    scope.tenantId,
    { id: scope.activeStoreId, name: scope.activeStoreName },
    needsNames,
  );
  const onHand = inventoryPath(scope.role, scope.activeStoreId, summary.productId);
  return (
    <div className="surface">
      <BackLink />
      <header className="surface__head">
        <div>
          <h1 ref={titleRef} tabIndex={-1} className="content__title">
            <bdi dir="auto">{summary.name}</bdi>
          </h1>
          <p className="content__sub">
            {t.rich(
              canWriteCatalog(scope.role) ? "catalog.detail.subWriter" : "catalog.detail.sub",
              {
                tenant: <bdi>{scope.tenantName}</bdi>,
              },
            )}
          </p>
        </div>
        {onHand || canWrite ? (
          <div className="surface__actions surface__actions--head">
            {onHand ? (
              <Link to={onHand} className="btn-ghost">
                {t("catalog.detail.inventoryLink", { store: scope.activeStoreName ?? "" })}
              </Link>
            ) : null}
            {canWrite ? (
              <Link to={`/catalog/products/${summary.productId}/edit`} className="btn-primary">
                {t("catalog.detail.edit")}
              </Link>
            ) : null}
          </div>
        ) : null}
      </header>
      {justRetired ? (
        <Banner variant="success" message={t("catalog.retire.done", { name: summary.name })} />
      ) : null}
      {retired && !justRetired ? (
        <Banner variant="info" message={t("catalog.detail.retiredNotice")} />
      ) : null}
      <TenantValues product={product} />
      <Identifiers identifiers={product.identifiers} storeLabel={storeLabel} />
      <StoreOverrides product={product} storeLabel={storeLabel} />
      {canWrite && scope.tenantId ? (
        <ProductRetire
          product={product}
          tenantId={scope.tenantId}
          reload={reload}
          onRetired={() => setJustRetired(true)}
        />
      ) : null}
    </div>
  );
}

function DetailContent({
  scope,
  productId,
}: Readonly<{ scope: CatalogScope; productId: string | null }>): React.JSX.Element {
  const t = useT();
  const { product, isLoading, error, retry, reload } = useCatalogProduct(scope.tenantId, productId);
  if (productId === null) return <NotAvailable />;
  if (isLoading) {
    return (
      <div className="surface">
        <BackLink />
        <ListState state="loading" label={t("catalog.detail.loadingNoun")} />
      </div>
    );
  }
  // A failed re-read keeps the item on screen (its Retire section says the reload failed).
  if (product) return <Loaded product={product} scope={scope} reload={reload} />;
  if (error) return <ReadFailure error={error} onRetry={retry} />;
  return <div className="surface" />;
}

export function CatalogProductDetail(): React.JSX.Element {
  const t = useT();
  const { productId } = useParams();
  const scope = useCatalogScope();
  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("catalog.detail.scopePrompt")}</p>
      </div>
    );
  }
  // A refused role or an id the API would reject reads nothing: the server would answer 404 / 400.
  const readable = canReadCatalog(scope.role) && isProductId(productId);
  return <DetailContent scope={scope} productId={readable ? productId : null} />;
}
