import { describe, expect, test } from "vitest";

import {
  EXPIRING_THRESHOLD_MS,
  classifyEnd,
  classifyRenew,
  deriveSupportSessionState,
  remainingMinutes,
  remainingMs,
  sessionStamp,
} from "@/platform/session/supportSessionLogic";

/**
 * RT-781 (RT-777 S2): the derived bar states and the contract-code mapping.
 * Codes are those of `platform-support-sessions.openapi.yaml` at the pin.
 */
const NOW = Date.parse("2026-10-22T10:00:00Z");
const at = (ms: number) => new Date(NOW + ms).toISOString();
const MIN = 60_000;

function session(over: { status?: "active" | "expired"; left?: number; capIn?: number } = {}) {
  return {
    status: over.status ?? "active",
    expires_at: at(over.left ?? 40 * MIN),
    renewal_cap_at: at(over.capIn ?? 8 * 60 * MIN),
  };
}

describe("deriveSupportSessionState", () => {
  test("active when well before expiry and the cap", () => {
    expect(deriveSupportSessionState({ session: session(), now: NOW })).toBe("active");
  });

  test("expiring at the threshold and below it, active just above it", () => {
    const at5 = session({ left: EXPIRING_THRESHOLD_MS });
    expect(deriveSupportSessionState({ session: at5, now: NOW })).toBe("expiring");
    expect(
      deriveSupportSessionState({
        session: session({ left: EXPIRING_THRESHOLD_MS + 1 }),
        now: NOW,
      }),
    ).toBe("active");
    expect(deriveSupportSessionState({ session: session({ left: 1_000 }), now: NOW })).toBe(
      "expiring",
    );
  });

  test("the server status expired always wins, even with time left", () => {
    expect(
      deriveSupportSessionState({
        session: session({ status: "expired", left: 30 * MIN }),
        now: NOW,
      }),
    ).toBe("expired");
  });

  test("the countdown reaching zero is expired, and so is a past expires_at", () => {
    expect(deriveSupportSessionState({ session: session({ left: 0 }), now: NOW })).toBe("expired");
    expect(deriveSupportSessionState({ session: session({ left: -MIN }), now: NOW })).toBe(
      "expired",
    );
  });

  test("an unparseable expires_at fails closed to expired", () => {
    const bad = { ...session(), expires_at: "not-a-date" };
    expect(deriveSupportSessionState({ session: bad, now: NOW })).toBe("expired");
  });

  test("a tenant call refused with support_session_expired forces expired", () => {
    expect(deriveSupportSessionState({ session: session(), now: NOW, refusedExpired: true })).toBe(
      "expired",
    );
  });

  test("cap reached when expires_at meets or passes renewal_cap_at", () => {
    expect(
      deriveSupportSessionState({ session: session({ left: 9 * MIN, capIn: 9 * MIN }), now: NOW }),
    ).toBe("cap_reached");
    expect(
      deriveSupportSessionState({
        session: session({ left: 20 * MIN, capIn: 10 * MIN }),
        now: NOW,
      }),
    ).toBe("cap_reached");
  });

  test("a renew cap 409 forces cap reached even when the dates say renewable", () => {
    expect(deriveSupportSessionState({ session: session(), now: NOW, capRefused: true })).toBe(
      "cap_reached",
    );
  });

  test("precedence: expired beats cap reached beats expiring", () => {
    const both = session({ left: 2 * MIN, capIn: 2 * MIN });
    expect(deriveSupportSessionState({ session: both, now: NOW })).toBe("cap_reached");
    expect(deriveSupportSessionState({ session: { ...both, status: "expired" }, now: NOW })).toBe(
      "expired",
    );
  });
});

