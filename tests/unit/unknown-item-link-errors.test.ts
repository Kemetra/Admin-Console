import { mapUnknownItemError } from "@/lib/unknown-items-queries";
import { describe, expect, test } from "vitest";

/**
 * RT-767: every documented failure of `tenantAdminLinkUnknownItem`, status by
 * status and code by code. Link has no `Idempotency-Key` and no 425, so a 425 is
 * not a documented link status. The conflicting product is never named
 * (FR-042): the mapper returns catalog keys only.
 */
const REQ = "req-link-1";
const err = (status: number, code: string) => ({
  status,
  op: "link" as const,
  error: { error: { code, message: "backend english", request_id: REQ } },
});

describe("link failures", () => {
  test.each([
    [
      "400 validation_error",
      err(400, "validation_error"),
      { kind: "validation", messageKey: "unknownItems.errors.linkValidation", requestId: REQ },
    ],
    [
      "401",
      err(401, "unauthenticated"),
      { kind: "generic", messageKey: "errors.generic", requestId: REQ },
    ],
    [
      "403 forbidden",
      err(403, "forbidden"),
      {
        kind: "banner",
        messageKey: "unknownItems.errors.forbidden",
        requestId: REQ,
        retryable: false,
      },
    ],
    [
      "403 origin_rejected",
      err(403, "origin_rejected"),
      {
        kind: "banner",
        messageKey: "unknownItems.errors.originRejected",
        requestId: REQ,
        retryable: false,
      },
    ],
    [
      "404",
      err(404, "not_found"),
      { kind: "not-found", messageKey: "unknownItems.errors.notFound" },
    ],
    [
      "409 alias_conflict",
      err(409, "alias_conflict"),
      {
        kind: "alias-conflict",
        messageKey: "unknownItems.errors.linkAliasConflict",
        requestId: REQ,
      },
    ],
    [
      "409 target_unavailable",
      err(409, "target_unavailable"),
      {
        kind: "target-unavailable",
        messageKey: "unknownItems.errors.targetUnavailable",
        requestId: REQ,
      },
    ],
    [
      "409 already_reconciled",
      err(409, "already_reconciled"),
      { kind: "already-reconciled", messageKey: "unknownItems.errors.alreadyReconciled" },
    ],
    [
      "409 with a code this build does not know",
      err(409, "something_new"),
      { kind: "generic", messageKey: "errors.generic", requestId: REQ },
    ],
    [
      "429 rate_limited",
      err(429, "rate_limited"),
      {
        kind: "banner",
        messageKey: "unknownItems.errors.rateLimited",
        requestId: REQ,
        retryable: false,
      },
    ],
    [
      "500",
      err(500, "internal"),
      { kind: "banner", messageKey: "errors.server", requestId: REQ, retryable: true },
    ],
    [
      "425 (not documented for link)",
      err(425, "idempotency_in_progress"),
      { kind: "generic", messageKey: "errors.generic", requestId: REQ },
    ],
  ])("%s", (_name, input, expected) => {
    expect(mapUnknownItemError(input)).toEqual(expected);
  });

  test("a link 409 never carries the backend's text or any product name", () => {
    const render = mapUnknownItemError({
      status: 409,
      op: "link",
      error: { error: { code: "alias_conflict", message: "bound to Cola 330ml", request_id: REQ } },
    });
    expect(JSON.stringify(render)).not.toContain("Cola");
  });
});
