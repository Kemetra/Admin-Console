import { describe, expect, test } from "vitest";

import { translate } from "@/i18n";
import {
  BULK_DISMISS_MAX,
  type UnknownItemOp,
  mapUnknownItemError,
} from "@/lib/unknown-items-queries";
import { keepsKey, newIdempotencyKey, reuseOrNewKey } from "@/unknown-items/unknownItemIdempotency";

/**
 * RT-724 (RF-4b) error mapping for create-product / reopen / bulk-dismiss. Each
 * op maps the statuses and `error.code`s its pinned contract documents:
 *   - createProduct: 400 validation_error / 403 / 404 / 409 alias_conflict |
 *                    already_reconciled (+ target_unavailable, the R2 code)
 *   - reopen:        400 / 403 tenant-wide only / 404 / 409 already_reconciled |
 *                    idempotency_key_conflict / 425
 *   - bulkDismiss:   400 whole batch / 403 / 409 idempotency_key_conflict / 425
 * Every key resolves in both catalogs, and no copy names a product.
 */
const env = (status: number, op: UnknownItemOp, code = "x", requestId?: string) => ({
  status,
  op,
  error: { error: { code, message: "backend english", request_id: requestId } },
});

describe("createProduct", () => {
  test("400 validation_error -> form-level validation with request id", () => {
    expect(mapUnknownItemError(env(400, "createProduct", "validation_error", "req-1"))).toEqual({
      kind: "validation",
      messageKey: "unknownItems.errors.createValidation",
      requestId: "req-1",
    });
  });
  test("403 forbidden -> persistent banner", () => {
    expect(mapUnknownItemError(env(403, "createProduct", "forbidden"))).toMatchObject({
      kind: "banner",
      messageKey: "unknownItems.errors.forbidden",
      retryable: false,
    });
  });
  test("404 -> uniform non-disclosing not-found", () => {
    expect(mapUnknownItemError(env(404, "createProduct", "not_found"))).toEqual({
      kind: "not-found",
      messageKey: "unknownItems.errors.notFound",
    });
  });
  test("409 alias_conflict -> alias-conflict that never names the product", () => {
    const r = mapUnknownItemError(env(409, "createProduct", "alias_conflict", "req-409"));
    expect(r).toEqual({
      kind: "alias-conflict",
      messageKey: "unknownItems.errors.aliasConflict",
      requestId: "req-409",
    });
    expect(translate("en", r.messageKey)).toMatch(/already linked to another product/);
  });
  test("409 target_unavailable -> target-unavailable", () => {
    expect(mapUnknownItemError(env(409, "createProduct", "target_unavailable")).kind).toBe(
      "target-unavailable",
    );
  });
  test("409 already_reconciled -> already-reconciled", () => {
    expect(mapUnknownItemError(env(409, "createProduct", "already_reconciled"))).toEqual({
      kind: "already-reconciled",
      messageKey: "unknownItems.errors.alreadyReconciled",
    });
  });
  test("409 with an undocumented code -> generic", () => {
    expect(mapUnknownItemError(env(409, "createProduct", "mystery")).kind).toBe("generic");
  });
  test("425 is undocumented here -> generic", () => {
    expect(mapUnknownItemError(env(425, "createProduct")).kind).toBe("generic");
  });
});

describe("reopen", () => {
  test("403 forbidden -> tenant-wide-authority banner (distinct from 404)", () => {
    const r = mapUnknownItemError(env(403, "reopen", "forbidden", "req-403"));
    expect(r).toMatchObject({
      kind: "banner",
      messageKey: "unknownItems.errors.reopenForbidden",
      requestId: "req-403",
    });
    expect(translate("en", r.messageKey)).toMatch(/tenant-wide authority/);
  });
  test("404 -> non-disclosing not-found", () => {
    expect(mapUnknownItemError(env(404, "reopen")).kind).toBe("not-found");
  });
  test("409 already_reconciled -> the item is resolved, only dismissed reopens", () => {
    expect(mapUnknownItemError(env(409, "reopen", "already_reconciled"))).toEqual({
      kind: "already-reconciled",
      messageKey: "unknownItems.errors.reopenResolved",
    });
  });
  test("409 idempotency_key_conflict -> key-conflict", () => {
    expect(mapUnknownItemError(env(409, "reopen", "idempotency_key_conflict")).kind).toBe(
      "key-conflict",
    );
  });
  test("425 -> in-progress (no automatic retry)", () => {
    expect(mapUnknownItemError(env(425, "reopen"))).toEqual({
      kind: "in-progress",
      messageKey: "unknownItems.errors.inProgress",
    });
  });
  test("400 -> generic", () => {
    expect(mapUnknownItemError(env(400, "reopen", "validation_error")).kind).toBe("generic");
  });
});

