/**
 * 018 claim-submit + remittance-reconcile form validation — pure, no client.
 * Validates only what the consumed contract constrains:
 *   ClaimCreate        — payerRef (uuid, required) + receivableRefs (1..500).
 *   RemittanceReconcile — remittedAmount (Money: non-negative exact-decimal,
 *                         scale ≤4; 0 is valid = full-rejection remittance) +
 *                         optional opaque remittanceRef.
 * The server stays authoritative; this is a fail-fast UX guard. Mirrors 017's
 * payerCreateForm.
 *
 * RT-399: errors are message keys (plus params), translated at render time.
 */
import type { MessageKey, Params } from "@/i18n";

/** A field error: the catalog key and its params, rendered with `t()` at display time. */
export interface ReceivableFieldError {
  messageKey: MessageKey;
  params?: Params;
}

export interface ClaimDraft {
  payerRef: string;
  receivableRefs: string[];
}

export type ClaimDraftErrors = Partial<Record<"payerRef" | "receivableRefs", ReceivableFieldError>>;

const CLAIM_MAX_RECEIVABLES = 500;

export function validateClaimDraft(draft: ClaimDraft): ClaimDraftErrors {
  const errors: ClaimDraftErrors = {};
  if (!draft.payerRef || draft.payerRef.trim().length === 0) {
    errors.payerRef = { messageKey: "receivables.form.payerRequired" };
  }
  const n = draft.receivableRefs.length;
  if (n < 1) {
    errors.receivableRefs = { messageKey: "receivables.form.receivablesRequired" };
  } else if (n > CLAIM_MAX_RECEIVABLES) {
    errors.receivableRefs = {
      messageKey: "receivables.form.receivablesTooMany",
      params: { max: CLAIM_MAX_RECEIVABLES },
    };
  }
  return errors;
}

export interface RemittanceDraft {
  remittedAmount: string;
  remittanceRef?: string | null;
}

export type RemittanceDraftErrors = Partial<Record<"remittedAmount", ReceivableFieldError>>;

/**
 * Money: non-negative exact-decimal string, up to 4 fractional digits. Unlike a
 * payment apply (>0), a remittance MAY be 0 — a full-rejection remittance is valid.
 */
const NON_NEGATIVE_MONEY = /^\d{1,15}(\.\d{1,4})?$/;

export function validateRemittanceDraft(draft: RemittanceDraft): RemittanceDraftErrors {
  const errors: RemittanceDraftErrors = {};
  const v = (draft.remittedAmount ?? "").trim();
  if (!NON_NEGATIVE_MONEY.test(v)) {
    errors.remittedAmount = { messageKey: "receivables.form.amountInvalid" };
  }
  return errors;
}
