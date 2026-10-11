import { resolveSignIn } from "@/auth/signin-flow";
import { translate } from "@/i18n";
import { describe, expect, test } from "vitest";

/**
 * Sign-in response branching + post-sign-in resolution (SF-1, T021/T023).
 * Pure decision logic — given a signIn response (+ a way to read memberships),
 * decide what the UI should do next. No React; testable in isolation.
 *
 * - 401 -> generic error, no account-existence leak, surfaces request_id.
 * - 429 -> retry-after, submit disabled, retry seconds parsed.
 * - success + memberships===1 -> auto-select that tenant (OQ-4), go to shell.
 * - success + memberships>1 -> show scope chooser (S2).
 * - success + memberships===0 -> no-access (S7).
 *
 * RT-399: the error outcome is a catalog key, translated by SF-1 at render.
 */
describe("resolveSignIn", () => {
  test("401 -> generic error with request_id, no leak", () => {
    const r = resolveSignIn({
      status: 401,
      error: { error: { code: "invalid_credentials", message: "x", request_id: "req-1" } },
    });
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.messageKey).toBe("auth.signIn.errors.failed");
      expect(r.requestId).toBe("req-1");
      const copy = translate("en", r.messageKey);
      expect(copy).toBe("Sign-in failed. Check your email and password, then try again.");
      expect(copy).not.toMatch(/email .* not found|no account|unknown user/i);
    }
  });

  test("429 -> retry-after with parsed seconds and disabled submit", () => {
    const r = resolveSignIn({
      status: 429,
      error: { error: { request_id: "req-2" } },
      retryAfterSeconds: 27,
    });
    expect(r.kind).toBe("rate-limited");
    if (r.kind === "rate-limited") {
      expect(r.retryAfterSeconds).toBe(27);
      expect(r.requestId).toBe("req-2");
    }
  });

  test("success + single membership -> auto-select (OQ-4)", () => {
    const r = resolveSignIn({
      status: 200,
      data: { memberships: [{ tenant_id: "t1", tenant_name: "Northstar" }] },
    });
    expect(r.kind).toBe("auto-select");
    if (r.kind === "auto-select") {
      expect(r.tenantId).toBe("t1");
    }
  });

  test("success + multiple memberships -> chooser (S2)", () => {
    const r = resolveSignIn({
      status: 200,
      data: {
        memberships: [
          { tenant_id: "t1", tenant_name: "A" },
          { tenant_id: "t2", tenant_name: "B" },
        ],
      },
    });
    expect(r.kind).toBe("choose");
  });

  test("success + zero memberships -> no-access (S7)", () => {
    const r = resolveSignIn({ status: 200, data: { memberships: [] } });
    expect(r.kind).toBe("no-access");
  });

  test("5xx -> generic error", () => {
    const r = resolveSignIn({ status: 503, error: { error: { request_id: "req-5" } } });
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      // The same generic key as a 401: a 5xx never reads differently (FR-003-007).
      expect(r.messageKey).toBe("auth.signIn.errors.failed");
      expect(r.requestId).toBe("req-5");
    }
  });
});
