import { decideImpact } from "@/devices/impactDecision";
import { classifyMutationFailure, noticeKeyFor } from "@/devices/lifecycleFailure";
import {
  REVOKE_REASON_GROUPS,
  buildRevokeBody,
  validateOperatorText,
} from "@/devices/lifecycleLogic";
import { describe, expect, test } from "vitest";
import { DEVICE_1, SHIFT_OPEN } from "./device-fixtures";
import { impact } from "./device-lifecycle-fixtures";

describe("decideImpact (the server's verdict, rendered, never recomputed)", () => {
  test("allowed with no requirements is ready and needs nothing", () => {
    expect(decideImpact(impact())).toEqual({
      kind: "ready",
      custody: false,
      needs: { note: false, acknowledge: false },
    });
  });

  test("a revoke with `other` carries `note` and the form asks for it", () => {
    const view = decideImpact(impact({ revokeReason: "other", requires: ["note"] }));
    expect(view).toEqual({
      kind: "ready",
      custody: false,
      needs: { note: true, acknowledge: false },
    });
  });

  test("allowed_with_custody_exception for a recovery revoke needs the note and the acknowledgement", () => {
    const view = decideImpact(
      impact({
        verdict: "allowed_with_custody_exception",
        revokeReason: "hardware_failure",
        requires: ["owner_or_tenant_admin", "note", "acknowledge_custody_exception"],
        openShift: { shiftId: SHIFT_OPEN },
      }),
    );
    expect(view).toEqual({
      kind: "ready",
      custody: true,
      needs: { note: true, acknowledge: true },
    });
  });

  test("a security revoke over an open shift is a custody exception with no extra input", () => {
    const view = decideImpact(
      impact({
        verdict: "allowed_with_custody_exception",
        revokeReason: "stolen",
        openShift: { shiftId: SHIFT_OPEN },
      }),
    );
    expect(view).toEqual({
      kind: "ready",
      custody: true,
      needs: { note: false, acknowledge: false },
    });
  });

  test("forbidden_recovery is its own state: the role cannot do it", () => {
    const view = decideImpact(
      impact({
        verdict: "forbidden_recovery",
        revokeReason: "hardware_failure",
        requires: ["owner_or_tenant_admin", "note", "acknowledge_custody_exception"],
        openShift: { shiftId: SHIFT_OPEN },
      }),
    );
    expect(view).toEqual({ kind: "forbidden" });
  });

  test("blocked carries the block code, known or not", () => {
    expect(
      decideImpact(impact({ verdict: "blocked", blockCode: "unresolved_cash_session" })),
    ).toEqual({ kind: "blocked", blockCode: "unresolved_cash_session", known: true });
    expect(decideImpact(impact({ verdict: "blocked", blockCode: "something_new" }))).toEqual({
      kind: "blocked",
      blockCode: "something_new",
      known: false,
    });
  });

  test("an unknown verdict is blocked: it never offers to proceed", () => {
    expect(decideImpact(impact({ verdict: "allowed_after_review" }))).toEqual({
      kind: "blocked",
      blockCode: null,
      known: false,
    });
  });

  test("an unknown requirement is unmet: no action is offered", () => {
    expect(decideImpact(impact({ requires: ["second_approver"] }))).toEqual({
      kind: "blocked",
      blockCode: null,
      known: false,
    });
  });

  test("no_change means the action has already happened", () => {
    expect(decideImpact(impact({ verdict: "no_change", trustState: "revoked" }))).toEqual({
      kind: "no_change",
    });
  });
});

describe("revoke reasons", () => {
  test("security reasons are their own group; replaced, moved and retired have their own flows", () => {
    const security = REVOKE_REASON_GROUPS.find((g) => g.id === "security");
    const other = REVOKE_REASON_GROUPS.find((g) => g.id === "other");
    expect(security?.reasons).toEqual(["lost", "stolen", "suspected_compromise"]);
    expect(other?.reasons).toEqual(["hardware_failure", "admin_error", "other"]);
    const offered = REVOKE_REASON_GROUPS.flatMap((g) => g.reasons);
    expect(offered).not.toContain("replaced");
    expect(offered).not.toContain("moved");
    expect(offered).not.toContain("retired");
  });
});

