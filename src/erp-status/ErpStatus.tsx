/**
 * RT-560 — ERP connection & sync status (spec 016 Phase A, read-only), for
 * owner / tenant_admin. Four panels over Backend-Core only: the connector
 * connection (C1 ⋈ C2), the sync summary, the posting backlog and the
 * reconciliation run history (C3).
 *
 * Gate first: any other role gets the existing NoAccess state and nothing is
 * requested (A-6). The server stays the authority; the gate mirrors its roles.
 * The store filter lives in the URL (`?store=`), offers only the caller's
 * in-scope stores, and narrows the three C3 panels; the connection is
 * tenant-wide. An out-of-scope store is the API's non-disclosing 404.
 */
import { NoAccess } from "@/auth/NoAccess";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { useT } from "@/i18n";
import { type ScopeMembership, scopeMenuStores } from "@/shell/scope-stores";
import { useSignOut } from "@/shell/useSignOut";
import { useStoreList } from "@/stores/useStoreQueries";
import { useSearchParams } from "react-router";
import { ConnectionPanel } from "./ConnectionPanel";
import { PostingBacklog } from "./PostingBacklog";
import { ReconciliationRuns } from "./ReconciliationRuns";
import { type FilterStore, StoreFilter } from "./StoreFilter";
import { SyncSummary } from "./SyncSummary";
import { canReadErpStatus, isStoreFilter } from "./erpStatusLogic";
import {
  type ErpError,
  type ErpQuery,
  type ErpScope,
  type PanelState,
  useConnections,
  useErpScope,
  usePostingBacklog,
  useReconciliationRuns,
  useSyncSummary,
} from "./useErpStatus";
import "../shell/surface.css";
import "./erp-status.css";

/** The caller's in-scope stores for the filter (the scope menu's own rule, RT-354). */
function useFilterStores(tenantId: string | null): FilterStore[] {
  const { context } = useActiveContextValue();
  const { result } = useStoreList(tenantId);
  const rows = result?.kind === "rows" ? result.rows : [];
  const membership = context?.memberships?.find((m) => m.tenant_id === tenantId) as
    | ScopeMembership
    | undefined;
  return scopeMenuStores(rows, membership, null).map((s) => ({ id: s.id, name: s.name }));
}

const MALFORMED_STORE: ErpError = { kind: "not-found" };

/** A malformed store filter is never sent: its panels read not-found, like an out-of-scope store. */
function notFoundUnless<S extends PanelState>(valid: boolean, state: S): S {
  if (valid) return state;
  const inert = () => {};
  return {
    ...state,
    isLoading: false,
    error: MALFORMED_STORE,
    inlineError: undefined,
    asOf: undefined,
    retry: inert,
    ...("loadMore" in state ? { loadMore: inert, hasMore: false } : {}),
  };
}

function ErpStatusContent({ scope }: Readonly<{ scope: ErpScope }>): React.JSX.Element {
  const t = useT();
  const [search, setSearch] = useSearchParams();
  const storeId = search.get("store") ?? "";
  const stores = useFilterStores(scope.tenantId);

  const validStore = isStoreFilter(storeId);

  // A malformed store filter closes the C3 gate: those panels read not-found.
  const c3: ErpQuery = { tenantId: scope.tenantId, storeId, enabled: validStore };

  const connections = useConnections({ tenantId: scope.tenantId, storeId: "", enabled: true });
  const summary = notFoundUnless(validStore, useSyncSummary(c3));
  const backlog = notFoundUnless(validStore, usePostingBacklog(c3));
  const runs = notFoundUnless(validStore, useReconciliationRuns(c3));
  const nameOf = (id: string) => stores.find((s) => s.id === id)?.name;

  const refreshAll = () => {
    for (const panel of [connections, summary, backlog, runs]) panel.retry();
  };

  return (
    <div className="surface erp-surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("erp.title")}</h1>
          <p className="content__sub">
            {t.rich("erp.sub", { tenant: <bdi>{scope.tenantName}</bdi> })}
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={refreshAll}>
          {t("erp.refresh")}
        </button>
      </header>

      <ConnectionPanel state={connections} />

      <StoreFilter
        stores={stores}
        value={storeId}
        onChange={(next) => setSearch(next ? new URLSearchParams({ store: next }) : {})}
      />
      <SyncSummary state={summary} />
      <PostingBacklog list={backlog} />
      <ReconciliationRuns list={runs} nameOf={nameOf} />
    </div>
  );
}

export function ErpStatus(): React.JSX.Element {
  const t = useT();
  const scope = useErpScope();
  const signOut = useSignOut();
  if (!canReadErpStatus(scope.role)) return <NoAccess onSignOut={signOut} />;
  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("erp.scopePrompt")}</p>
      </div>
    );
  }
  return <ErpStatusContent scope={scope} />;
}
