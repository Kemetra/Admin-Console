import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { useT } from "@/i18n";
/**
 * 017 SF1 — Payer-account list. Renders the active tenant's payer accounts as a
 * `.data-table` (displayName, category badge, status badge). Pre-call guard
 * (no active tenant → scope prompt, the list wrapper is never issued). 403/other
 * → banner. Empty → zero-state with the Create primary.
 *
 * `status` is DISPLAY-ONLY (OQ-CON-EDIT deferred to v1.1 — no edit/suspend op).
 * The create drawer is wired separately (PayerCreate); this list exposes the
 * Create affordance and refetches on success.
 *
 * RT-399: copy comes from the catalog; `category` / `status` render as
 * localized labels (the raw API values never show).
 */
import { useState } from "react";
import { PayerCreate } from "./PayerCreate";
import { payerCategoryKey, payerStatusKey } from "./payerListLogic";
import { type PayerCategory, usePayerAccounts } from "./usePayerAccounts";
import "../shell/surface.css";

interface PayerRowView {
  payerRef: string;
  displayName: string;
  category: PayerCategory;
  status: "active" | "suspended";
}

function ScopePrompt(): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      <p className="content__sub">{t("payers.list.scopePrompt")}</p>
    </div>
  );
}

export function PayerList(): React.JSX.Element {
  const t = useT();
  const { context } = useActiveContextValue();
  const rawTenant = context?.active_tenant ?? null;
  const { rows, isLoading, error, refetch } = usePayerAccounts(rawTenant?.id ?? null, {});
  const [creating, setCreating] = useState(false);

  // Pre-call guard: no active tenant -> scope prompt, list wrapper never issued.
  if (!rawTenant?.id) {
    return <ScopePrompt />;
  }
  const tenantName = rawTenant.name ?? rawTenant.id;
  const payers = rows as unknown as PayerRowView[];

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("payers.list.title")}</h1>
          <p className="content__sub">
            {t.rich("payers.list.subtitle", { tenant: <bdi>{tenantName}</bdi> })}
          </p>
        </div>
        {!isLoading && !error && payers.length > 0 ? (
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            {t("payers.list.create")}
          </button>
        ) : null}
      </header>

      {error ? (
        <Banner
          variant="danger"
          message={
            error.kind === "forbidden" ? t("payers.list.forbidden") : t("payers.list.loadFailed")
          }
          requestId={error.requestId}
        />
      ) : null}

      {isLoading ? <ListState state="loading" label={t("payers.list.loadingNoun")} /> : null}

      {!isLoading && !error && payers.length === 0 ? (
        <ListState
          state="empty"
          emptyMessage={t("payers.list.empty")}
          action={
            <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
              {t("payers.list.create")}
            </button>
          }
        />
      ) : null}

      {!isLoading && !error && payers.length > 0 ? (
        <table className="data-table">
          <caption className="data-table__caption">{t("payers.list.caption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("payers.list.col.payer")}</th>
              <th scope="col">{t("payers.list.col.category")}</th>
              <th scope="col">{t("payers.list.col.status")}</th>
            </tr>
          </thead>
          <tbody>
            {payers.map((row) => (
              <tr key={row.payerRef} className="data-table__row">
                <td>{row.displayName}</td>
                <td>
                  <span className="badge">{t(payerCategoryKey(row.category))}</span>
                </td>
                <td>
                  {row.status === "suspended" ? (
                    <span className="badge badge--suspended">{t(payerStatusKey(row.status))}</span>
                  ) : (
                    <span className="badge">{t(payerStatusKey(row.status))}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {creating ? (
        <PayerCreate
          activeTenant={{ id: rawTenant.id, name: tenantName }}
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
