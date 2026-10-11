/**
 * 017 create-payer form validation — pure, no client (PayerAccountCreate shape).
 * Validates only what the consumed contract constrains: required `category`
 * (v1 enum) + `displayName` (1..200, trimmed). `externalRef`/`storeId`/
 * `creditTerms` are optional/opaque — no tax/credit-terms field is invented
 * (NG-8). The server remains authoritative; this is a fail-fast UX guard, not a
 * second source of truth.
 *
 * RT-399: errors are message keys (plus params), translated at render time, so
 * a locale switch never leaves an error behind in the old language.
 */
import type { MessageKey, Params } from "@/i18n";

/** v1 payer categories (PayerCategory enum — extensible upstream, not here). */
export const PAYER_CATEGORIES = ["credit_customer", "corporate", "insurer"] as const;
export type PayerCategory = (typeof PAYER_CATEGORIES)[number];

export interface PayerCreateDraft {
  category: PayerCategory;
  displayName: string;
  externalRef?: string | null;
  storeId?: string | null;
  creditTerms?: Record<string, unknown> | null;
}

/** A field error: the catalog key and its params, rendered with `t()` at display time. */
export interface PayerFieldError {
  messageKey: MessageKey;
  params?: Params;
}

/** Field-keyed validation errors; empty object = valid. */
export type PayerDraftErrors = Partial<Record<"category" | "displayName", PayerFieldError>>;

const DISPLAY_NAME_MAX = 200;

export function validatePayerDraft(draft: PayerCreateDraft): PayerDraftErrors {
  const errors: PayerDraftErrors = {};

  if (!PAYER_CATEGORIES.includes(draft.category)) {
    errors.category = { messageKey: "payers.form.categoryRequired" };
  }

  const name = (draft.displayName ?? "").trim();
  if (name.length === 0) {
    errors.displayName = { messageKey: "payers.form.displayNameRequired" };
  } else if (draft.displayName.length > DISPLAY_NAME_MAX) {
    errors.displayName = {
      messageKey: "payers.form.displayNameTooLong",
      params: { max: DISPLAY_NAME_MAX },
    };
  }

  return errors;
}
