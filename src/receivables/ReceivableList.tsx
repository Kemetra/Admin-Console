import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { Money, useT } from "@/i18n";
import type { ReceivableState } from "@/lib/client";
import { ApplyPayment } from "@/settlement-reconciliation/ApplyPayment";
/**
 * 018 SF — Receivable list. Table of the active tenant's receivables: payer +
 * sale refs, outstanding balance (exact-decimal Money formatted from the string
 * as `1,250.00 EGP` — never float-coerced), lifecycle-state badge, and the ERP Payment-Entry pointer
 * ("not posted" until the 011-DR-POSTING-R1 gate clears → erpnextPaymentEntryRef
 * is null). Pre-call guard (no tenant → scope prompt, wrapper never issued).
 * 403/other → banner. Read-only here; claim-submit + reconcile drawers wire in
 * 018-D. Mirrors 017's PayerList.
 *
 * RT-399: copy comes from the catalog; `state` renders as a localized label
 * (the raw API value never shows); refs are LTR-isolated machine data.
 */
import { useState } from "react";
import { ReconcileRemittance } from "./ReconcileRemittance";
import { SubmitClaim } from "./SubmitClaim";
import { receivableStateKey } from "./receivableListLogic";
import { useReceivables } from "./useReceivables";
import "../shell/surface.css";

interface ReceivableRowView {
  receivableRef: string;
  saleRef: string;
  payerRef: string;
  outstandingBalance: string;
  state: ReceivableState;
  erpnextPaymentEntryRef: string | null;
  version: number;
}

function ScopePrompt(): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      <p className="content__sub">{t("receivables.list.scopePrompt")}</p>
    </div>
  );
}

export function ReceivableList(): React.JSX.Element {
  const t = useT();
  const { context } = useActiveContextValue();
  const rawTenant = context?.active_tenant ?? null;
  const { rows, isLoading, error, refetch } = useReceivables(rawTenant?.id ?? null, {});
  const [claiming, setClaiming] = useState<{ payerRef: string; receivableRefs: string[] } | null>(
    null,
  );
  // After a claim is submitted, offer reconcile on its returned claimRef.
  const [reconciling, setReconciling] = useState<string | null>(null);
  // 019 apply-payment (cash application) against a selected receivable.
  const [applying, setApplying] = useState<ReceivableRowView | null>(null);

  if (!rawTenant?.id) {
    return <ScopePrompt />;
  }
  const tenantName = rawTenant.name ?? rawTenant.id;
  const receivables = rows as unknown as ReceivableRowView[];

  // Claimable = open/partially_applied receivables, grouped by payer for the claim.
  const claimable = receivables.filter(
    (r) => r.state === "open" || r.state === "partially_applied",
  );
  function startClaim(payerRef: string): void {
    setClaiming({
      payerRef,
      receivableRefs: claimable.filter((r) => r.payerRef === payerRef).map((r) => r.receivableRef),
    });
  }

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("receivables.list.title")}</h1>
          <p className="content__sub">
            {t.rich("receivables.list.subtitle", { tenant: <bdi>{tenantName}</bdi> })}
          </p>
        </div>
      </header>

      {error ? (
        <Banner
          variant="danger"
          message={
            error.kind === "forbidden"
              ? t("receivables.list.forbidden")
              : t("receivables.list.loadFailed")
          }
          requestId={error.requestId}
        />
      ) : null}

      {isLoading ? <ListState state="loading" label={t("receivables.list.loadingNoun")} /> : null}

      {!isLoading && !error && receivables.length === 0 ? (
        <ListState state="empty" emptyMessage={t("receivables.list.empty")} />
      ) : null}

      {!isLoading && !error && receivables.length > 0 ? (
        <table className="data-table">
          <caption className="data-table__caption">{t("receivables.list.caption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("receivables.list.col.receivable")}</th>
              <th scope="col">{t("receivables.list.col.payer")}</th>
              <th scope="col">{t("receivables.list.col.outstanding")}</th>
              <th scope="col">{t("receivables.list.col.state")}</th>
              <th scope="col">{t("receivables.list.col.erpPosting")}</th>
              <th scope="col">{t("receivables.list.col.action")}</th>
            </tr>
          </thead>
          <tbody>
            {receivables.map((row) => (
              <tr key={row.receivableRef} className="data-table__row">
                <td>
                  <bdi dir="ltr">{row.receivableRef}</bdi>
                </td>
                <td>
                  <bdi dir="ltr">{row.payerRef}</bdi>
                </td>
                {/* Exact-decimal Money string — formatted from the string, never coerced. */}
                <td>
                  <Money value={row.outstandingBalance} />
                </td>
                <td>
                  <span className="badge">{t(receivableStateKey(row.state))}</span>
                </td>
                <td>
                  {row.erpnextPaymentEntryRef != null ? (
                    <bdi dir="ltr">{row.erpnextPaymentEntryRef}</bdi>
                  ) : (
                    t("receivables.list.notPosted")
                  )}
                </td>
                <td>
                  {row.state === "open" || row.state === "partially_applied" ? (
                    <>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setApplying(row)}
                      >
                        {t("receivables.list.applyPayment")}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => startClaim(row.payerRef)}
                      >
                        {t("receivables.list.submitClaim")}
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {claiming ? (
        <SubmitClaim
          activeTenant={{ id: rawTenant.id, name: tenantName }}
          payerRef={claiming.payerRef}
          receivableRefs={claiming.receivableRefs}
          onClose={() => setClaiming(null)}
          onSubmitted={(claimRef) => {
            setClaiming(null);
            refetch();
            // Offer remittance reconciliation on the freshly-submitted claim.
            if (claimRef) setReconciling(claimRef);
          }}
        />
      ) : null}

      {reconciling ? (
        <ReconcileRemittance
          claimRef={reconciling}
          onClose={() => setReconciling(null)}
          onReconciled={() => refetch()}
        />
      ) : null}

      {applying ? (
        <ApplyPayment
          receivable={{
            receivableRef: applying.receivableRef,
            outstandingBalance: applying.outstandingBalance,
            version: applying.version,
          }}
          // Keep the drawer open on success so it can render the updated receivable
          // (its result view + "Done" button close it); refetch the list underneath.
          onClose={() => setApplying(null)}
          onApplied={() => refetch()}
        />
      ) : null}
    </div>
  );
}
