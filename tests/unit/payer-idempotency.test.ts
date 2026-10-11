import {
  type PayerCreateResult,
  classifyPayerCreateOutcome,
  newIdempotencyKey,
} from "@/payers/payerIdempotency";
import { describe, expect, test } from "vitest";

/**
 * 017 payer-account create idempotency (CON-G1 / OQ-CON-IDEMPOTENCY, FR-005/020).
 * `consoleCreatePayerAccount` takes a client-generated `Idempotency-Key`; the pure
 * classifier maps a create result to the UI's next action per the consumed
 * contract's response set (201/400/401/403/409/500). Replaying the same key never
 * creates a second account.
 *
 * Mirrors the proven inviteIdempotency shape — pure functions, no network.
 */
describe("newIdempotencyKey (payer)", () => {
  test("matches the contract Idempotency-Key format ^[\\x21-\\x7E]{16,128}$", () => {
    expect(newIdempotencyKey()).toMatch(/^[\x21-\x7E]{16,128}$/);
  });

  test("is unique across calls", () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});

function res(partial: Partial<PayerCreateResult>): PayerCreateResult {
  return { status: 0, headers: new Headers(), error: undefined, ...partial };
}

describe("classifyPayerCreateOutcome", () => {
  test("201 -> created", () => {
    expect(classifyPayerCreateOutcome(res({ status: 201 })).kind).toBe("created");
  });

  test("201 with Idempotent-Replayed:true -> replayed (same account, not a dup)", () => {
    const headers = new Headers({ "Idempotent-Replayed": "true" });
    expect(classifyPayerCreateOutcome(res({ status: 201, headers })).kind).toBe("replayed");
  });

  test("400 validation_error -> inline field error", () => {
    const o = classifyPayerCreateOutcome(
      res({ status: 400, error: { error: { code: "validation_failure" } } }),
    );
    expect(o.kind).toBe("validation");
    expect(o).toMatchObject({ messageKey: "payers.create.errors.validation" });
  });

  test("400 idempotency_key_* -> regenerate key + retry (not user-facing)", () => {
    const o = classifyPayerCreateOutcome(
      res({ status: 400, error: { error: { code: "idempotency_key_malformed" } } }),
    );
    expect(o.kind).toBe("regenerate-key");
  });

  test("401 -> session (re-auth)", () => {
    expect(classifyPayerCreateOutcome(res({ status: 401 }))).toEqual({
      kind: "unauthenticated",
      messageKey: "payers.create.errors.sessionExpired",
    });
  });

  test("403 -> permission banner (message key + request_id evidence)", () => {
    const o = classifyPayerCreateOutcome(
      res({ status: 403, error: { error: { request_id: "req-403" } } }),
    );
    expect(o).toEqual({
      kind: "forbidden",
      messageKey: "payers.create.errors.forbidden",
      requestId: "req-403",
    });
  });

  test("409 idempotency_key_conflict -> terminal; regenerate a NEW key", () => {
    const o = classifyPayerCreateOutcome(
      res({ status: 409, error: { error: { code: "idempotency_key_conflict" } } }),
    );
    expect(o.kind).toBe("key-conflict");
    expect(o).toMatchObject({ messageKey: "payers.create.errors.keyConflict" });
  });

  test("409 (other) -> non-disclosing conflict banner (no cross-tenant leak)", () => {
    const o = classifyPayerCreateOutcome(res({ status: 409 }));
    expect(o.kind).toBe("conflict");
    expect(o).toMatchObject({ messageKey: "payers.create.errors.conflict" });
  });

  test("5xx -> generic retryable error", () => {
    const o = classifyPayerCreateOutcome(res({ status: 503 }));
    expect(o.kind).toBe("error");
    expect(o).toMatchObject({ messageKey: "payers.create.errors.generic" });
  });

  test("RT-399: outcomes carry message keys, never translated copy", () => {
    for (const status of [400, 401, 403, 409, 500]) {
      const o = classifyPayerCreateOutcome(res({ status })) as { messageKey?: string };
      expect(o.messageKey).toMatch(/^payers\.create\.errors\./);
    }
  });
});
