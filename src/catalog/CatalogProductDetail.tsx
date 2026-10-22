/**
 * RT-766 — Catalog product detail «الصنف» (CAT-C1b, RT-752 AC 2 and D3),
 * read-only. A full, deep-linkable page: the tenant's values first, then the
 * item's identifiers, then each store's override as the raw deviation it is
 * (RT-752 D8: the UI never computes `override ?? tenant`). No control edits
 * anything here; the edit surfaces are the CAT-C2 slices. A product the API
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
import { Link, useParams } from "react-router";
import { Identifiers, StoreOverrides, TenantValues } from "./CatalogDetailSections";
import { Notice } from "./CatalogPager";
import { inventoryPath, isProductId } from "./catalogDetailLogic";
import { canReadCatalog } from "./catalogLogic";
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
}: Readonly<{ product: ProductDetail; scope: CatalogScope }>): React.JSX.Element {
  const t = useT();
  const { summary } = product;
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
          <h1 className="content__title">
            <bdi dir="auto">{summary.name}</bdi>
          </h1>
          <p className="content__sub">
            {t.rich("catalog.detail.sub", { tenant: <bdi>{scope.tenantName}</bdi> })}
          </p>
        </div>
        {onHand ? (
          <div className="surface__actions surface__actions--head">
            <Link to={onHand} className="btn-ghost">
              {t("catalog.detail.inventoryLink", { store: scope.activeStoreName ?? "" })}
            </Link>
          </div>
        ) : null}
      </header>
      <TenantValues product={product} />
      <Identifiers identifiers={product.identifiers} storeLabel={storeLabel} />
      <StoreOverrides product={product} storeLabel={storeLabel} />
    </div>
  );
}

function DetailContent({
  scope,
  productId,
}: Readonly<{ scope: CatalogScope; productId: string | null }>): React.JSX.Element {
  const t = useT();
  const { product, isLoading, error, retry } = useCatalogProduct(scope.tenantId, productId);
  if (productId === null) return <NotAvailable />;
  if (isLoading) {
    return (
      <div className="surface">
        <BackLink />
        <ListState state="loading" label={t("catalog.detail.loadingNoun")} />
      </div>
    );
  }
  if (error) return <ReadFailure error={error} onRetry={retry} />;
  if (!product) return <div className="surface" />;
  return <Loaded product={product} scope={scope} />;
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
