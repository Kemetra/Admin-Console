import { useT } from "@/i18n";
import type { SaleItem, SaleListQuery } from "@/lib/sale-queries";
import { useStoreDirectory } from "@/shift-closes/useShiftCloses";
/**
 * RT-587 — Sales search (spec 012 J1, read-only). One store's received sales
 * over an inclusive business-date range, newest first, keyset paged. Nothing
 * is read until a store and both dates are set (FR-004). Filters live in the
 * URL (FR-007). A role the API refuses (store_staff) gets the non-disclosing
 * not-available state and no form (AC-5). The results and paging states are in
 * `SaleResults.tsx` and `SalePager.tsx`.
 */
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { SaleFilterBar } from "./SaleFilterBar";
import { Unavailable } from "./SalePager";
import { QueryPrompt, Results } from "./SaleResults";
import {
  type FilterErrors,
  type SaleFilters,
  buildListQuery,
  filtersFromSearch,
  filtersToSearch,
  isQueryReady,
  validateFilters,
} from "./saleFilters";
import { canReadSales } from "./saleLogic";
import { type SaleListState, type SaleScope, useSaleList, useSaleScope } from "./useSales";
import "../shell/surface.css";
import "./sales.css";

/** What the URL asks for, and whether it may be read now. */
interface ListModel {
  filters: SaleFilters;
  errors: FilterErrors;
  valid: boolean;
  query: SaleListQuery | null;
}

function listModel(search: URLSearchParams, permitted: boolean): ListModel {
  const filters = filtersFromSearch(search);
  const errors = validateFilters(filters);
  const valid = Object.keys(errors).length === 0;
  const ready = permitted && valid && isQueryReady(filters);
  return { filters, errors, valid, query: ready ? buildListQuery(filters) : null };
}

/** Below the form: the results of a ready query, or the prompt for a missing store or range. */
function ListBody({
  model,
  list,
  onOpen,
}: Readonly<{
  model: ListModel;
  list: SaleListState;
  onOpen: (row: SaleItem) => void;
}>): React.JSX.Element | null {
  if (model.query) return <Results list={list} onOpen={onOpen} />;
  return model.valid ? <QueryPrompt /> : null;
}

function Shell({
  scope,
  children,
}: Readonly<{ scope: SaleScope; children: React.ReactNode }>): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("sales.list.title")}</h1>
          <p className="content__sub">
            {t.rich("sales.list.sub", { tenant: <bdi>{scope.tenantName}</bdi> })}
          </p>
        </div>
      </header>
      {children}
    </div>
  );
}

export function SaleList(): React.JSX.Element {
  const t = useT();
  const scope = useSaleScope();
  const [search, setSearch] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  // A refused role reads nothing: the server would answer the same 404 (AC-5).
  const permitted = canReadSales(scope.role);
  const directory = useStoreDirectory(permitted ? scope.tenantId : null);
  const model = listModel(search, permitted);
  const list = useSaleList(scope, model.query);

  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("sales.list.scopePrompt")}</p>
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
  return (
    <Shell scope={scope}>
      <SaleFilterBar
        applied={model.filters}
        stores={directory.stores}
        activeStoreId={scope.activeStoreId}
        initialErrors={model.errors}
        onApply={(next) => setSearch(filtersToSearch(next))}
        onClear={() => setSearch(new URLSearchParams())}
      />
      <ListBody
        model={model}
        list={list}
        onOpen={(row) => navigate(`/sales/${row.saleRef}`, { state: { list: location.search } })}
      />
    </Shell>
  );
}
