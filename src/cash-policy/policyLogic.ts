/**
 * RT-389 pure logic for the shift variance policy forms. No React, no fetch.
 *
 * Draft validation is shape only: the contract's reason length (1 to 200), the
 * amount pattern with the EGP minor unit (two fractional digits; V1 accepts
 * only EGP), and a well-formed expiry. The rules that depend on server state
 * (stricter-only, expiry after server time, the 90-day horizon, owner approval,
 * the currency) are the server's (K-9): their refusals are mapped to copy, never
 * pre-computed here. Request bodies carry only fields of the contract.
 */
import type { MessageKey } from "@/i18n";
import type {
  CashVariancePolicyValue,
  PublishStoreBody,
  PublishTenantBody,
} from "@/lib/cash-variance-policy-queries";
import { zonedLocalToIso } from "./policyDates";

/** The only currency a V1 limit accepts (K-5); a shown, read-only value. */
export const POLICY_CURRENCY = "EGP" as const;

export const REASON_MAX = 200;

const AMOUNT = /^[0-9]{1,15}(\.[0-9]{1,2})?$/;

export type PolicyMode = "none" | "limit";

export interface PolicyDraft {
  mode: PolicyMode;
  limitAmount: string;
  reason: string;
  /** Store override expiry as `YYYY-MM-DDTHH:mm` in the store zone; blank = none. */
  expiry: string;
}

export interface DraftErrors {
  limitAmount?: MessageKey;
  reason?: MessageKey;
  expiry?: MessageKey;
}

export interface ValidateOptions {
  /** A tenant_admin cannot publish a permanent override, so a blank expiry is refused. */
  requireExpiry: boolean;
}

export function validateDraft(draft: PolicyDraft, options: ValidateOptions): DraftErrors {
  const errors: DraftErrors = {};
  const reason = draft.reason.trim();
  if (reason.length === 0) errors.reason = "cashPolicy.error.reasonRequired";
  else if (reason.length > REASON_MAX) errors.reason = "cashPolicy.error.reasonTooLong";

  if (draft.mode === "limit" && !AMOUNT.test(draft.limitAmount.trim())) {
    errors.limitAmount = "cashPolicy.error.amountInvalid";
  }

  if (draft.expiry.trim() === "") {
    if (options.requireExpiry) errors.expiry = "cashPolicy.error.expiryRequiredForAdmin";
  } else if (zonedLocalToIso(draft.expiry.trim(), "UTC") === undefined) {
    errors.expiry = "cashPolicy.error.expiryInvalid";
  }
  return errors;
}

/**
 * A stored limit (`1250.0000`, up to four fractional digits) as the form field
 * shows it (`1250`): trailing zeros dropped so a pre-filled value passes the
 * two-digit EGP check. Digits that carry value are never rounded away.
 */
export function amountForInput(stored: string | undefined): string {
  if (!stored) return "";
  const [int, frac = ""] = stored.split(".");
  let end = frac.length;
  while (end > 0 && frac[end - 1] === "0") end--;
  return end === 0 ? int : `${int}.${frac.slice(0, end)}`;
}

function policyValue(draft: PolicyDraft): CashVariancePolicyValue {
  return draft.mode === "limit"
    ? { mode: "limit", limitAmount: draft.limitAmount.trim(), currencyCode: POLICY_CURRENCY }
    : { mode: "none" };
}

/** `expectedRevisionId` is the read's `latestRevisionId` (null before the first revision). */
export function buildTenantBody(
  draft: PolicyDraft,
  expectedRevisionId: string | null,
): PublishTenantBody {
  return { expectedRevisionId, policyValue: policyValue(draft), reason: draft.reason.trim() };
}

export function buildStoreSetBody(
  draft: PolicyDraft,
  expectedRevisionId: string | null,
  timeZone: string,
): PublishStoreBody {
  const body: PublishStoreBody = {
    expectedRevisionId,
    kind: "set",
    policyValue: policyValue(draft),
    reason: draft.reason.trim(),
  };
  const expiry = draft.expiry.trim();
  if (expiry === "") return body;
  return { ...body, effectiveUntil: zonedLocalToIso(expiry, timeZone) };
}