describe("remaining time", () => {
  test("remainingMs never goes negative and counts from the server expires_at", () => {
    expect(remainingMs(at(90_000), NOW)).toBe(90_000);
    expect(remainingMs(at(-5_000), NOW)).toBe(0);
  });

  test("whole minutes round up so one minute shows until the last second", () => {
    expect(remainingMinutes(60 * MIN)).toBe(60);
    expect(remainingMinutes(MIN + 1)).toBe(2);
    expect(remainingMinutes(1_000)).toBe(1);
    expect(remainingMinutes(0)).toBe(0);
  });

  test("the stamp ties a refusal to one expires_at of one session", () => {
    const a = { id: "s1", expires_at: at(MIN) };
    expect(sessionStamp(a)).toBe(sessionStamp({ ...a }));
    expect(sessionStamp(a)).not.toBe(sessionStamp({ ...a, expires_at: at(2 * MIN) }));
    expect(sessionStamp(a)).not.toBe(sessionStamp({ ...a, id: "s2" }));
  });
});

const err = (code: string, request_id = "req-1") => ({ error: { code, request_id } });

describe("classifyRenew: every contract code", () => {
  test("200 is done", () => {
    expect(classifyRenew({ status: 200 })).toEqual({ kind: "done" });
  });

  test("409 support_session_renewal_cap_reached is the cap state", () => {
    expect(
      classifyRenew({ status: 409, error: err("support_session_renewal_cap_reached") }),
    ).toEqual({ kind: "cap" });
  });

  test("409 support_session_expired is the expired state (a 409 on renew, not a 403)", () => {
    expect(classifyRenew({ status: 409, error: err("support_session_expired") })).toEqual({
      kind: "expired",
    });
  });

  test("409 support_session_absent means the session is gone", () => {
    expect(classifyRenew({ status: 409, error: err("support_session_absent") })).toEqual({
      kind: "gone",
    });
  });

  test("429 is left to the shared banner and 401 to the context read", () => {
    expect(classifyRenew({ status: 429, error: err("rate_limited") })).toEqual({
      kind: "rate-limited",
    });
    expect(classifyRenew({ status: 401 })).toEqual({ kind: "unauthenticated" });
  });

  test("403 forbidden and origin_rejected are inline errors, never the expired state", () => {
    expect(classifyRenew({ status: 403, error: err("forbidden") })).toEqual({
      kind: "failed",
      messageKey: "platform.session.error.forbidden",
      requestId: "req-1",
    });
    expect(classifyRenew({ status: 403, error: err("origin_rejected") })).toEqual({
      kind: "failed",
      messageKey: "platform.session.error.originRejected",
      requestId: "req-1",
    });
    // Even the code that means "expired" on a tenant call is not the expired state here.
    expect(classifyRenew({ status: 403, error: err("support_session_expired") }).kind).toBe(
      "failed",
    );
  });

  test("500 and an unknown 409 code are a generic inline error", () => {
    expect(classifyRenew({ status: 500, error: err("system_failure") })).toMatchObject({
      kind: "failed",
      messageKey: "platform.session.error.failed",
    });
    expect(classifyRenew({ status: 409, error: err("something_else") }).kind).toBe("failed");
  });
});

describe("classifyEnd: every contract code", () => {
  test("200 is done; 409 support_session_absent is also done (already ended)", () => {
    expect(classifyEnd({ status: 200 })).toEqual({ kind: "done" });
    expect(classifyEnd({ status: 409, error: err("support_session_absent") })).toEqual({
      kind: "gone",
    });
  });

  test("429, 401, 403 and 500 map as on renew", () => {
    expect(classifyEnd({ status: 429 }).kind).toBe("rate-limited");
    expect(classifyEnd({ status: 401 }).kind).toBe("unauthenticated");
    expect(classifyEnd({ status: 403, error: err("forbidden") })).toMatchObject({
      kind: "failed",
      messageKey: "platform.session.error.forbidden",
    });
    expect(classifyEnd({ status: 500 })).toMatchObject({
      kind: "failed",
      messageKey: "platform.session.error.failed",
    });
  });

  test("a renew-only code on end is not mistaken for a state", () => {
    expect(
      classifyEnd({ status: 409, error: err("support_session_renewal_cap_reached") }).kind,
    ).toBe("failed");
  });
});
