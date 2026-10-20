import { Banner } from "@/components/Banner";
import { DataTable } from "@/components/DataTable";
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { ListState } from "@/components/ListState";
import { type SortState, type SortValue, sortRows } from "@/components/tableSort";
import { type T, useT } from "@/i18n";
import { intlTag } from "@/i18n/locale";
import type { Rf2ErrorRender } from "@/lib/rf2-queries";
/**
 * SF-S1 — Store roster (T026; RT-400 screens 01–04). Scoped to the ACTIVE
 * TENANT read from RF-1's provider. Pre-gate (OQ-4): with no active tenant we
 * render the scope prompt and never issue `listStores` (the scope-401 is
 * avoided, not a sign-out). With an active tenant, the backend-scoped store set
 * renders as a table (no client filter, OQ-2); zero rows is a successful empty
 * state (OQ-8).
 *
 * «إضافة متجر» stays in the header in every state: actions are never hidden by
 * role or state; the server's 403 is the authority. A residual `401` maps to
 * `scope-required` (scope prompt, still never a sign-out). 403 → danger banner;
 * 5xx → warning banner with a reload.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ScopePrompt } from "./ScopePrompt";
import { StoreStateBadge } from "./StoreStateBadge";
import { ZoneName } from "./ZoneName";
import { useStoreList } from "./useStoreQueries";
import { useStoreScope } from "./useStoreScope";
import "../shell/surface.css";

type StoreRow = {
  id: string;
  code: string;
  name: string;
  timezone?: string;
  is_active?: boolean;
};

function storeColumns(t: T) {
  return [
    {
      key: "name",
      header: t("stores.list.col.store"),
      cell: (s: StoreRow) => s.name,
      sortable: true,
    },
    {
      key: "code",
      header: t("stores.field.code"),
      cell: (s: StoreRow) => <bdi dir="ltr">{s.code}</bdi>,
      mono: true,
      sortable: true,
    },
    {
      key: "timezone",
      header: t("stores.field.timezone"),
      cell: (s: StoreRow) => <ZoneName zone={s.timezone} />,
    },
    {
      key: "state",
      header: t("stores.field.state"),
      cell: (s: StoreRow) => <StoreStateBadge isActive={s.is_active} />,
      sortable: true,
    },
  ];
}

/** Active stores first when ascending; a store with no state is last. */
function storeSortValue(s: StoreRow, key: string): SortValue {
  if (key === "state") return s.is_active === undefined ? null : Number(!s.is_active);
  return key === "code" ? s.code : s.name;
}

/**
 * The sort belongs to the tenant it was chosen under and is dropped when the
 * active tenant changes (UX-10: scope changes reset what no longer applies). `GET /api/v1/stores` returns the tenant's
 * COMPLETE roster (no cursor, limit or cap), so ordering it here is
 * dataset-level, not a viewport sort of loaded pages.
 */
interface StoreSort {
  readonly tenantId: string | null;
  readonly sort: SortState | null;
}

/** A retryable 5xx gets a warning with a reload; any other failure a danger banner. */
function StoreListError({
  error,
  onRetry,
}: Readonly<{ error: Rf2ErrorRender; onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  const requestId = "requestId" in error ? error.requestId : undefined;
  if (error.kind === "banner" && error.retryable) {
    return (
      <Banner
        variant="warning"
        title={t("stores.list.loadFailedTitle")}
        message={t("stores.list.loadFailedBody")}
        requestId={requestId}
        action={
          <button type="button" className="btn-secondary" onClick={onRetry}>
            {t("stores.list.retry")}
          </button>
        }
      />
    );
  }
  return <Banner variant="danger" message={t(error.messageKey)} requestId={requestId} />;
}

export function StoreList(): React.JSX.Element {
  const t = useT();
  const { activeTenantId, activeTenantName } = useStoreScope();
  const { result, isLoading, refetch } = useStoreList(activeTenantId);
  const navigate = useNavigate();
  const [chosen, setChosen] = useState<StoreSort>({ tenantId: null, sort: null });
  // A scope change drops the stored sort itself (not only its view), so coming
  // back to an earlier tenant cannot resurrect it.
  if (chosen.tenantId !== activeTenantId && chosen.sort !== null) {
    setChosen({ tenantId: activeTenantId, sort: null });
  }

  // Pre-gate: no active tenant -> scope prompt, no listStores issued (OQ-4).
  if (!activeTenantId) {
    return <ScopePrompt />;
  }
  // Residual scope-401 -> scope prompt, NOT a sign-out (OQ-4).
  if (result?.kind === "error" && result.render.kind === "scope-required") {
    return <ScopePrompt />;
  }

  const sort = chosen.tenantId === activeTenantId ? chosen.sort : null;
  const rows = sortRows(
    result?.kind === "rows" ? result.rows : [],
    sort,
    storeSortValue,
    intlTag(t.locale),
  );
  // Any failure is an error render, never the zero-row empty state.
  const error = result?.kind === "error" ? result.render : undefined;
  const ready = !isLoading && !error;

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("stores.list.title")}</h1>
          <p className="content__sub">
            {t.rich("stores.list.sub", { tenant: <bdi>{activeTenantName}</bdi> })}
          </p>
        </div>
        <Link to="/stores/new" className="btn-primary">
          {t("stores.list.add")}
        </Link>
      </header>

      {error ? <StoreListError error={error} onRetry={refetch} /> : null}

      {isLoading ? (
        <DataTableSkeleton
          caption={t("stores.list.caption")}
          columns={storeColumns(t)}
          label={t("stores.list.loadingNoun")}
        />
      ) : null}

      {ready && rows.length === 0 ? (
        <ListState
          state="empty"
          emptyMessage={t("stores.list.empty")}
          emptyHint={t("stores.list.emptyHint")}
        />
      ) : null}

      {ready && rows.length > 0 ? (
        <DataTable
          caption={t("stores.list.caption")}
          columns={storeColumns(t)}
          rows={rows}
          rowKey={(s) => s.id}
          onRowActivate={(s) => navigate(`/stores/${s.id}`)}
          sort={sort}
          onSortChange={(next) => setChosen({ tenantId: activeTenantId, sort: next })}
        />
      ) : null}
    </div>
  );
}
