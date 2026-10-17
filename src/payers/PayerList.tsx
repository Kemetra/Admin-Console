import { NoAccess } from "@/auth/NoAccess";
import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { type MessageKey, useT } from "@/i18n";
import { useSignOut } from "@/shell/useSignOut";
/**
 * 017 SF1 — Payer-account list, for owner / tenant_admin (RT-421). Renders the
 * active tenant's payer accounts as a `.data-table` (payer, category, scope,
 * ERPNext Customer, status). Gate first: any other role gets NoAccess and
 * nothing is requested (the API is the authority; the gate mirrors its roles).
 * Pre-call guard (no active tenant → scope prompt, the list wrapper is never
 * issued). Errors → banner (the server's words never show). Empty → zero-state
 * with the Create primary.
 *
 * Keyset paging: a page can be empty while its cursor is non-null, so the
 * zero-state shows only when there is no cursor either; otherwise the surface
 * offers "Load more". A failed continuation keeps the rows already shown.
 *
 * `status` is DISPLAY-ONLY (OQ-CON-EDIT deferred to v1.1 — no edit/suspend op).
 * `externalRef` is the payer's ERPNext Customer link. The create drawer is wired
 * separately (PayerCreate); this list exposes the Create affordance and
 * refetches on success.
 *
 * RT-399: copy comes from the catalog; `category` / `status` render as
 * localized labels (the raw API values never show).
 */
import { useState } from "react";
import { PayerCreate } from "./PayerCreate";
import { canReadPayers } from "./payerAccess";
import { type PayerRow, payerCategoryKey, payerScope, payerStatusKey } from "./payerListLogic";
import { type PayerAccountsValue, type PayerListError, usePayerAccounts } from "./usePayerAccounts";
import { usePayerStores } from "./usePayerStores";
import "../shell/surface.css";

function ScopePrompt(): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      <p className="content__sub">{t("payers.list.scopePrompt")}</p>
    </div>
  );
}

const ERROR_COPY: Record<PayerListError["kind"], MessageKey> = {
  session: "payers.list.sessionExpired",
  forbidden: "payers.list.forbidden",
  generic: "payers.list.loadFailed",
};

function PayerRowView({
  row,
  stores,
}: Readonly<{ row: PayerRow; stores: readonly { id: string; name?: string }[] }>) {
  const t = useT();
  const scope = payerScope(row, stores);
  return (
    <tr className="data-table__row">
      <td>{row.displayName}</td>
      <td>
        <span className="badge">{t(payerCategoryKey(row.category))}</span>
      </td>
      <td>
        {scope.kind === "tenant" ? (
          t("payers.scope.tenant")
        ) : (
          <bdi>{scope.name ?? t("payers.scope.store")}</bdi>
        )}
      </td>
      <td>
        {row.externalRef ? (
          <bdi>{row.externalRef}</bdi>
        ) : (
          <span className="content__sub">{t("payers.list.erpCustomerUnlinked")}</span>
        )}
      </td>
      <td>
        {row.status === "suspended" ? (
          <span className="badge badge--suspended">{t(payerStatusKey(row.status))}</span>
        ) : (
          <span className="badge">{t(payerStatusKey(row.status))}</span>
        )}
      </td>
    </tr>
  );
}

/** The list's states and table, split out of PayerList to keep each function readable. */
function PayerListBody({
  state,
  stores,
  createButton,
}: Readonly<{
  state: PayerAccountsValue;
  stores: readonly { id: string; name?: string }[];
  createButton: React.ReactNode;
}>): React.JSX.Element {
  const t = useT();
  const { rows, hasMore, isLoading, isFetchingNextPage, error, loadMore } = state;
  const settled = !isLoading;

  return (
    <>
      {error ? (
        <Banner variant="danger" message={t(ERROR_COPY[error.kind])} requestId={error.requestId} />
      ) : null}

      {state.isLoading ? <ListState state="loading" label={t("payers.list.loadingNoun")} /> : null}

      {settled && !error && rows.length === 0 && !hasMore ? (
        <ListState state="empty" emptyMessage={t("payers.list.empty")} action={createButton} />
      ) : null}

      {settled && !error && rows.length === 0 && hasMore ? (
        <p className="content__sub">{t("payers.list.emptyPage")}</p>
      ) : null}

      {settled && rows.length > 0 ? (
        <table className="data-table">
          <caption className="data-table__caption">{t("payers.list.caption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("payers.list.col.payer")}</th>
              <th scope="col">{t("payers.list.col.category")}</th>
              <th scope="col">{t("payers.list.col.scope")}</th>
              <th scope="col">{t("payers.list.col.erpCustomer")}</th>
              <th scope="col">{t("payers.list.col.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PayerRowView key={row.payerRef} row={row} stores={stores} />
            ))}
          </tbody>
        </table>
      ) : null}

      {settled && hasMore ? (
        <div className="surface__actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={loadMore}
            disabled={isFetchingNextPage}
            aria-busy={isFetchingNextPage || undefined}
          >
            {isFetchingNextPage ? <span className="spinner" aria-hidden="true" /> : null}
            {t("payers.list.loadMore")}
          </button>
        </div>
      ) : null}
    </>
  );
}

export function PayerList(): React.JSX.Element {
  const t = useT();
  const signOut = useSignOut();
  const { context } = useActiveContextValue();
  const rawTenant = context?.active_tenant ?? null;
  const allowed = canReadPayers(context?.active_role_code);
  const tenantId = allowed ? (rawTenant?.id ?? null) : null;
  const list = usePayerAccounts(tenantId, {});
  const { rows, hasMore, isLoading, refetch } = list;
  const stores = usePayerStores(rawTenant?.id ?? null, allowed);
  const [creating, setCreating] = useState(false);

  // Pre-call guard: no active tenant -> scope prompt, list wrapper never issued.
  // (No tenant means no role to judge, and the prompt discloses nothing.)
  if (!rawTenant?.id) {
    return <ScopePrompt />;
  }
  if (!allowed) return <NoAccess onSignOut={signOut} />;
  const tenantName = rawTenant.name ?? rawTenant.id;
  const createButton = (
    <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
      {t("payers.list.create")}
    </button>
  );
  const settled = !isLoading;
  // The header Create shows once there is something listed (or more to walk); the
  // zero-state carries its own, and a failed first load offers neither.
  const showHeaderCreate = settled && (rows.length > 0 || hasMore);

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("payers.list.title")}</h1>
          <p className="content__sub">
            {t.rich("payers.list.subtitle", { tenant: <bdi>{tenantName}</bdi> })}
          </p>
        </div>
        {showHeaderCreate ? createButton : null}
      </header>

      <PayerListBody state={list} stores={stores} createButton={createButton} />

      {creating ? (
        <PayerCreate
          activeTenant={{ id: rawTenant.id, name: tenantName }}
          stores={stores}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refetch();
          }}
        />
      ) : null}
    </div>
  );
}
