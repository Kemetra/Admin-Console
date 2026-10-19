import { ar } from "@/i18n/messages/ar";
import { en } from "@/i18n/messages/en";
import {
  canUseSaleSyncOps,
  classificationKey,
  classifyRepair,
  eventKey,
  isRepairable,
  isStoreFilter,
  keepsKey,
  newIdempotencyKey,
  readErrorKind,
  syncStatusView,
} from "@/sale-sync/saleSyncLogic";
import { describe, expect, test } from "vitest";
import { SALE, STORE, deadLetter, syncStatus } from "./sale-sync-fixtures";

const RID = "11111111-2222-4333-8444-555555555555";
const err = (code: string) => ({ error: { code, message: "x", request_id: RID } });

describe("role gate (mirrors @Roles('owner', 'tenant_admin'))", () => {
  test.each(["owner", "tenant_admin"])("%s may use sale sync-ops", (role) => {
    expect(canUseSaleSyncOps(role)).toBe(true);
  });
  test.each(["store_manager", "store_staff", "cashier", "auditor", "", null, undefined])(
    "%s may not",
    (role) => {
      expect(canUseSaleSyncOps(role)).toBe(false);
    },
  );
});

describe("sync status copy never speaks for ERPNext (RT-642)", () => {
  test("each contract value has its own label and meaning", () => {
    expect(syncStatusView("captured").labelKey).toBe("saleSync.status.captured");
    expect(syncStatusView("synced").labelKey).toBe("saleSync.status.synced");
    expect(syncStatusView("failed-retryable").labelKey).toBe("saleSync.status.failedRetryable");
    expect(syncStatusView("failed-needs-repair").labelKey).toBe(
      "saleSync.status.failedNeedsRepair",
    );
  });

  test("an unrecognised code is unknown, in the danger tone", () => {
    const view = syncStatusView("posted");
    expect(view.labelKey).toBe("saleSync.status.unknown");
    expect(view.badge).toBe("badge--suspended");
  });

  test("synced says it is not ERPNext posting, in both locales", () => {
    const key = syncStatusView("synced").meaningKey;
    expect(en[key]).toMatch(/does not mean it is posted to ERPNext/);
    expect(ar[key]).toContain("لا يعني أنه رُحِّل إلى ERPNext");
  });

  test("unknown is neither posted nor not posted", () => {
    expect(en[syncStatusView("??").meaningKey]).toMatch(/neither posted nor not posted/);
  });

  test("no open dead letter is never posted", () => {
    expect(en["saleSync.deadLetter.none"]).toMatch(/does not mean it is posted to ERPNext/);
    expect(en["saleSync.list.emptyHint"]).toMatch(/does not mean every sale is posted/);
  });

  test("no sync-ops label claims a posting", () => {
    for (const [key, value] of Object.entries(en)) {
      if (!key.startsWith("saleSync.status.") && !key.startsWith("saleSync.event.")) continue;
      expect(String(value), key).not.toMatch(/posted|ERPNext/i);
    }
  });
});

describe("repairable", () => {
  test("only NEEDS_REPAIR with an open dead letter", () => {
    expect(isRepairable(syncStatus())).toBe(true);
    expect(isRepairable(syncStatus({ deadLetter: null }))).toBe(false);
    expect(
      isRepairable(syncStatus({ deadLetter: deadLetter({ resolvedAt: "2026-10-08T10:00:00Z" }) })),
    ).toBe(false);
    expect(isRepairable(syncStatus({ syncStatus: "failed-retryable" }))).toBe(false);
    expect(isRepairable(syncStatus({ syncStatus: "synced", deadLetter: null }))).toBe(false);
  });
});