describe("bulkDismiss", () => {
  test("400 -> whole batch rejected, naming the ceiling", () => {
    const r = mapUnknownItemError(env(400, "bulkDismiss", "validation", "req-400"));
    expect(r).toEqual({
      kind: "validation",
      messageKey: "unknownItems.errors.bulkRejected",
      requestId: "req-400",
    });
    expect(translate("en", r.messageKey, { max: BULK_DISMISS_MAX })).toMatch(
      /nothing was dismissed.*200/,
    );
    expect(translate("ar", r.messageKey, { max: BULK_DISMISS_MAX })).toContain("200");
  });
  test("403 forbidden -> banner", () => {
    expect(mapUnknownItemError(env(403, "bulkDismiss", "forbidden")).kind).toBe("banner");
  });
  test("404 is undocumented (per-id not-found is an outcome) -> generic", () => {
    expect(mapUnknownItemError(env(404, "bulkDismiss")).kind).toBe("generic");
  });
  test("409 idempotency_key_conflict -> key-conflict", () => {
    expect(mapUnknownItemError(env(409, "bulkDismiss", "idempotency_key_conflict")).kind).toBe(
      "key-conflict",
    );
  });
  test("425 -> in-progress", () => {
    expect(mapUnknownItemError(env(425, "bulkDismiss")).kind).toBe("in-progress");
  });
  test("5xx -> retryable banner", () => {
    expect(mapUnknownItemError(env(503, "bulkDismiss"))).toMatchObject({ retryable: true });
  });
});

describe("429 rate_limited (RT-574) on the write ops", () => {
  test.each(["createProduct", "reopen", "bulkDismiss"] as const)(
    "%s: 429 -> persistent banner that drops the key",
    (op) => {
      const r = mapUnknownItemError(env(429, op, "rate_limited", "req-429"));
      expect(r).toEqual({
        kind: "banner",
        messageKey: "unknownItems.errors.rateLimited",
        requestId: "req-429",
        retryable: false,
      });
      expect(keepsKey(r)).toBe(false);
    },
  );
});

describe("RF-4a mapping is unchanged for the read ops", () => {
  test("list / inspect 409 and 425 stay generic", () => {
    for (const op of ["list", "inspect"] as const) {
      expect(mapUnknownItemError(env(409, op)).kind).toBe("generic");
      expect(mapUnknownItemError(env(425, op)).kind).toBe("generic");
    }
  });
});

describe("copy: Arabic-first, never backend English, never a raw key", () => {
  const keys = [
    "unknownItems.errors.reopenForbidden",
    "unknownItems.errors.reopenResolved",
    "unknownItems.errors.createValidation",
    "unknownItems.errors.bulkRejected",
    "unknownItems.errors.aliasConflict",
    "unknownItems.errors.targetUnavailable",
    "unknownItems.errors.keyConflict",
    "unknownItems.errors.inProgress",
    "unknownItems.errors.rateLimited",
  ] as const;
  test.each(keys)("%s resolves to Arabic copy", (key) => {
    const ar = translate("ar", key, { max: BULK_DISMISS_MAX });
    expect(ar).toMatch(/[؀-ۿ]/);
    expect(ar).not.toContain("unknownItems.");
    expect(ar).not.toContain("backend english");
  });
});

describe("idempotency keys", () => {
  test("a key is 16..128 printable ASCII", () => {
    expect(newIdempotencyKey()).toMatch(/^[\x21-\x7E]{16,128}$/);
  });
  test("the same body reuses its key; another body gets a new one", () => {
    const a = reuseOrNewKey(undefined, "reopen:u1");
    expect(reuseOrNewKey(a, "reopen:u1")).toBe(a);
    expect(reuseOrNewKey(a, "reopen:u2").key).not.toBe(a.key);
  });
  test("only an unsettled outcome (5xx, 425) keeps the key", () => {
    expect(keepsKey(mapUnknownItemError(env(425, "reopen")))).toBe(true);
    expect(keepsKey(mapUnknownItemError(env(503, "reopen")))).toBe(true);
    expect(keepsKey(mapUnknownItemError(env(409, "reopen", "idempotency_key_conflict")))).toBe(
      false,
    );
    expect(keepsKey(mapUnknownItemError(env(403, "reopen")))).toBe(false);
    expect(keepsKey(mapUnknownItemError(env(400, "bulkDismiss")))).toBe(false);
  });
});
