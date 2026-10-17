import {
  type PayerCreateResult,
  classifyPayerCreateOutcome,
  newIdempotencyKey,
  reuseOrNewKey,
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

describe("reuseOrNewKey", () => {
  test("the first attempt for a body mints a key", () => {
    const attempt = reuseOrNewKey(undefined, '{"displayName":"A"}');
    expect(attempt.key).toMatch(/^[!-~]{16,128}$/);
    expect(attempt.fingerprint).toBe('{"displayName":"A"}');
  });

  test("a retry of the SAME body reuses its key (a dropped response never double-creates)", () => {
    const first = reuseOrNewKey(undefined, "body-1");
    expect(reuseOrNewKey(first, "body-1")).toBe(first);
  });

  test("a different body gets a new key (the same key with another payload would 409)", () => {
    const first = reuseOrNewKey(undefined, "body-1");
    const second = reuseOrNewKey(first, "body-2");
    expect(second.key).not.toBe(first.key);
    expect(second.fingerprint).toBe("body-2");
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

  test("400 validation_error -> form-level error", () => {
    const o = classifyPayerCreateOutcome(
      res({ status: 400, error: { error: { code: "validation_error" } } }),
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

  test("404 (an out-of-scope store) -> its own non-disclosing outcome, not the generic error", () => {
    const o = classifyPayerCreateOutcome(
      res({ status: 404, error: { error: { code: "not_found", request_id: "req-404" } } }),
    );
    expect(o).toEqual({
      kind: "not-found",
      messageKey: "payers.create.errors.storeUnavailable",
      requestId: "req-404",
    });
  });

  test("422 is handled like a validation failure (the contract defines none; never the cause)", () => {
    const o = classifyPayerCreateOutcome(
      res({ status: 422, error: { error: { code: "anything", message: "secret detail" } } }),
    );
    expect(o).toEqual({
      kind: "validation",
      messageKey: "payers.create.errors.validation",
      requestId: undefined,
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
    for (const status of [400, 401, 403, 404, 409, 422, 500]) {
      const o = classifyPayerCreateOutcome(res({ status })) as { messageKey?: string };
      expect(o.messageKey).toMatch(/^payers\.create\.errors\./);
    }
  });
});
