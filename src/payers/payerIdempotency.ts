/**
 * 017 payer-account create idempotency (CON-G1 / OQ-CON-IDEMPOTENCY, FR-005/020).
 * `consoleCreatePayerAccount` is idempotency-keyed: each attempt sends a
 * client-generated opaque `Idempotency-Key` header. This module owns key
 * generation + the pure classifier that maps a create result to the UI's next
 * action, per the consumed contract's response set:
 *
 *   201                              → created
 *   201 + Idempotent-Replayed:true   → replayed (same account, not a duplicate)
 *   400 validation_failure           → inline field error
 *   400 idempotency_key_*            → regenerate key + retry (not user-facing)
 *   401                              → re-authenticate (session)
 *   403                              → permission banner
 *   409 idempotency_key_conflict     → terminal; generate a NEW key, do not auto-retry
 *   409 (other)                      → non-disclosing conflict banner (never reveal
 *                                       cross-tenant existence — §II/§XII)
 *   5xx                              → generic retryable error
 *
 * No new dependency: the key is a v4 UUID from `crypto.randomUUID` (36 chars,
 * inside the contract format `^[\x21-\x7E]{16,128}$`). Mirrors the proven
 * inviteIdempotency shape — pure functions, no React, no fetch.
 *
 * RT-399: each operator-facing outcome carries the catalog `messageKey` for its
 * copy; the drawer renders `t(outcome.messageKey)` at display time, so no
 * translated string is ever held in component state.
 */
import type { MessageKey } from "@/i18n";

/** Backend error envelope: { error: { code, message, request_id } }. */
interface BackendError {
  error?: { code?: string; message?: string; request_id?: string };
}

export interface PayerCreateResult {
  status: number;
  headers: Headers;
  error?: BackendError;
}

export type PayerCreateOutcome =
  | { kind: "created"; replayed: false }
  | { kind: "replayed" }
  | { kind: "validation"; messageKey: MessageKey; requestId?: string }
  | { kind: "regenerate-key" }
  | { kind: "unauthenticated"; messageKey: MessageKey }
  | { kind: "forbidden"; messageKey: MessageKey; requestId?: string }
  | { kind: "key-conflict"; messageKey: MessageKey; requestId?: string }
  | { kind: "conflict"; messageKey: MessageKey; requestId?: string }
  | { kind: "error"; messageKey: MessageKey; requestId?: string };

/** Generate an Idempotency-Key (v4 UUID; satisfies `^[\x21-\x7E]{16,128}$`). */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

function codeOf(result: PayerCreateResult): string | undefined {
  return result.error?.error?.code;
}

function requestIdOf(result: PayerCreateResult): string | undefined {
  return result.error?.error?.request_id;
}

/** Pure classifier; no React, no fetch. Drives the create-form outcome rendering. */
export function classifyPayerCreateOutcome(result: PayerCreateResult): PayerCreateOutcome {
  const requestId = requestIdOf(result);

  if (result.status === 201) {
    return result.headers.get("Idempotent-Replayed") === "true"
      ? { kind: "replayed" }
      : { kind: "created", replayed: false };
  }

  if (result.status === 400) {
    const code = codeOf(result);
    // A malformed/missing key is a client-internal fault: regenerate + retry,
    // not a message to the operator (they did not type the key).
    if (code === "idempotency_key_required" || code === "idempotency_key_malformed") {
      return { kind: "regenerate-key" };
    }
    return { kind: "validation", messageKey: "payers.create.errors.validation", requestId };
  }

  if (result.status === 401) {
    return { kind: "unauthenticated", messageKey: "payers.create.errors.sessionExpired" };
  }

  if (result.status === 403) {
    return { kind: "forbidden", messageKey: "payers.create.errors.forbidden", requestId };
  }

  if (result.status === 409) {
    // Same key, different body — terminal; a new key is required (do not retry
    // with the same one). Any other 409 is a non-disclosing conflict — never
    // reveal whether a cross-tenant resource exists.
    return codeOf(result) === "idempotency_key_conflict"
      ? { kind: "key-conflict", messageKey: "payers.create.errors.keyConflict", requestId }
      : { kind: "conflict", messageKey: "payers.create.errors.conflict", requestId };
  }

  return { kind: "error", messageKey: "payers.create.errors.generic", requestId };
}
