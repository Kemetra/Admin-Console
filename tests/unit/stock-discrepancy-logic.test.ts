import {
  PENDING_OVERDUE_MS,
  canReadStockDiscrepancies,
  canRequestSnapshot,
  classifyTriggerOutcome,
  formatStaleAfter,
  hasSnapshot,
  isPendingOverdue,
  negativeCountLabel,
  newSnapshotRequestKey,
  noSnapshotReason,
  snapshotStatusLabel,
} from "@/stock-discrepancies/stockDiscrepancyLogic";
import { describe, expect, test } from "vitest";

/**
 * RT-178 pure presentation helpers: role gates mirror the API (AC6), unknown
 * counts for no-snapshot states (AC2), labels never say live/current (AC7), and
 * the refresh Idempotency-Key matches the contract pattern.
 */
describe("role gates (AC6)", () => {
  test("read: owner / tenant_admin / store_manager only", () => {
    expect(canReadStockDiscrepancies("owner")).toBe(true);
    expect(canReadStockDiscrepancies("tenant_admin")).toBe(true);
    expect(canReadStockDiscrepancies("store_manager")).toBe(true);
    for (const role of ["cashier", "auditor", "", null, undefined]) {
      expect(canReadStockDiscrepancies(role)).toBe(false);
    }
  });

  test("refresh: owner / tenant_admin only (store_manager hidden)", () => {
    expect(canRequestSnapshot("owner")).toBe(true);
    expect(canRequestSnapshot("tenant_admin")).toBe(true);
    expect(canRequestSnapshot("store_manager")).toBe(false);
    expect(canRequestSnapshot("cashier")).toBe(false);
    expect(canRequestSnapshot(null)).toBe(false);
  });
});

describe("snapshot presentation", () => {
  test("hasSnapshot only for fresh / stale", () => {
    expect(hasSnapshot("fresh")).toBe(true);
    expect(hasSnapshot("stale")).toBe(true);
    expect(hasSnapshot("no_snapshot")).toBe(false);
    expect(hasSnapshot("no_warehouse_mapping")).toBe(false);
  });

  test("AC2: count is Unknown (never 0) when no snapshot exists", () => {
    expect(negativeCountLabel("no_snapshot", 0)).toBe("Unknown");
    expect(negativeCountLabel("no_warehouse_mapping", 0)).toBe("Unknown");
    expect(negativeCountLabel("fresh", 0)).toBe("0");
    expect(negativeCountLabel("stale", 3)).toBe("3");
  });

  test("AC2/AC7: labels name 'No ERPNext snapshot' and never say live/current", () => {
    expect(snapshotStatusLabel("no_snapshot").label).toMatch(/no erpnext snapshot/i);
    expect(snapshotStatusLabel("no_warehouse_mapping").label).toMatch(/no erpnext snapshot/i);
    for (const s of ["fresh", "stale", "no_snapshot", "no_warehouse_mapping"] as const) {
      expect(snapshotStatusLabel(s).label).not.toMatch(/\blive\b|\bcurrent/i);
    }
  });

  test("noSnapshotReason distinguishes the two no-snapshot states", () => {
    expect(noSnapshotReason("no_warehouse_mapping")).toBe("No warehouse mapping");
    expect(noSnapshotReason("no_snapshot")).toBe("Not recorded yet");
  });

  test("formatStaleAfter renders hours / minutes / seconds", () => {
    expect(formatStaleAfter(86400)).toBe("24 hours");
    expect(formatStaleAfter(3600)).toBe("1 hour");
    expect(formatStaleAfter(900)).toBe("15 minutes");
    expect(formatStaleAfter(61)).toBe("61 seconds");
  });

  test("pending is overdue after three Connector ticks (15 min)", () => {
    const requestedAt = "2026-10-04T08:00:00.000Z";
    const t0 = Date.parse(requestedAt);
    const pending = { runId: "0190f000-0000-7000-8000-000000000001", requestedAt };
    expect(isPendingOverdue(null, t0)).toBe(false);
    expect(isPendingOverdue(pending, t0 + PENDING_OVERDUE_MS - 1)).toBe(false);
    expect(isPendingOverdue(pending, t0 + PENDING_OVERDUE_MS)).toBe(true);
  });
});

describe("refresh (triggerReconciliationRun)", () => {
  test("Idempotency-Key is 16–128 printable ASCII and unique per call", () => {
    const a = newSnapshotRequestKey();
    const b = newSnapshotRequestKey();
    expect(a).toMatch(/^[\x21-\x7E]{16,128}$/);
    expect(a).not.toBe(b);
  });

  test("outcome classification", () => {
    expect(classifyTriggerOutcome({ status: 201 })).toEqual({ kind: "requested" });
    expect(classifyTriggerOutcome({ status: 200 })).toEqual({ kind: "requested" });
    expect(
      classifyTriggerOutcome({ status: 404, error: { error: { request_id: "req-404" } } }),
    ).toEqual({ kind: "not-found", requestId: "req-404" });
    expect(classifyTriggerOutcome({ status: 409 })).toEqual({
      kind: "key-conflict",
      requestId: undefined,
    });
    expect(classifyTriggerOutcome({ status: 500 })).toEqual({
      kind: "error",
      requestId: undefined,
    });
  });
});
