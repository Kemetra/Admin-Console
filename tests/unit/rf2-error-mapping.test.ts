import { translate } from "@/i18n";
import { type Rf2ErrorContext, mapRf2Error } from "@/lib/rf2-queries";
import { describe, expect, test } from "vitest";

/**
 * RF-2 typed-error mapping (T005). Maps the statuses the tenant/store contracts
 * document @ 62d0906 to a render decision the surfaces branch on. No 422/429
 * (contracts document none). The store 401 is a scope precondition, NOT a
 * session-expiry — it must render a scope prompt, never a sign-out, and must NOT
 * attempt a refresh (createAuthRetry is per-call to RF-1's context query only).
 */
function backend(requestId?: string) {
  return { error: { code: "x", message: "m", request_id: requestId } };
}

describe("mapRf2Error", () => {
  test("403 -> banner with request_id (action attempted, not pre-blocked)", () => {
    const r = mapRf2Error({ status: 403, error: backend("req-403"), context: "tenant" });
    expect(r.kind).toBe("banner");
    expect(r.messageKey).toBe("errors.forbidden");
    if (r.kind === "banner") {
      expect(r.requestId).toBe("req-403");
    }
  });

  test("404 -> uniform not-available (no absent-vs-no-access distinction)", () => {
    const r = mapRf2Error({ status: 404, context: "tenant" });
    expect(r.kind).toBe("not-found");
    expect(r.messageKey).toBe("errors.notFound");
  });

  test("409 on tenant -> inline conflict keyed to the slug field", () => {
    const r = mapRf2Error({ status: 409, context: "tenant" });
    expect(r.kind).toBe("conflict");
    expect(r.messageKey).toBe("tenants.errors.slugConflict");
    if (r.kind === "conflict") {
      expect(r.field).toBe("slug");
    }
  });

  test("409 on store -> inline conflict keyed to the code field", () => {
    const r = mapRf2Error({ status: 409, context: "store" });
    expect(r.kind).toBe("conflict");
    expect(r.messageKey).toBe("stores.errors.codeConflict");
    if (r.kind === "conflict") {
      expect(r.field).toBe("code");
    }
  });

  test("401 on a store op -> scope prompt (distinct from session expiry)", () => {
    const r = mapRf2Error({ status: 401, context: "store" });
    expect(r.kind).toBe("scope-required");
    expect(r.messageKey).toBe("stores.errors.scopeRequired");
  });

  test("401 on a tenant op -> generic (tenant ops document no 401; do not invent scope handling)", () => {
    const r = mapRf2Error({ status: 401, context: "tenant" });
    expect(r.kind).toBe("generic");
    expect(r.messageKey).toBe("errors.generic");
  });

  test("5xx -> retry-able banner", () => {
    const r = mapRf2Error({ status: 503, error: backend("req-503"), context: "store" });
    expect(r.kind).toBe("banner");
    expect(r.messageKey).toBe("errors.server");
    if (r.kind === "banner") {
      expect(r.retryable).toBe(true);
      expect(r.requestId).toBe("req-503");
    }
  });

  test("403 banner is not retryable", () => {
    const r = mapRf2Error({ status: 403, context: "store" });
    if (r.kind === "banner") {
      expect(r.retryable).toBe(false);
    }
  });

  test("missing request_id surfaces undefined, not a crash", () => {
    const r = mapRf2Error({ status: 403, context: "tenant" } satisfies Rf2ErrorContext);
    if (r.kind === "banner") {
      expect(r.requestId).toBeUndefined();
    }
  });

  test("the mapper returns catalog keys, never copy: each resolves in both locales", () => {
    // RT-399: the render decision is cached by TanStack Query, so it must hold
    // a key (translated at render), not a string frozen in one language.
    const cases: Rf2ErrorContext[] = [
      { status: 401, context: "store" },
      { status: 401, context: "tenant" },
      { status: 403, context: "tenant" },
      { status: 404, context: "store" },
      { status: 409, context: "tenant" },
      { status: 409, context: "store" },
      { status: 500, context: "tenant" },
      { status: 418, context: "store" },
    ];
    for (const input of cases) {
      const r = mapRf2Error(input);
      expect(r).not.toHaveProperty("message");
      expect(translate("ar", r.messageKey)).toMatch(/[\u0600-\u06FF]/);
      expect(translate("en", r.messageKey)).not.toMatch(/[\u0600-\u06FF]/);
    }
  });

  test("English copy is unchanged from the pre-catalog mapping", () => {
    const en = (input: Rf2ErrorContext) => translate("en", mapRf2Error(input).messageKey);
    expect(en({ status: 409, context: "tenant" })).toBe(
      "That slug is already in use. Choose a different one.",
    );
    expect(en({ status: 409, context: "store" })).toBe(
      "That store code is already in use in this tenant. Choose a different one.",
    );
    expect(en({ status: 401, context: "store" })).toBe("Select a tenant before managing stores.");
    expect(en({ status: 403, context: "store" })).toBe(
      "You do not have permission to perform this action.",
    );
    expect(en({ status: 404, context: "store" })).toBe("This resource is not available.");
    expect(en({ status: 503, context: "store" })).toBe("Something went wrong. Try again.");
    expect(en({ status: 401, context: "tenant" })).toBe("The request could not be completed.");
  });

  test("Arabic copy for the RF-2 conflicts and scope precondition", () => {
    const ar = (input: Rf2ErrorContext) => translate("ar", mapRf2Error(input).messageKey);
    expect(ar({ status: 409, context: "tenant" })).toBe(
      "هذا المعرّف المختصر مستخدم بالفعل. اختر معرّفًا آخر.",
    );
    expect(ar({ status: 409, context: "store" })).toBe(
      "رمز المتجر هذا مستخدم بالفعل في هذه المؤسسة. اختر رمزًا آخر.",
    );
    expect(ar({ status: 401, context: "store" })).toBe("اختر مؤسسة قبل إدارة المتاجر.");
  });
});

