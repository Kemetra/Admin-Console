import {
  canApprovePermanent,
  canConfigurePolicy,
  canReadStorePolicy,
} from "@/cash-policy/policyAccess";
import { zonedLocalToIso } from "@/cash-policy/policyDates";
import {
  type PolicyDraft,
  amountForInput,
  buildStoreClearBody,
  buildStoreSetBody,
  buildTenantBody,
  classifyPublishOutcome,
  validateDraft,
} from "@/cash-policy/policyLogic";
import { describe, expect, test } from "vitest";

/**
 * RT-389 pure logic. Access mirrors the Backend-Core role lists (DR-10); the
 * server stays the authority. Drafts are validated only for shape (the
 * contract's reason length, the EGP minor unit, the amount pattern); the
 * stricter-only and horizon rules are the server's (K-9), never computed here.
 */
const draft = (over: Partial<PolicyDraft> = {}): PolicyDraft => ({
  mode: "limit",
  limitAmount: "1250.50",
  reason: "Quarterly review",
  expiry: "",
  ...over,
});

describe("role access", () => {
  test.each(["owner", "tenant_admin"])("%s may configure the policy", (role) => {
    expect(canConfigurePolicy(role)).toBe(true);
  });
  test.each(["store_manager", "cashier", "platform_admin", "", null, undefined])(
    "%s may not configure the policy",
    (role) => {
      expect(canConfigurePolicy(role)).toBe(false);
    },
  );
  test.each(["owner", "tenant_admin", "store_manager"])("%s may read a store policy", (role) => {
    expect(canReadStorePolicy(role)).toBe(true);
  });
  test.each(["cashier", "platform_admin", "", null, undefined])(
    "%s may not read a store policy",
    (role) => {
      expect(canReadStorePolicy(role)).toBe(false);
    },
  );
  test("only an owner approves a permanent override", () => {
    expect(canApprovePermanent("owner")).toBe(true);
    expect(canApprovePermanent("tenant_admin")).toBe(false);
    expect(canApprovePermanent(undefined)).toBe(false);
  });
});

describe("validateDraft", () => {
  test("a complete limit draft is valid", () => {
    expect(validateDraft(draft(), { requireExpiry: false })).toEqual({});
  });
  test("mode none needs only a reason", () => {
    expect(
      validateDraft(draft({ mode: "none", limitAmount: "" }), { requireExpiry: false }),
    ).toEqual({});
  });
  test("a blank or whitespace reason is refused", () => {
    expect(validateDraft(draft({ reason: "" }), { requireExpiry: false }).reason).toBe(
      "cashPolicy.error.reasonRequired",
    );
    expect(validateDraft(draft({ reason: "   " }), { requireExpiry: false }).reason).toBe(
      "cashPolicy.error.reasonRequired",
    );
  });
  test("a reason over 200 characters is refused", () => {
    expect(validateDraft(draft({ reason: "x".repeat(201) }), { requireExpiry: false }).reason).toBe(
      "cashPolicy.error.reasonTooLong",
    );
    expect(validateDraft(draft({ reason: "x".repeat(200) }), { requireExpiry: false })).toEqual({});
  });
  test.each(["", "abc", "-5", "1,250", "12.345", "1e3", ".5", "1234567890123456"])(
    "limit amount %j is refused",
    (limitAmount) => {
      expect(validateDraft(draft({ limitAmount }), { requireExpiry: false }).limitAmount).toBe(
        "cashPolicy.error.amountInvalid",
      );
    },
  );
  test.each(["0", "0.00", "25", "1250.5", "999999999999999.99"])(
    "limit amount %j is accepted",
    (limitAmount) => {
      expect(validateDraft(draft({ limitAmount }), { requireExpiry: false })).toEqual({});
    },
  );
  test("the amount is ignored for mode none", () => {
    expect(
      validateDraft(draft({ mode: "none", limitAmount: "garbage" }), { requireExpiry: false }),
    ).toEqual({});
  });
  test("a blocked permanent override (requireExpiry) needs an expiry", () => {
    expect(validateDraft(draft({ expiry: "" }), { requireExpiry: true }).expiry).toBe(
      "cashPolicy.error.expiryRequiredForAdmin",
    );
    expect(validateDraft(draft({ expiry: "2026-12-01T10:00" }), { requireExpiry: true })).toEqual(
      {},
    );
  });
  test("a malformed expiry is refused", () => {
    expect(validateDraft(draft({ expiry: "tomorrow" }), { requireExpiry: false }).expiry).toBe(
      "cashPolicy.error.expiryInvalid",
    );
  });
});