describe("labels", () => {
  test("the timeline events Backend-Core emits each have a label", () => {
    for (const event of [
      "sale.captured",
      "sync.synced",
      "sync.retryable",
      "sync.needs_repair",
      "repair.resolved",
      "sync.failed",
      "repair.requested",
    ]) {
      expect(eventKey(event)).not.toBe("saleSync.event.unknown");
    }
    expect(eventKey("ledger.posted")).toBe("saleSync.event.unknown");
  });

  test("dead letter classifications", () => {
    expect(classificationKey("needs-repair")).toBe("saleSync.deadLetter.needsRepair");
    expect(classificationKey("retryable")).toBe("saleSync.deadLetter.retryable");
    expect(classificationKey("other")).toBe("saleSync.deadLetter.unknown");
  });

  test("store filter: empty or a UUID only", () => {
    expect(isStoreFilter("")).toBe(true);
    expect(isStoreFilter(STORE)).toBe(true);
    expect(isStoreFilter("CAI")).toBe(false);
  });

  test("read error kinds per status", () => {
    expect(readErrorKind(400)).toBe("rejected");
    expect(readErrorKind(401)).toBe("session");
    expect(readErrorKind(403)).toBe("forbidden");
    expect(readErrorKind(404)).toBe("not-found");
    expect(readErrorKind(429)).toBe("rate-limited");
    expect(readErrorKind(500)).toBe("generic");
  });
});

describe("classifyRepair (consoleRepairSaleSync response set)", () => {
  test("200 is the server's new status", () => {
    const status = syncStatus({ syncStatus: "failed-retryable", deadLetter: null });
    expect(classifyRepair({ status: 200, data: status })).toEqual({ kind: "repaired", status });
  });

  test.each([
    [400, "validation_error", "rejected", "saleSync.repair.error.rejected"],
    [401, "unauthenticated", "session", "saleSync.error.session"],
    [403, "forbidden", "forbidden", "saleSync.repair.error.forbidden"],
    [403, "origin_rejected", "forbidden", "saleSync.repair.error.originRejected"],
    [404, "not_found", "not-found", "saleSync.repair.error.notFound"],
    [409, "repair_conflict", "conflict", "saleSync.repair.error.conflict"],
    [409, "idempotency_key_conflict", "key-conflict", "saleSync.repair.error.keyConflict"],
    [429, "rate_limited", "rate-limited", "saleSync.repair.error.rateLimited"],
    [500, "system_failure", "unconfirmed", "saleSync.repair.error.unconfirmed"],
    [502, "bad_gateway", "unconfirmed", "saleSync.repair.error.unconfirmed"],
  ])("%i %s → %s", (status, code, kind, messageKey) => {
    expect(classifyRepair({ status, error: err(code) })).toEqual({
      kind,
      messageKey,
      requestId: RID,
      ...(kind === "rate-limited" ? { retryAfter: undefined } : {}),
    });
  });

  test("429 with Retry-After carries the wait", () => {
    expect(classifyRepair({ status: 429, error: err("rate_limited"), retryAfter: 30 })).toEqual({
      kind: "rate-limited",
      messageKey: "saleSync.repair.error.rateLimitedFor",
      requestId: RID,
      retryAfter: 30,
    });
  });

  test("no response at all is unconfirmed, never failed", () => {
    expect(classifyRepair({ status: 0 }).kind).toBe("unconfirmed");
  });

  test("200 without a body is not a repair", () => {
    expect(classifyRepair({ status: 200 }).kind).toBe("unconfirmed");
  });

  test("only an unanswered attempt keeps its key for a replay", () => {
    expect(keepsKey(classifyRepair({ status: 500 }))).toBe(true);
    expect(keepsKey(classifyRepair({ status: 429 }))).toBe(true);
    for (const status of [400, 401, 403, 404, 409]) {
      expect(keepsKey(classifyRepair({ status })), String(status)).toBe(false);
    }
    expect(keepsKey(classifyRepair({ status: 200, data: syncStatus() }))).toBe(false);
  });

  test("keys are fresh v4 UUIDs", () => {
    const a = newIdempotencyKey();
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(newIdempotencyKey()).not.toBe(a);
    expect(SALE).not.toBe(a);
  });
});