describe("mapRf2Error: store time zone codes (RT-477 / RT-401)", () => {
  const coded = (code: string, requestId = "req-tz") => ({
    error: { code, message: "m", request_id: requestId },
  });

  test("400 invalid_timezone -> an inline error on the time zone field", () => {
    const r = mapRf2Error({ status: 400, error: coded("invalid_timezone"), context: "store" });
    expect(r.kind).toBe("field-error");
    expect(r.messageKey).toBe("stores.errors.timezoneInvalid");
    if (r.kind === "field-error") expect(r.field).toBe("timezone");
  });

  test("409 timezone_changed_concurrently -> a banner with request_id, not a code conflict", () => {
    const r = mapRf2Error({
      status: 409,
      error: coded("timezone_changed_concurrently"),
      context: "store",
    });
    expect(r.kind).toBe("banner");
    expect(r.messageKey).toBe("stores.errors.timezoneChangedConcurrently");
    if (r.kind === "banner") {
      expect(r.requestId).toBe("req-tz");
      expect(r.retryable).toBe(false);
    }
  });

  test("409 store_has_open_shift -> a banner with request_id, not a code conflict", () => {
    const r = mapRf2Error({ status: 409, error: coded("store_has_open_shift"), context: "store" });
    expect(r.kind).toBe("banner");
    expect(r.messageKey).toBe("stores.errors.storeHasOpenShift");
    if (r.kind === "banner") expect(r.requestId).toBe("req-tz");
  });

  test("any other 409 on a store stays the inline code conflict", () => {
    const r = mapRf2Error({ status: 409, error: coded("store_code_conflict"), context: "store" });
    expect(r.kind).toBe("conflict");
  });

  test("the time zone codes mean nothing on a tenant", () => {
    const r = mapRf2Error({ status: 409, error: coded("store_has_open_shift"), context: "tenant" });
    expect(r.kind).toBe("conflict");
  });
});