describe("validateOperatorText", () => {
  test("optional text may be empty, but never blank-with-content or over 500", () => {
    expect(validateOperatorText("", false)).toBeNull();
    expect(validateOperatorText("x".repeat(501), false)).toBe("tooLong");
  });
  test("required text must have a non-blank character", () => {
    expect(validateOperatorText("", true)).toBe("required");
    expect(validateOperatorText("   \n ", true)).toBe("required");
    expect(validateOperatorText("Drawer cash is in the safe", true)).toBeNull();
  });
  test("a NUL character is refused (Postgres text cannot store it)", () => {
    expect(validateOperatorText("a\u0000b", true)).toBe("invalid");
  });
});

describe("buildRevokeBody", () => {
  test("sends the reason; a blank note and an unticked acknowledgement are omitted", () => {
    expect(buildRevokeBody({ reason: "lost", note: "  ", acknowledge: false })).toEqual({
      reason: "lost",
    });
  });
  test("sends the trimmed note and the acknowledgement when given", () => {
    expect(
      buildRevokeBody({ reason: "hardware_failure", note: " Cash in safe ", acknowledge: true }),
    ).toEqual({
      reason: "hardware_failure",
      note: "Cash in safe",
      acknowledgeCustodyException: true,
    });
  });
});

describe("classifyMutationFailure", () => {
  const body = (code: string, details?: unknown) => ({
    error: { code, message: "m", request_id: "req-9", ...(details ? { details } : {}) },
  });

  test("409 carries the fresh preview the server computed under its lock", () => {
    const details = impact({ verdict: "blocked", blockCode: "unresolved_cash_session" });
    expect(
      classifyMutationFailure({ status: 409, error: body("unresolved_cash_session", details) }),
    ).toEqual({
      kind: "conflict",
      code: "unresolved_cash_session",
      preview: details,
      requestId: "req-9",
    });
  });

  test("409 without details (a server before RT-366) has no preview", () => {
    const failure = classifyMutationFailure({
      status: 409,
      error: body("unresolved_cash_session"),
    });
    expect(failure).toMatchObject({ kind: "conflict", code: "unresolved_cash_session" });
    expect(failure).not.toHaveProperty("preview");
  });

  test("403 recovery_revoke_forbidden is the role refusal; any other 403 is generic", () => {
    expect(
      classifyMutationFailure({ status: 403, error: body("recovery_revoke_forbidden") }),
    ).toMatchObject({ kind: "forbidden-recovery" });
    expect(classifyMutationFailure({ status: 403, error: body("origin_rejected") })).toMatchObject({
      kind: "generic",
    });
  });

  test("422 names the first unmet requirement", () => {
    expect(
      classifyMutationFailure({ status: 422, error: body("recovery_note_required") }),
    ).toMatchObject({ kind: "unmet", code: "recovery_note_required" });
    expect(
      classifyMutationFailure({ status: 422, error: body("custody_exception_not_acknowledged") }),
    ).toMatchObject({ kind: "unmet", code: "custody_exception_not_acknowledged" });
  });

  test("each 422 reads as what it names; an unrecognised 422 is a rejected value, not a custody acknowledgement", () => {
    const key = (code: string) =>
      noticeKeyFor(classifyMutationFailure({ status: 422, error: body(code) }));
    expect(key("recovery_note_required")).toBe("devices.flow.error.unmetNote");
    expect(key("custody_exception_not_acknowledged")).toBe("devices.flow.error.unmetAcknowledge");
    expect(key("something_else")).toBe("devices.flow.error.validation");
  });

  test("404 is the one non-disclosing refusal; 400 a rejected value; 401 an ended session", () => {
    expect(classifyMutationFailure({ status: 404, error: body("not_found") }).kind).toBe(
      "not-found",
    );
    expect(classifyMutationFailure({ status: 400, error: body("validation_error") }).kind).toBe(
      "validation",
    );
    expect(classifyMutationFailure({ status: 401, error: body("x") }).kind).toBe("session");
  });

  test("anything else is generic and keeps the request id", () => {
    expect(classifyMutationFailure({ status: 500, error: body("system_failure") })).toEqual({
      kind: "generic",
      requestId: "req-9",
    });
    expect(classifyMutationFailure({ status: 0 })).toEqual({ kind: "generic" });
  });

  test("the device id is machine data, untouched", () => {
    expect(impact().deviceId).toBe(DEVICE_1);
  });
});
