import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
/**
 * SF-6-1 — the `/audit` route component (T022/T027). Orchestrates the state
 * matrix (pre-query / loading / rows / empty-after-filter / 403 / generic) over
 * `useAuditSearch`, the filter bar, the table, the pager, and the row-inspect
 * drawer (SF-6-2). Scoped to the active tenant from RF-1's provider; no active
 * tenant → scope prompt (the scope gate normally precedes this).
 *
 * 401 is NOT special-cased (OQ-1): a non-403 non-2xx falls through to the
 * generic banner; the shared interceptor handles a real session expiry.
 */
import { useEffect, useState } from "react";
import { AuditFilters } from "./AuditFilters";
import { AuditInspectDrawer } from "./AuditInspectDrawer";
import { AuditPager } from "./AuditPager";
import { OperatorScopePromptLike } from "./AuditScopePrompt";
import { AuditTable } from "./AuditTable";
import type { AuditFilters as Filters } from "./auditQueryKeys";
import { type AuditRow, useAuditSearch } from "./useAuditSearch";
import "./audit.css";

const EMPTY_FILTERS: Filters = {};

export function AuditSearch(): React.JSX.Element {
  const { context } = useActiveContextValue();
  const activeTenant = context?.active_tenant ?? null;
  const activeStore = context?.active_store ?? null;

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searched, setSearched] = useState(false);
  const [inspecting, setInspecting] = useState<AuditRow | null>(null);

  // S6: a scope switch (RF-1 SF-3) resets BOTH filters and results. The query
  // key re-scopes the data layer, but filters/searched are component state that
  // React preserves across the context change — so reset them here (a stale
  // cross-tenant actor/store filter must not carry into the new scope), and
  // close any open inspect drawer (its row belonged to the prior scope).
  const activeTenantId = activeTenant?.id ?? null;
  const activeStoreId = activeStore?.id ?? null;
  // The scope ids are the intentional re-run TRIGGER (the effect only calls
  // setters); resetting when they change is the whole point of S6.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope ids are the trigger, not consumed values.
  useEffect(() => {
    setFilters(EMPTY_FILTERS);
    setSearched(false);
    setInspecting(null);
  }, [activeTenantId, activeStoreId]);

  const {
    rows,
    hasMore,
    isLoading,
    isFetchingNextPage,
    error,
    continuationError,
    loadMore,
    retryContinuation,
  } = useAuditSearch(activeTenantId, activeStoreId, filters, searched);

  if (!activeTenant) {
    return <OperatorScopePromptLike />;
  }

  function onApply(next: Filters): void {
    setFilters(next);
    setSearched(true);
  }
  function onClear(): void {
    setFilters(EMPTY_FILTERS);
    setSearched(false);
  }

  const showPreQuery = !searched && !error;
  const showEmpty = searched && !isLoading && !error && rows.length === 0;
  const showRows = searched && !isLoading && !error && rows.length > 0;

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">Audit</h1>
          <p className="content__sub">
            {activeTenant.name}
            {activeStore ? ` · ${activeStore.name}` : ""}
          </p>
        </div>
      </header>

      {/* Keyed on scope so the uncontrolled inputs clear on a scope switch (S6). */}
      <AuditFilters
        key={`${activeTenantId}:${activeStoreId}`}
        storeInScope={Boolean(activeStore)}
        onApply={onApply}
        onClear={onClear}
      />

      {error ? (
        <Banner
          variant="danger"
          message={
            error.kind === "forbidden"
              ? "You do not have permission to view audit for this scope."
              : "Audit search failed. Try again."
          }
          requestId={error.requestId}
        />
      ) : null}

      {showPreQuery ? (
        <p className="audit-prequery">Search audit activity for {activeTenant.name}.</p>
      ) : null}

      {isLoading ? <ListState state="loading" label="audit events" /> : null}

      {showEmpty ? (
        <ListState
          state="empty"
          emptyMessage="No audit events match these filters."
          action={
            <button type="button" className="btn-ghost" onClick={onClear}>
              Clear filters
            </button>
          }
        />
      ) : null}

      {showRows ? (
        <>
          <AuditTable rows={rows} onInspect={setInspecting} />
          {/* RT-269 (UX-10): a failed "Load more" keeps the rows above and
              offers a retry of just that page; it replaces "Load more". */}
          {continuationError ? (
            <Banner
              variant="danger"
              message={
                continuationError.kind === "forbidden"
                  ? "Could not load more audit events: you do not have permission. The events above are kept."
                  : "Could not load more audit events. The events above are kept."
              }
              requestId={continuationError.requestId}
              action={
                <button type="button" className="btn-secondary" onClick={retryContinuation}>
                  Retry
                </button>
              }
            />
          ) : null}
          <AuditPager
            loadedCount={rows.length}
            hasMore={hasMore && !continuationError}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={loadMore}
          />
        </>
      ) : null}

      {inspecting ? (
        <AuditInspectDrawer row={inspecting} onClose={() => setInspecting(null)} />
      ) : null}
    </div>
  );
}
