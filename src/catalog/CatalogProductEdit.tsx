/**
 * RT-768 product edit route «تعديل الصنف» (CAT-C2a, RT-752 AC 2: the edit form
 * is its own route under the detail). Gates first, so nothing is asked for what
 * the API would refuse:
 *   - no tenant: scope prompt; a role the catalog refuses or an id that is not a
 *     UUID: the one non-disclosing "not available" state;
 *   - `store_manager` reads the catalog but cannot write: a read-only notice and
 *     a way back, no form;
 *   - a retired item is read-only (retiring cannot be undone on this surface).
 * The form is keyed by tenant and item, so a scope change cannot carry typed
 * values into another tenant's item. Create is not here: it is held by owner
 * decision D9 (RT-768 comment 13487) until pricing lands.
 */
import { BackArrow } from "@/components/BackArrow";
import { Banner } from "@/components/Banner";
import { GatedButton } from "@/components/GatedButton";
import { ListState } from "@/components/ListState";
import { type MessageKey, useT } from "@/i18n";
import type { CatalogProductDetail as ProductDetail } from "@/lib/catalog-queries";
import { useRef } from "react";
import { Link, useParams } from "react-router";
import { Notice } from "./CatalogPager";
import { ProductEditForm } from "./ProductEditForm";
import { isProductId } from "./catalogDetailLogic";
import { canReadCatalog } from "./catalogLogic";
import { canWriteCatalog } from "./productFormLogic";
import { type CatalogScope, useCatalogScope } from "./useCatalog";
import { type CatalogProductError, useCatalogProduct } from "./useCatalogProduct";
import "../shell/surface.css";
import "./catalog.css";

function BackToItem({ productId }: Readonly<{ productId: string | null }>): React.JSX.Element {
  const t = useT();
  return (
    <Link
      to={productId ? `/catalog/products/${productId}` : "/catalog/products"}
      className="surface__back"
    >
      <BackArrow /> {t(productId ? "catalog.edit.back" : "catalog.detail.back")}
    </Link>
  );
}

function Frame({
  productId,
  children,
}: Readonly<{ productId: string | null; children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="surface">
      <BackToItem productId={productId} />
      {children}
    </div>
  );
}

function NotAvailable(): React.JSX.Element {
  const t = useT();
  return (
    <Frame productId={null}>
      <Notice
        message={t("catalog.detail.unavailable")}
        hint={t("catalog.detail.unavailableHint")}
      />
    </Frame>
  );
}

const READ_FAILURE_KEY: Record<"session" | "rate-limited" | "generic", MessageKey> = {
  session: "catalog.detail.sessionExpired",
  "rate-limited": "catalog.detail.rateLimited",
  generic: "catalog.detail.loadFailed",
};

/** The item could not be read at all. Only a rate limit or a server failure can succeed on a retry. */
function ReadFailure({
  error,
  productId,
  onRetry,
}: Readonly<{
  error: CatalogProductError;
  productId: string;
  onRetry: () => void;
}>): React.JSX.Element {
  const t = useT();
  if (error.kind === "not-found") return <NotAvailable />;
  return (
    <Frame productId={productId}>
      <Banner
        variant={error.kind === "rate-limited" ? "warning" : "danger"}
        message={t(READ_FAILURE_KEY[error.kind])}
        requestId={error.requestId}
        action={
          error.kind === "session" ? undefined : (
            <GatedButton type="button" className="btn-secondary" onClick={onRetry}>
              {t("catalog.detail.retry")}
            </GatedButton>
          )
        }
      />
    </Frame>
  );
}

function EditPage({
  product,
  scope,
  reload,
}: Readonly<{
  product: ProductDetail;
  scope: CatalogScope & { tenantId: string };
  reload: () => Promise<ProductDetail | undefined>;
}>): React.JSX.Element {
  const t = useT();
  const { productId, name } = product.summary;
  return (
    <div className="surface">
      <BackToItem productId={productId} />
      <header className="surface__head">
        <div>
          <h1 className="content__title">
            {t.rich("catalog.edit.title", { name: <bdi dir="auto">{name}</bdi> })}
          </h1>
          <p className="content__sub">
            {t.rich("catalog.edit.sub", { tenant: <bdi>{scope.tenantName}</bdi> })}
          </p>
        </div>
      </header>
      <ProductEditForm
        key={`${scope.tenantId}:${productId}`}
        product={product}
        tenantId={scope.tenantId}
        reload={reload}
      />
    </div>
  );
}

function EditContent({
  scope,
  productId,
}: Readonly<{ scope: CatalogScope & { tenantId: string }; productId: string }>): React.JSX.Element {
  const t = useT();
  const { product, error, retry, reload } = useCatalogProduct(scope.tenantId, productId);
  // Retired is decided when the item first arrives. Once the form is open it
  // handles a later retirement itself (locked, with what was typed still there).
  const openedRetired = useRef<boolean | null>(null);
  if (product && openedRetired.current === null) {
    openedRetired.current = product.summary.status === "retired";
  }
  // A failed re-read keeps the product (and what was typed): only no product at all is a failure.
  if (product && openedRetired.current) {
    return (
      <Frame productId={productId}>
        <Notice message={t("catalog.edit.retired")} hint={t("catalog.edit.retiredHint")} />
      </Frame>
    );
  }
  if (product) return <EditPage product={product} scope={scope} reload={reload} />;
  if (error) return <ReadFailure error={error} productId={productId} onRetry={retry} />;
  return (
    <Frame productId={productId}>
      <ListState state="loading" label={t("catalog.edit.loadingNoun")} />
    </Frame>
  );
}

export function CatalogProductEdit(): React.JSX.Element {
  const t = useT();
  const { productId } = useParams();
  const scope = useCatalogScope();
  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("catalog.edit.scopePrompt")}</p>
      </div>
    );
  }
  if (!canReadCatalog(scope.role) || !isProductId(productId)) return <NotAvailable />;
  if (!canWriteCatalog(scope.role)) {
    return (
      <Frame productId={productId}>
        <Notice message={t("catalog.edit.readOnly")} hint={t("catalog.edit.readOnlyHint")} />
      </Frame>
    );
  }
  // Keyed by tenant and item: what was seen or typed for one never carries into another.
  return (
    <EditContent
      key={`${scope.tenantId}:${productId}`}
      scope={{ ...scope, tenantId: scope.tenantId }}
      productId={productId}
    />
  );
}
