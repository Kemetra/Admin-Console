/**
 * RT-765 — Catalog product list «الأصناف» (CAT-C1a, RT-752 AC 2 and AC 4),
 * read-only. The tenant's products, keyset paged, in the server's order (name
 * A to Z, exact code matches first with a search). With a store in scope the
 * list is requested with `store_id` and the price and availability columns show
 * the server-resolved store values; with "All stores" they are the tenant's.
 * Filters live in the URL, and a tenant change resets them (a category id of
 * another tenant matches nothing). A role the API refuses gets the
 * non-disclosing not-available state and no form. Opening a row goes to the
 * product detail (CAT-C1b).
 */
import { useT } from "@/i18n";
import type { CatalogProduct } from "@/lib/catalog-queries";
import { Fragment, useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
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

/** A tenant switch is a scope transition: the previous tenant's filters do not carry over. */
function useResetOnTenantChange(tenantId: string | null, reset: () => void): void {
  const previous = useRef(tenantId);
  useEffect(() => {
    if (previous.current === tenantId) return;
    previous.current = tenantId;
    reset();
  }, [tenantId, reset]);
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
  categoryName: string | undefined,
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
              category: <bdi dir="auto">{categoryName ?? t("catalog.filter.categoryStale")}</bdi>,
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

  const clearFilters = useCallback(() => setSearch(new URLSearchParams()), [setSearch]);
  const resetFilters = useCallback(
    () => setSearch(new URLSearchParams(), { replace: true }),
    [setSearch],
  );
  useResetOnTenantChange(scope.tenantId, resetFilters);

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
  const categoryName = categories.categories.find(
    (c) => c.categoryId.toLowerCase() === filters.categoryId.toLowerCase(),
  )?.name;
  return (
    <Shell scope={scope}>
      <CatalogFilterBar
        applied={filters}
        categories={categories.categories}
        categoriesLoading={categories.isLoading}
        categoriesFailed={categories.failed}
        initialErrors={errors}
        onApply={(next) => setSearch(filtersToSearch(next))}
        onClear={clearFilters}
      />
      {query ? (
        <Results
          list={list}
          storeInScope={Boolean(scope.activeStoreId)}
          filtered={!isDefaultFilters(filters)}
          summary={describeFilters(filters, categoryName, t)}
          searching={filters.q !== ""}
          onOpen={(row: CatalogProduct) => navigate(`/catalog/products/${row.productId}`)}
          onClearFilters={clearFilters}
        />
      ) : null}
    </Shell>
  );
}
