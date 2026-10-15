import { Banner } from "@/components/Banner";
import { Drawer } from "@/components/Drawer";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, Money, useT } from "@/i18n";
import { type RemittanceReconcileBody, consoleReconcileRemittance } from "@/lib/client";
import { textField } from "@/lib/form-field";
/**
 * 018 ReconcileRemittance drawer. Records a remittance against a claim
 * (RemittanceReconcile: remittedAmount Money [may be 0 = full rejection] +
 * optional opaque remittanceRef) and renders the returned ReconciliationResult
 * (claimed / remitted / variance + outcome settled|partial|flagged). Client-
 * validates first (validateRemittanceDraft — wrapper NOT called on invalid),
 * sends a per-submit Idempotency-Key, routes via classifyWriteOutcome. Mirrors
 * 018's SubmitClaim. Completes 018's write surface.
 *
 * RT-399: claimed / remitted / signed variance render through <Money>
 * (`1,250.00 EGP`, `-1,250.50 EGP`), formatted from the exact-decimal string;
 * the typed remittedAmount is sent to the API unchanged. State keeps message
 * KEYS, never translated strings; the outcome renders as a localized label.
 */
import { useState } from "react";
import { type ReceivableFieldError, validateRemittanceDraft } from "./receivableForms";
import { reconciliationOutcomeKey } from "./receivableListLogic";
import { type WriteCopy, classifyWriteOutcome, newIdempotencyKey } from "./settlementWriteOutcome";

const RECONCILE_COPY: WriteCopy = {
  validation: "receivables.reconcile.errors.validation",
  unauthenticated: "receivables.errors.sessionExpired",
  forbidden: "receivables.reconcile.errors.forbidden",
  conflict: "receivables.reconcile.errors.conflict",
  error: "receivables.reconcile.errors.generic",
};

export interface ReconcileRemittanceProps {
  claimRef: string;
  onClose: () => void;
  onReconciled: () => void;
}

interface ReconciliationResultView {
  claimedAmount: string;
  remittedAmount: string;
  variance: string;
  outcome: "settled" | "partial" | "flagged";
}

type BannerState = { variant: "danger" | "warning"; messageKey: MessageKey; requestId?: string };

export function ReconcileRemittance({
  claimRef,
  onClose,
  onReconciled,
}: ReconcileRemittanceProps): React.JSX.Element {
  const t = useT();
  const [amountError, setAmountError] = useState<ReceivableFieldError | undefined>();
  const [banner, setBanner] = useState<BannerState | undefined>();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ReconciliationResultView | undefined>();

  async function submitWithKey(body: RemittanceReconcileBody, key: string): Promise<void> {
    const res = await consoleReconcileRemittance(claimRef, body, key);
    const outcome = classifyWriteOutcome(
      {
        status: res.status,
        headers: res.headers,
        error: res.error as { error?: { code?: string; request_id?: string } } | undefined,
      },
      RECONCILE_COPY,
    );
    switch (outcome.kind) {
      case "ok":
      case "replayed":
        setResult(res.data as ReconciliationResultView | undefined);
        onReconciled();
        return;
      case "validation":
        setAmountError({ messageKey: outcome.messageKey });
        return;
      case "regenerate-key":
        await submitWithKey(body, newIdempotencyKey());
        return;
      case "unauthenticated":
        setBanner({ variant: "warning", messageKey: outcome.messageKey });
        return;
      default:
        // forbidden / key-conflict / conflict / error: each carries its own copy.
        setBanner({
          variant: "danger",
          messageKey: outcome.messageKey,
          requestId: outcome.requestId,
        });
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setAmountError(undefined);
    setBanner(undefined);

    const form = new FormData(e.currentTarget);
    const remittedAmount = textField(form, "remittedAmount");
    const remittanceRef = (textField(form, "remittanceRef").trim() || null) as string | null;

    const errors = validateRemittanceDraft({ remittedAmount });
    if (errors.remittedAmount) {
      setAmountError(errors.remittedAmount);
      return; // client guard: wrapper NOT called on an invalid amount
    }

    setPending(true);
    try {
      await submitWithKey({ remittedAmount, remittanceRef }, newIdempotencyKey());
    } finally {
      setPending(false);
    }
  }

  return (
    <Drawer title={t("receivables.reconcile.title")} onClose={onClose}>
      {banner ? (
        <Banner
          variant={banner.variant}
          message={t(banner.messageKey)}
          requestId={banner.requestId}
        />
      ) : null}

      {result ? (
        <div className="surface__result">
          <p className="surface__scope-line">
            {t.rich("receivables.reconcile.outcome", {
              outcome: <span className="badge">{t(reconciliationOutcomeKey(result.outcome))}</span>,
            })}
          </p>
          <dl className="data-pairs">
            <div>
              <dt>{t("receivables.reconcile.claimed")}</dt>
              <dd>
                <Money value={result.claimedAmount} />
              </dd>
            </div>
            <div>
              <dt>{t("receivables.reconcile.remitted")}</dt>
              <dd>
                <Money value={result.remittedAmount} />
              </dd>
            </div>
            <div>
              <dt>{t("receivables.reconcile.variance")}</dt>
              {/* Signed: a negative variance renders `-1,250.50 EGP` inside the LTR isolate. */}
              <dd>
                <Money value={result.variance} />
              </dd>
            </div>
          </dl>
          <div className="surface__actions">
            <button type="button" className="btn-primary" onClick={onClose}>
              {t("receivables.reconcile.done")}
            </button>
          </div>
        </div>
      ) : (
        <form className="surface__form" onSubmit={onSubmit} noValidate>
          <p className="surface__scope-line">
            {t.rich("receivables.reconcile.scopeLine", {
              claim: (
                <strong>
                  <bdi dir="ltr">{claimRef}</bdi>
                </strong>
              ),
            })}
          </p>
          <div className="field">
            <label htmlFor="remitted-amount">{t("receivables.reconcile.amount")}</label>
            <input
              id="remitted-amount"
              name="remittedAmount"
              className="input"
              inputMode="decimal"
              aria-invalid={amountError ? "true" : undefined}
              aria-describedby={amountError ? "remitted-amount-error" : undefined}
              autoComplete="off"
            />
            <span id="remitted-amount-error">
              <InlineError
                message={amountError ? t(amountError.messageKey, amountError.params) : undefined}
              />
            </span>
          </div>
          <div className="field">
            <label htmlFor="remittance-ref">{t("receivables.reconcile.reference")}</label>
            <input
              id="remittance-ref"
              name="remittanceRef"
              className="input"
              placeholder={t("receivables.reconcile.referencePlaceholder")}
              autoComplete="off"
            />
          </div>
          <div className="surface__actions">
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? <span className="spinner" aria-hidden="true" /> : null}
              {t("receivables.reconcile.submit")}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}
    </Drawer>
  );
}
