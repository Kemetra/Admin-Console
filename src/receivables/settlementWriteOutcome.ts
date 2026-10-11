/**
 * 018 settlement-write outcome classifier — pure, shared by the claim-submit and
 * remittance-reconcile drawers (both are `x-idempotency: required` POSTs with the
 * same response set). Mirrors 017's payerIdempotency classifier shape:
 *
 *   2xx                              → ok
 *   2xx + Idempotent-Replayed:true   → replayed (same write, not a duplicate)
 *   400 validation_failure           → inline field error
 *   400 idempotency_key_*            → regenerate key + retry (not user-facing)
 *   401                              → session
 *   403                              → permission banner
 *   409 idempotency_key_conflict     → terminal; new key
 *   409 (other)                      → non-disclosing conflict
 *   5xx                              → generic
 *
 * The key is a v4 UUID (satisfies the contract format `^[\x21-\x7E]{16,128}$`).
 *
 * RT-399: the three drawers share these outcomes but word them differently, so
 * each passes its own `WriteCopy` (catalog keys) and every operator-facing
 * outcome carries the `messageKey` to render with `t()` at display time. No
 * translated string is held in component state.
 */
import type { MessageKey } from "@/i18n";

/** A drawer's copy for each operator-facing outcome (409 key/other conflicts share one). */
export interface WriteCopy {
  validation: MessageKey;
  unauthenticated: MessageKey;
  forbidden: MessageKey;
  conflict: MessageKey;
  error: MessageKey;
}

interface BackendError {
  error?: { code?: string; message?: string; request_id?: string };
}

export interface WriteResult {
  status: number;
  headers: Headers;
  error?: BackendError;
}

export type WriteOutcome =
  | { kind: "ok" }
  | { kind: "replayed" }
  | { kind: "validation"; messageKey: MessageKey; requestId?: string }
  | { kind: "regenerate-key" }
  | { kind: "unauthenticated"; messageKey: MessageKey }
  | { kind: "forbidden"; messageKey: MessageKey; requestId?: string }
  | { kind: "key-conflict"; messageKey: MessageKey; requestId?: string }
  | { kind: "conflict"; messageKey: MessageKey; requestId?: string }
  | { kind: "error"; messageKey: MessageKey; requestId?: string };

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

function codeOf(r: WriteResult): string | undefined {
  return r.error?.error?.code;
}
function requestIdOf(r: WriteResult): string | undefined {
  return r.error?.error?.request_id;
}

export function classifyWriteOutcome(result: WriteResult, copy: WriteCopy): WriteOutcome {
  const requestId = requestIdOf(result);

  if (result.status >= 200 && result.status < 300) {
    return result.headers.get("Idempotent-Replayed") === "true"
      ? { kind: "replayed" }
      : { kind: "ok" };
  }
  if (result.status === 400) {
    const code = codeOf(result);
    if (code === "idempotency_key_required" || code === "idempotency_key_malformed") {
      return { kind: "regenerate-key" };
    }
    return { kind: "validation", messageKey: copy.validation, requestId };
  }
  if (result.status === 401) return { kind: "unauthenticated", messageKey: copy.unauthenticated };
  if (result.status === 403) return { kind: "forbidden", messageKey: copy.forbidden, requestId };
  if (result.status === 409) {
    return codeOf(result) === "idempotency_key_conflict"
      ? { kind: "key-conflict", messageKey: copy.conflict, requestId }
      : { kind: "conflict", messageKey: copy.conflict, requestId };
  }
  return { kind: "error", messageKey: copy.error, requestId };
}
