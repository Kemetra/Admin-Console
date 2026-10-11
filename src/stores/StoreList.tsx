import { Banner } from "@/components/Banner";
import { DataTable } from "@/components/DataTable";
import { ListState } from "@/components/ListState";
import { type T, useT } from "@/i18n";
/**
 * SF-S1 — Store roster (T026). Scoped to the ACTIVE TENANT read from RF-1's
 * provider. Pre-gate (OQ-4): with no active tenant we render the scope prompt
 * and never issue `listStores` (the scope-401 is avoided, not a sign-out). With
 * an active tenant, the backend-scoped store set renders as a table (no client
 * filter, OQ-2); zero rows is a successful empty state (OQ-8).
 *
 * A residual `401` (scope went stale after the gate) maps to `scope-required`
 * and renders the scope prompt, still never a sign-out. 403 → persistent banner;
 * 5xx → retryable banner.
 */
import { Link, useNavigate } from "react-router";
import { ScopePrompt } from "./ScopePrompt";
import { useStoreList } from "./useStoreQueries";
import { useStoreScope } from "./useStoreScope";
import "../shell/surface.css";

type StoreRow = { id: string; code: string; name: string; is_active?: boolean };

function storeColumns(t: T) {
  return [
    { key: "name", header: t("stores.field.name"), cell: (s: StoreRow) => s.name },
    {
      key: "code",
      header: t("stores.field.code"),
      cell: (s: StoreRow) => <bdi dir="ltr">{s.code}</bdi>,
      mono: true,
    },
    {
      key: "state",
      header: t("stores.field.state"),
      cell: (s: StoreRow) => (
        <span className={s.is_active === false ? "badge badge--suspended" : "badge badge--active"}>
          {t(s.is_active === false ? "stores.state.inactive" : "stores.state.active")}
        </span>
      ),
    },
  ];
}

/**
 * A business-authored name inside a plain-string message (a `string` prop),
 * isolated with FSI/PDI: the text equivalent of <bdi>, so a Latin name can't
 * reorder the Arabic sentence around it.
 */
function isolate(name: string | null): string {
  return `\u2068${name ?? ""}\u2069`;
}

export function StoreList(): React.JSX.Element {
  const t = useT();
  const { activeTenantId, activeTenantName } = useStoreScope();
  const { result, isLoading, refetch } = useStoreList(activeTenantId);
  const navigate = useNavigate();

  // Pre-gate: no active tenant -> scope prompt, no listStores issued (OQ-4).
  if (!activeTenantId) {
    return <ScopePrompt />;
  }
  // Residual scope-401 -> scope prompt, NOT a sign-out (OQ-4).
  if (result?.kind === "error" && result.render.kind === "scope-required") {
    return <ScopePrompt />;
  }

  const rows = result?.kind === "rows" ? result.rows : [];
  const error =
    result?.kind === "error" && result.render.kind === "banner" ? result.render : undefined;

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("stores.list.title")}</h1>
          <p className="content__sub">
            {t.rich("stores.list.sub", { tenant: <bdi>{activeTenantName}</bdi> })}
          </p>
        </div>
        {!isLoading && !error && rows.length > 0 ? (
          <Link to="/stores/new" className="btn-primary">
            {t("stores.list.add")}
          </Link>
        ) : null}
      </header>

      {error ? (
        <Banner
          variant="danger"
          message={t(error.messageKey)}
          requestId={error.requestId}
          action={
            error.retryable ? (
              <button type="button" className="btn-ghost" onClick={refetch}>
                {t("stores.list.retry")}
              </button>
            ) : undefined
          }
        />
      ) : null}

      {isLoading ? <ListState state="loading" label={t("stores.list.loadingNoun")} /> : null}

      {!isLoading && !error && rows.length === 0 ? (
        <ListState
          state="empty"
          emptyMessage={t("stores.list.empty", { tenant: isolate(activeTenantName) })}
          action={
            <Link to="/stores/new" className="btn-primary">
              {t("stores.list.add")}
            </Link>
          }
        />
      ) : null}

      {!isLoading && !error && rows.length > 0 ? (
        <DataTable
          caption={t("stores.list.caption")}
          columns={storeColumns(t)}
          rows={rows}
          rowKey={(s) => s.id}
          onRowActivate={(s) => navigate(`/stores/${s.id}`)}
        />
      ) : null}
    </div>
  );
}