export function buildStoreClearBody(
  reason: string,
  expectedRevisionId: string | null,
): PublishStoreBody {
  return { expectedRevisionId, kind: "clear", reason: reason.trim() };
}

// --- Publish outcome ----------------------------------------------------------

export interface PublishResult {
  status: number;
  headers: Headers;
  error?: unknown;
}

export type PublishOutcome =
  | { kind: "saved" }
  /** 409 changed concurrently: refresh the read, keep the draft, retry. */
  | { kind: "stale"; messageKey: MessageKey; requestId?: string }
  /** 409 key reuse with another body: terminal for that key; the next attempt gets a new one. */
  | { kind: "key-conflict"; messageKey: MessageKey; requestId?: string }
  /** 400 key faults: the operator did not type the key; regenerate and retry. */
  | { kind: "regenerate-key" }
  /** 425: the first request with this key is still running; retry the same key and body. */
  | { kind: "in-progress"; messageKey: MessageKey }
  | { kind: "failed"; messageKey: MessageKey; requestId?: string };

/** `{ error: { code, request_id } }`; the 425 body's `error` is a plain string. */
function envelope(error: unknown): { code?: string; requestId?: string } {
  const inner = (error as { error?: unknown } | undefined)?.error;
  if (typeof inner !== "object" || inner === null) return {};
  const { code, request_id: requestId } = inner as { code?: unknown; request_id?: unknown };
  return {
    code: typeof code === "string" ? code : undefined,
    requestId: typeof requestId === "string" ? requestId : undefined,
  };
}

const UNPROCESSABLE: Record<string, MessageKey> = {
  policy_currency_unsupported: "cashPolicy.error.currencyUnsupported",
  override_looser_than_tenant: "cashPolicy.error.looserThanTenant",
  override_expiry_invalid: "cashPolicy.error.expiryNotFuture",
  override_not_active: "cashPolicy.error.notActive",
};

type Handler = (code: string | undefined, requestId: string | undefined) => PublishOutcome;

const failedWith =
  (messageKey: MessageKey): Handler =>
  (_code, requestId) => ({ kind: "failed", messageKey, requestId });

/** A message by error code, else a default (an unknown code is never surfaced). */
const byCode =
  (table: Record<string, MessageKey>, fallback: MessageKey): Handler =>
  (code, requestId) => ({
    kind: "failed",
    messageKey: code !== undefined && Object.hasOwn(table, code) ? table[code] : fallback,
    requestId,
  });

const conflict: Handler = (code, requestId) =>
  code === "idempotency_key_conflict"
    ? { kind: "key-conflict", messageKey: "cashPolicy.error.keyConflict", requestId }
    : { kind: "stale", messageKey: "cashPolicy.error.changedConcurrently", requestId };

const badRequest: Handler = (code, requestId) =>
  code === "idempotency_key_required" || code === "idempotency_key_malformed"
    ? { kind: "regenerate-key" }
    : failedWith("cashPolicy.error.validation")(code, requestId);

const BY_STATUS: Record<number, Handler> = {
  400: badRequest,
  401: failedWith("cashPolicy.error.sessionExpired"),
  403: byCode(
    {
      owner_approval_required: "cashPolicy.error.ownerApprovalRequired",
      origin_rejected: "cashPolicy.error.originRejected",
    },
    "cashPolicy.error.forbidden",
  ),
  404: failedWith("cashPolicy.error.unavailable"),
  409: conflict,
  422: byCode(UNPROCESSABLE, "cashPolicy.error.validation"),
  425: () => ({ kind: "in-progress", messageKey: "cashPolicy.error.inProgress" }),
};

export function classifyPublishOutcome(result: PublishResult): PublishOutcome {
  if (result.status === 201) return { kind: "saved" };
  const { code, requestId } = envelope(result.error);
  const handler = BY_STATUS[result.status] ?? failedWith("cashPolicy.error.generic");
  return handler(code, requestId);
}
