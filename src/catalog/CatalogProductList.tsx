/**
 * RT-765 — Catalog product list «الأصناف» (CAT-C1a, RT-752 AC 2 and AC 4),
 * read-only. The tenant's products, keyset paged, in the server's order (name
 * A to Z, exact code matches first with a search). With a store in scope the
 * list is requested with `store_id` and the price and availability columns show
 * the server-resolved store values; with "All stores" they are the tenant's.
 * Filters live in the URL, and a tenant change resets them. A role the API refuses gets the
 * non-disclosing not-available state and no form. Opening a row goes to the
 * product detail (CAT-C1b).
 */
import { useT } from "@/i18n";
import type { CatalogProduct } from "@/lib/catalog-queries";
import { Fragment, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { CatalogFilterBar } from "./CatalogFilterBar";
import { Unavailable } from "./CatalogPager";
import { Results } from "./CatalogResults";
import {
  type CatalogFilters,
  buildListQuery,
  canReadCatalog,
  filtersFromSearch,
  filtersToSearch,
  isDefaultFilters,
  statusFilterKey,
  validateFilters,
} from "./catalogLogic";
import {
  type CatalogScope,
  useCatalogCategories,
  useCatalogList,
  useCatalogScope,
} from "./useCatalog";
import "../shell/surface.css";
import "./catalog.css";

interface TenantStamp {
  tenantId: string;
}

/**
 * A tenant switch is a scope transition: the previous tenant's filters do not
 * carry over (a category id of another tenant matches nothing). The shell
 * remounts this surface on a scope change (RT-268), so the reset cannot live in
 * component state: the tenant the URL filters belong to is stamped in the
 * history entry. An unstamped entry (a first arrival, a deep link) keeps its
 * filters and is stamped; an entry stamped for another tenant drops them.
 */
function useTenantStamp(tenantId: string | null): void {
  const location = useLocation();
  const navigate = useNavigate();
  const stamped = (location.state as Partial<TenantStamp> | null)?.tenantId;
  useEffect(() => {
    if (!tenantId || stamped === tenantId) return;
    const state: TenantStamp = { tenantId };
    const search = stamped === undefined ? location.search : "";
    navigate({ pathname: location.pathname, search }, { replace: true, state });
  }, [tenantId, stamped, location.pathname, location.search, navigate]);
}

function Shell({
  scope,
  children,
}: Readonly<{ scope: CatalogScope; children: React.ReactNode }>): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("catalog.list.title")}</h1>
          <p className="content__sub">
            {t.rich("catalog.list.sub", { tenant: <bdi>{scope.tenantName}</bdi> })}
          </p>
          {scope.activeStoreId ? (
            <p className="content__sub">
              {t.rich("catalog.list.storeNote", { store: <bdi>{scope.activeStoreName}</bdi> })}
            </p>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );
}

/**
 * The applied filters in words, for the filtered-empty message. The typed
 * search text and the category name are isolated (`<bdi>`): they can be Latin or
 * Arabic inside a sentence of the other script.
 */
function describeFilters(
  filters: CatalogFilters,
  categoryLabel: string,
  t: ReturnType<typeof useT>,
): React.ReactNode {
  const parts: { key: string; node: React.ReactNode }[] = [
    ...(filters.q === ""
      ? []
      : [
          {
            key: "q",
            node: t.rich("catalog.summary.q", { q: <bdi dir="auto">{filters.q}</bdi> }),
          },
        ]),
    {
      key: "status",
      node: t("catalog.summary.status", { status: t(statusFilterKey(filters.status)) }),
    },
    ...(filters.categoryId === ""
      ? []
      : [
          {
            key: "category",
            node: t.rich("catalog.summary.category", {
              category: <bdi dir="auto">{categoryLabel}</bdi>,
            }),
          },
        ]),
  ];
  return parts.map((part, i) => (
    <Fragment key={part.key}>
      {i > 0 ? t("catalog.summary.join") : null}
      {part.node}
    </Fragment>
  ));
}

export function CatalogProductList(): React.JSX.Element {
  const t = useT();
  const scope = useCatalogScope();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  // A refused role reads nothing: the server would answer the same 404.
  const permitted = canReadCatalog(scope.role);
  const filters = filtersFromSearch(search);
  const errors = validateFilters(filters);
  const valid = Object.keys(errors).length === 0;
  const query = permitted && valid ? buildListQuery(filters, scope.activeStoreId) : null;
  const list = useCatalogList(scope, query);
  const categories = useCatalogCategories(scope.tenantId, permitted);

  const stamp = scope.tenantId ? { state: { tenantId: scope.tenantId } satisfies TenantStamp } : {};
  const clearFilters = () => setSearch(new URLSearchParams(), stamp);
  useTenantStamp(scope.tenantId);

  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("catalog.list.scopePrompt")}</p>
      </div>
    );
  }
  if (!permitted) {
    return (
      <Shell scope={scope}>
        <Unavailable />
      </Shell>
    );
  }
  const categoryName = categories.categories.find((c) => c.categoryId === filters.categoryId)?.name;
  // A name that is not known yet (loading, or the list failed) is not "unavailable".
  const categoryLabel =
    categoryName ??
    t(
      categories.isLoading || categories.failed
        ? "catalog.filter.categorySelected"
        : "catalog.filter.categoryStale",
    );
  return (
    <Shell scope={scope}>
      <CatalogFilterBar
        applied={filters}
        categories={categories.categories}
        categoriesLoading={categories.isLoading}
        categoriesFailed={categories.failed}
        initialErrors={errors}
        onApply={(next) => setSearch(filtersToSearch(next), stamp)}
        onClear={clearFilters}
      />
      {query ? (
        <Results
          list={list}
          storeInScope={Boolean(scope.activeStoreId)}
          filtered={!isDefaultFilters(filters)}
          summary={describeFilters(filters, categoryLabel, t)}
          searching={filters.q !== ""}
          onOpen={(row: CatalogProduct) => navigate(`/catalog/products/${row.productId}`)}
          onClearFilters={clearFilters}
        />
      ) : null}
    </Shell>
  );
}
