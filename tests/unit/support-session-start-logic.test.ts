import { describe, expect, test } from "vitest";

import {
  SUPPORT_PURPOSES,
  TICKET_REF_PATTERN,
  buildOpenRequest,
  classifyOpen,
} from "@/platform/start/startSessionLogic";

/**
 * RT-782 (RT-777 S3): the start drawer's request body and outcome mapping.
 * Enum, pattern and codes are those of `platform-support-sessions.openapi.yaml`
 * at the pin (blob b1bde3d4): `OpenSupportSessionRequest` is
 * `additionalProperties: false` with `tenant_id`, `purpose` and the optional
 * `ticket_ref`, and nothing else (DEC-1: no free-text reason).
 */
const TENANT = "0190f000-0000-7000-8000-000000000001";

describe("contract constants", () => {
  test("the purpose enum is the contract's closed set", () => {
    expect([...SUPPORT_PURPOSES]).toEqual(["customer_support", "incident", "onboarding"]);
  });

  test("the ticket pattern is the contract's, byte for byte", () => {
    expect(TICKET_REF_PATTERN.source).toBe("^[A-Za-z0-9][A-Za-z0-9._:#/-]{0,63}$");
  });
});

describe("buildOpenRequest", () => {
  test("carries exactly tenant_id and purpose when no ticket is given", () => {
    const built = buildOpenRequest(TENANT, { purpose: "incident", ticketRef: "" });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(Object.keys(built.body).sort()).toEqual(["purpose", "tenant_id"]);
    expect(built.body).toEqual({ tenant_id: TENANT, purpose: "incident" });
  });

  test("a blank or whitespace ticket is omitted, never sent as an empty string", () => {
    const built = buildOpenRequest(TENANT, { purpose: "onboarding", ticketRef: "   " });
    expect(built.ok && "ticket_ref" in built.body).toBe(false);
  });

  test("carries exactly the three contract keys with a ticket, trimmed", () => {
    const built = buildOpenRequest(TENANT, {
      purpose: "customer_support",
      ticketRef: "  SUP-2291  ",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(Object.keys(built.body).sort()).toEqual(["purpose", "tenant_id", "ticket_ref"]);
    expect(built.body.ticket_ref).toBe("SUP-2291");
  });

  test("ignores any extra draft field: nothing beyond the contract reaches the body", () => {
    const draft = { purpose: "incident", ticketRef: "", reason: "free text", note: "x" };
    const built = buildOpenRequest(TENANT, draft);
    expect(built.ok && Object.keys(built.body).sort()).toEqual(["purpose", "tenant_id"]);
  });

  test("a missing purpose is refused before any request", () => {
    const built = buildOpenRequest(TENANT, { purpose: "", ticketRef: "" });
    expect(built).toEqual({
      ok: false,
      errors: { purpose: "platform.start.purpose.required" },
    });
  });

  test("a purpose outside the enum is refused", () => {
    const built = buildOpenRequest(TENANT, { purpose: "audit", ticketRef: "" });
    expect(built.ok).toBe(false);
  });

  test.each([
    ["has a space", "SUP 2291"],
    ["holds an email", "ops@kemetra.test"],
    ["starts with a symbol", "-SUP"],
    ["is 65 characters", "A".repeat(65)],
    ["uses Arabic letters", "تذكرة1"],
  ])("a ticket that %s is refused", (_label, ticketRef) => {
    const built = buildOpenRequest(TENANT, { purpose: "incident", ticketRef });
    expect(built).toEqual({
      ok: false,
      errors: { ticketRef: "platform.start.ticket.invalid" },
    });
  });

  test.each([["SUP-2291"], ["a"], ["JIRA:RT/782#1_x.y"], ["A".repeat(64)]])(
    "the ticket %s is accepted",
    (ticketRef) => {
      expect(buildOpenRequest(TENANT, { purpose: "incident", ticketRef }).ok).toBe(true);
    },
  );

  test("both errors are reported together", () => {
    const built = buildOpenRequest(TENANT, { purpose: "", ticketRef: "bad ref" });
    expect(built).toEqual({
      ok: false,
      errors: {
        purpose: "platform.start.purpose.required",
        ticketRef: "platform.start.ticket.invalid",
      },
    });
  });
});

const refusal = (code: string, request_id = "req-1") => ({
  error: { code, message: "m", request_id },
});

describe("classifyOpen (openSupportSession outcomes)", () => {
  test("201 opened", () => {
    expect(classifyOpen({ status: 201 })).toEqual({ kind: "opened" });
  });

  test("404 TenantNotFound is the one non-disclosing state, with its request id", () => {
    expect(classifyOpen({ status: 404, error: refusal("not_found", "req-404") })).toEqual({
      kind: "not-found",
      requestId: "req-404",
    });
  });

  test("409 already_member leads to the normal tenant switch", () => {
    expect(classifyOpen({ status: 409, error: refusal("already_member") })).toEqual({
      kind: "already-member",
    });
  });

  test("a 409 with another code is a failure, not the member state", () => {
    expect(classifyOpen({ status: 409, error: refusal("conflict") }).kind).toBe("failed");
  });

  test("429 is left to the rate-limit gate", () => {
    expect(classifyOpen({ status: 429, error: refusal("rate_limited") })).toEqual({
      kind: "rate-limited",
    });
  });

  test("401 lets the context read decide", () => {
    expect(classifyOpen({ status: 401 })).toEqual({ kind: "unauthenticated" });
  });

  test("403 forbidden names that the account cannot open a session", () => {
    expect(classifyOpen({ status: 403, error: refusal("forbidden", "req-403") })).toEqual({
      kind: "failed",
      messageKey: "platform.start.error.forbidden",
      requestId: "req-403",
    });
  });

  test("403 origin_rejected names the origin, not a permission", () => {
    expect(classifyOpen({ status: 403, error: refusal("origin_rejected") })).toEqual({
      kind: "failed",
      messageKey: "platform.session.error.originRejected",
      requestId: "req-1",
    });
  });

  test.each([[400], [500], [502]])("%i is a generic failure with its request id", (status) => {
    expect(classifyOpen({ status, error: refusal("x", "req-x") })).toEqual({
      kind: "failed",
      messageKey: "platform.start.error.failed",
      requestId: "req-x",
    });
  });
});