describe("request bodies carry only contract fields", () => {
  test("tenant limit", () => {
    expect(buildTenantBody(draft(), "rev-1")).toEqual({
      expectedRevisionId: "rev-1",
      policyValue: { mode: "limit", limitAmount: "1250.50", currencyCode: "EGP" },
      reason: "Quarterly review",
    });
  });
  test("tenant none has no amount or currency, and a null token is sent as null", () => {
    expect(buildTenantBody(draft({ mode: "none", limitAmount: "25" }), null)).toEqual({
      expectedRevisionId: null,
      policyValue: { mode: "none" },
      reason: "Quarterly review",
    });
  });
  test("the reason is trimmed", () => {
    expect(buildTenantBody(draft({ reason: "  hello  " }), null).reason).toBe("hello");
  });
  test("store set with no expiry omits effectiveUntil", () => {
    const body = buildStoreSetBody(draft(), "rev-2", "Africa/Cairo");
    expect(body).toEqual({
      expectedRevisionId: "rev-2",
      kind: "set",
      policyValue: { mode: "limit", limitAmount: "1250.50", currencyCode: "EGP" },
      reason: "Quarterly review",
    });
    expect("effectiveUntil" in body).toBe(false);
  });
  test("store set with an expiry sends the instant with an offset, read in the store zone", () => {
    const body = buildStoreSetBody(draft({ expiry: "2026-12-01T10:30" }), "rev-2", "Africa/Cairo");
    // Cairo is UTC+2 on 1 Dec 2026.
    expect(body.effectiveUntil).toBe("2026-12-01T08:30:00.000Z");
  });
  test("store clear carries a reason only", () => {
    expect(buildStoreClearBody("  not needed  ", "rev-3")).toEqual({
      expectedRevisionId: "rev-3",
      kind: "clear",
      reason: "not needed",
    });
  });
});

describe("zonedLocalToIso", () => {
  test("reads the wall-clock time in the zone (no DST)", () => {
    expect(zonedLocalToIso("2026-01-15T09:00", "Asia/Dubai")).toBe("2026-01-15T05:00:00.000Z");
  });
  test("reads the wall-clock time in the zone (summer time)", () => {
    expect(zonedLocalToIso("2026-07-15T09:00", "Africa/Cairo")).toBe("2026-07-15T06:00:00.000Z");
  });
  test("an unknown zone falls back to UTC", () => {
    expect(zonedLocalToIso("2026-07-15T09:00", "Not/AZone")).toBe("2026-07-15T09:00:00.000Z");
  });
  test("an unparseable value is undefined", () => {
    expect(zonedLocalToIso("", "UTC")).toBeUndefined();
    expect(zonedLocalToIso("2026-02-31T10:00", "UTC")).toBeUndefined();
    expect(zonedLocalToIso("nope", "UTC")).toBeUndefined();
  });
});

