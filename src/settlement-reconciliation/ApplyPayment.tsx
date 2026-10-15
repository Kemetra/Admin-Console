import { Banner } from "@/components/Banner";
import { Drawer } from "@/components/Drawer";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, Money, useT } from "@/i18n";
import { type PaymentApplicationBody, consoleApplyPayment } from "@/lib/client";
import { textField } from "@/lib/form-field";
import { receivableStateKey } from "@/receivables/receivableListLogic";
import {
  type WriteCopy,
  classifyWriteOutcome,
  newIdempotencyKey,
} from "@/receivables/settlementWriteOutcome";
/**
 * 019 ApplyPayment drawer — 019's own cash-application surface (consoleApplyPayment,
 * DP-2-owned operational truth 7-C). Validates the amount (>0; wrapper NOT called
 * on invalid) → consoleApplyPayment(receivableRef, { amount, version }, key) with a
 * per-submit Idempotency-Key → classifyWriteOutcome. On 200 renders the updated
 * receivable (new outstandingBalance + state partially_applied|settled). version
 * is the receivable's optimistic-concurrency token — a stale version → 409. The
 * 032 posting-retry surface is NOT here (GATED on 032/G7). Mirrors the reconcile
 * drawer; reuses the shared write-outcome classifier.
 *
 * RT-399: outstanding balances render through <Money> (`1,250.00 EGP`),
 * formatted from the exact-decimal string; the typed amount is sent to the API
 * unchanged. State keeps message KEYS, never translated strings; the receivable
 * state renders as a localized label.
 */
import { useState } from "react";
import { validateApplyPaymentDraft } from "./applyPaymentForm";

const APPLY_COPY: WriteCopy = {
  validation: "settlement.apply.errors.validation",
  unauthenticated: "settlement.apply.errors.sessionExpired",
  forbidden: "settlement.apply.errors.forbidden",
  // A 409 here is most often a STALE version (the receivable changed since
  // load) — non-disclosing; the operator should re-open the receivable.
  conflict: "settlement.apply.errors.conflict",
  error: "settlement.apply.errors.generic",
};

export interface ApplyPaymentProps {
  receivable: { receivableRef: string; outstandingBalance: string; version: number };
  onClose: () => void;
  onApplied: () => void;
}

interface ReceivableView {
  outstandingBalance: string;
  state: "open" | "partially_applied" | "settled" | "claimed" | "flagged";
}

type BannerState = { variant: "danger" | "warning"; messageKey: MessageKey; requestId?: string };

export function ApplyPayment({
  receivable,
  onClose,
  onApplied,
}: Readonly<ApplyPaymentProps>): React.JSX.Element {
  const t = useT();
  const [amountError, setAmountError] = useState<MessageKey | undefined>();
  const [banner, setBanner] = useState<BannerState | undefined>();
  const [pending, setPending] = useState(false);
  const [updated, setUpdated] = useState<ReceivableView | undefined>();

  async function submitWithKey(body: PaymentApplicationBody, key: string): Promise<void> {
    const res = await consoleApplyPayment(receivable.receivableRef, body, key);
    const outcome = classifyWriteOutcome(
      {
        status: res.status,
        headers: res.headers,
        error: res.error as { error?: { code?: string; request_id?: string } } | undefined,
      },
      APPLY_COPY,
    );
    switch (outcome.kind) {
      case "ok":
      case "replayed":
        setUpdated(res.data as ReceivableView | undefined);
        onApplied();
        return;
      case "validation":
        setAmountError(outcome.messageKey);
        return;
      case "regenerate-key":
        await submitWithKey(body, newIdempotencyKey());
        return;
      case "unauthenticated":
        setBanner({ variant: "warning", messageKey: outcome.messageKey });
        return;
      default:
        // forbidden / key-conflict / conflict (stale version) / error: each
        // carries its own copy (see APPLY_COPY).
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
    const amount = textField(form, "amount");
    const note = (textField(form, "note").trim() || null) as string | null;

    const errors = validateApplyPaymentDraft({ amount, version: receivable.version });
    if (errors.amount || errors.version) {
      setAmountError(errors.amount ?? errors.version);
      return;
    }

    setPending(true);
    try {
      await submitWithKey({ amount, version: receivable.version, note }, newIdempotencyKey());
    } finally {
      setPending(false);
    }
  }

  return (
    <Drawer title={t("settlement.apply.title")} onClose={onClose}>
      {banner ? (
        <Banner
          variant={banner.variant}
          message={t(banner.messageKey)}
          requestId={banner.requestId}
        />
      ) : null}

      {updated ? (
        <div className="surface__result">
          <p className="surface__scope-line">
            {t.rich("settlement.apply.result", {
              state: <span className="badge">{t(receivableStateKey(updated.state))}</span>,
            })}
          </p>
          <dl className="data-pairs">
            <div>
              <dt>{t("settlement.apply.outstanding")}</dt>
              <dd>
                <Money value={updated.outstandingBalance} />
              </dd>
            </div>
          </dl>
          <div className="surface__actions">
            <button type="button" className="btn-primary" onClick={onClose}>
              {t("settlement.apply.done")}
            </button>
          </div>
        </div>
      ) : (
        <form className="surface__form" onSubmit={onSubmit} noValidate>
          <p className="surface__scope-line">
            {t.rich("settlement.apply.scopeLine", {
              receivable: (
                <strong>
                  <bdi dir="ltr">{receivable.receivableRef}</bdi>
                </strong>
              ),
              balance: (
                <strong>
                  <Money value={receivable.outstandingBalance} />
                </strong>
              ),
            })}
          </p>
          <div className="field">
            <label htmlFor="apply-amount">{t("settlement.apply.amount")}</label>
            <input
              id="apply-amount"
              name="amount"
              className="input"
              inputMode="decimal"
              aria-invalid={amountError ? "true" : undefined}
              aria-describedby={amountError ? "apply-amount-error" : undefined}
              autoComplete="off"
            />
            <span id="apply-amount-error">
              <InlineError message={amountError ? t(amountError) : undefined} />
            </span>
          </div>
          <div className="field">
            <label htmlFor="apply-note">{t("settlement.apply.note")}</label>
            <input id="apply-note" name="note" className="input" autoComplete="off" />
          </div>
          <div className="surface__actions">
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? <span className="spinner" aria-hidden="true" /> : null}
              {t("settlement.apply.submit")}
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