describe("classifyPublishOutcome", () => {
  const res = (status: number, code?: string, requestId = "req-1", headers = new Headers()) => ({
    status,
    headers,
    error: code ? { error: { code, message: "x", request_id: requestId } } : undefined,
  });

  test("201 is saved; a replay is saved too", () => {
    expect(classifyPublishOutcome(res(201))).toEqual({ kind: "saved" });
    expect(
      classifyPublishOutcome(
        res(201, undefined, "r", new Headers({ "Idempotent-Replayed": "true" })),
      ),
    ).toEqual({ kind: "saved" });
  });
  test("409 changed concurrently asks to refresh and retry, keeping the draft", () => {
    expect(classifyPublishOutcome(res(409, "cash_variance_policy_changed_concurrently"))).toEqual({
      kind: "stale",
      messageKey: "cashPolicy.error.changedConcurrently",
      requestId: "req-1",
    });
  });
  test("409 idempotency_key_conflict is its own outcome and drops the key", () => {
    expect(classifyPublishOutcome(res(409, "idempotency_key_conflict"))).toMatchObject({
      kind: "key-conflict",
      messageKey: "cashPolicy.error.keyConflict",
    });
  });
  test("400 idempotency key faults regenerate the key silently", () => {
    expect(classifyPublishOutcome(res(400, "idempotency_key_required")).kind).toBe(
      "regenerate-key",
    );
    expect(classifyPublishOutcome(res(400, "idempotency_key_malformed")).kind).toBe(
      "regenerate-key",
    );
  });
  test("400 validation_error is a validation outcome", () => {
    expect(classifyPublishOutcome(res(400, "validation_error"))).toMatchObject({
      kind: "failed",
      messageKey: "cashPolicy.error.validation",
    });
  });
  test.each([
    ["policy_currency_unsupported", "cashPolicy.error.currencyUnsupported"],
    ["override_looser_than_tenant", "cashPolicy.error.looserThanTenant"],
    ["override_expiry_invalid", "cashPolicy.error.expiryNotFuture"],
    ["override_not_active", "cashPolicy.error.notActive"],
    ["something_new", "cashPolicy.error.validation"],
  ])("422 %s maps to %s", (code, messageKey) => {
    expect(classifyPublishOutcome(res(422, code))).toMatchObject({ kind: "failed", messageKey });
  });
  test("403 owner_approval_required and origin_rejected are distinct", () => {
    expect(classifyPublishOutcome(res(403, "owner_approval_required"))).toMatchObject({
      kind: "failed",
      messageKey: "cashPolicy.error.ownerApprovalRequired",
    });
    expect(classifyPublishOutcome(res(403, "origin_rejected"))).toMatchObject({
      kind: "failed",
      messageKey: "cashPolicy.error.originRejected",
    });
    expect(classifyPublishOutcome(res(403))).toMatchObject({
      messageKey: "cashPolicy.error.forbidden",
    });
  });
  test("404 is the non-disclosing unavailable message", () => {
    expect(classifyPublishOutcome(res(404, "not_found"))).toMatchObject({
      kind: "failed",
      messageKey: "cashPolicy.error.unavailable",
    });
  });
  test("401 is the session message", () => {
    expect(classifyPublishOutcome(res(401, "unauthorized"))).toMatchObject({
      messageKey: "cashPolicy.error.sessionExpired",
    });
  });
  test("425 (whose error body is a string) says it is still being processed", () => {
    expect(
      classifyPublishOutcome({
        status: 425,
        headers: new Headers(),
        error: { error: "idempotency_in_progress", retryAfterSec: 2 } as never,
      }),
    ).toMatchObject({ kind: "in-progress", messageKey: "cashPolicy.error.inProgress" });
  });
  test("5xx is generic and carries the request id when present", () => {
    expect(classifyPublishOutcome(res(500, "internal_error", "req-9"))).toEqual({
      kind: "failed",
      messageKey: "cashPolicy.error.generic",
      requestId: "req-9",
    });
  });
});

describe("amountForInput", () => {
  test.each([
    ["1250.0000", "1250"],
    ["1250.5000", "1250.5"],
    ["1250.2500", "1250.25"],
    ["0.0000", "0"],
    ["500", "500"],
    ["12.3456", "12.3456"],
  ])("%s is shown as %s", (stored, shown) => {
    expect(amountForInput(stored)).toBe(shown);
  });
  test("a missing amount is blank", () => {
    expect(amountForInput(undefined)).toBe("");
  });
});
