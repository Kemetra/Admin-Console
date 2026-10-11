import { translate } from "@/i18n";
import { setLocale } from "@/i18n/locale";
import {
  PENDING_OVERDUE_MS,
  canReadStockDiscrepancies,
  canRequestSnapshot,
  classifyTriggerOutcome,
  formatStaleAfter,
  hasSnapshot,
  isPendingOverdue,
  isStoreId,
  negativeCountLabel,
  newSnapshotRequestKey,
  noSnapshotReason,
  outcomeBannerView,
  pagesShareSnapshot,
  refreshBlockReason,
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
    const label = (s: Parameters<typeof negativeCountLabel>[0], n: number, l: "en" | "ar") => {
      const { key, params } = negativeCountLabel(s, n);
      return translate(l, key, params);
    };
    expect(negativeCountLabel("no_snapshot", 0)).toEqual({ key: "stock.stores.countUnknown" });
    expect(negativeCountLabel("no_warehouse_mapping", 0)).toEqual({
      key: "stock.stores.countUnknown",
    });
    expect(label("no_snapshot", 0, "en")).toBe("Unknown");
    expect(label("no_warehouse_mapping", 0, "ar")).toBe("غير معروف");
    expect(label("fresh", 0, "en")).toBe("0");
    expect(label("stale", 3, "en")).toBe("3");
    // Counts render with Western digits and grouping in both locales.
    expect(label("fresh", 1284, "ar")).toBe("1,284");
  });

  test("AC2/AC7: labels name 'No ERPNext snapshot' and never say live/current", () => {
    const en = (s: Parameters<typeof snapshotStatusLabel>[0]) =>
      translate("en", snapshotStatusLabel(s).labelKey);
    expect(en("no_snapshot")).toMatch(/no erpnext snapshot/i);
    expect(en("no_warehouse_mapping")).toMatch(/no erpnext snapshot/i);
    for (const s of ["fresh", "stale", "no_snapshot", "no_warehouse_mapping"] as const) {
      expect(en(s)).not.toMatch(/\blive\b|\bcurrent/i);
      // Arabic: no «مباشر» (live) / «الحالي» (current) either.
      expect(translate("ar", snapshotStatusLabel(s).labelKey)).not.toMatch(/مباشر|حالي/);
    }
  });

  test("noSnapshotReason distinguishes the two no-snapshot states", () => {
    expect(noSnapshotReason("no_warehouse_mapping")).toBe("stock.noSnapshotReason.noMapping");
    expect(noSnapshotReason("no_snapshot")).toBe("stock.noSnapshotReason.notRecorded");
    expect(noSnapshotReason("fresh")).toBeNull();
    expect(translate("en", "stock.noSnapshotReason.noMapping")).toBe("No warehouse mapping");
    expect(translate("en", "stock.noSnapshotReason.notRecorded")).toBe("Not recorded yet");
  });

  test("formatStaleAfter renders hours / minutes / seconds", () => {
    expect(formatStaleAfter(86400)).toBe("24 hours");
    expect(formatStaleAfter(3600)).toBe("1 hour");
    expect(formatStaleAfter(900)).toBe("15 minutes");
    expect(formatStaleAfter(61)).toBe("61 seconds");
  });

  test("formatStaleAfter follows the locale (Arabic plural phrases, Western digits)", () => {
    expect(formatStaleAfter(86400, "ar")).toBe("24 ساعة");
    expect(formatStaleAfter(3600, "ar")).toBe("ساعة واحدة");
    setLocale("ar");
    expect(formatStaleAfter(900)).toBe("15 دقيقة");
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

describe("paging consistency, store id, refresh block (P3 fixes)", () => {
  const base = {
    status: "fresh" as const,
    erpnextWarehouseRef: "Stores - NSR",
    runId: "0190f000-0000-7000-8000-0000000000b1",
    readAt: "2026-10-04T07:58:12.000Z",
    recordedAt: "2026-10-04T08:00:03.000Z",
    staleAfterSeconds: 86400,
    reportedEntryCount: 42,
    pendingRequest: null,
  };

  test("pagesShareSnapshot: same run + recordedAt is one snapshot, status ignored", () => {
    expect(pagesShareSnapshot([])).toBe(true);
    expect(pagesShareSnapshot([{ snapshot: base }])).toBe(true);
    expect(
      pagesShareSnapshot([{ snapshot: base }, { snapshot: { ...base, status: "stale" } }]),
    ).toBe(true);
    expect(
      pagesShareSnapshot([
        { snapshot: base },
        { snapshot: { ...base, runId: "0190f000-0000-7000-8000-0000000000b2" } },
      ]),
    ).toBe(false);
    expect(
      pagesShareSnapshot([
        { snapshot: base },
        { snapshot: { ...base, recordedAt: "2026-10-04T09:00:00.000Z" } },
      ]),
    ).toBe(false);
  });

  test("isStoreId accepts UUIDs only", () => {
    expect(isStoreId("0190f000-0000-7000-8000-0000000000a1")).toBe(true);
    expect(isStoreId("0190F000-0000-7000-8000-0000000000A1")).toBe(true);
    expect(isStoreId("not-a-uuid")).toBe(false);
    expect(isStoreId("")).toBe(false);
    expect(isStoreId(undefined)).toBe(false);
  });

  test("refreshBlockReason: no mapping, pending request, or enabled", () => {
    expect(refreshBlockReason(base)).toBeNull();
    expect(
      refreshBlockReason({
        ...base,
        pendingRequest: {
          runId: "0190f000-0000-7000-8000-0000000000b9",
          requestedAt: "2026-10-04T08:05:00.000Z",
        },
      }),
    ).toBe("stock.refresh.blocked.pending");
    expect(refreshBlockReason({ ...base, status: "no_warehouse_mapping" })).toBe(
      "stock.refresh.blocked.noMapping",
    );
    expect(translate("en", "stock.refresh.blocked.noMapping")).toMatch(
      /map an erpnext stock warehouse/i,
    );
  });

  test("outcomeBannerView returns message keys (no copy in the view model)", () => {
    expect(outcomeBannerView({ kind: "requested" })).toBeNull();
    expect(outcomeBannerView({ kind: "not-found" })).toEqual({
      variant: "danger",
      messageKey: "stock.refresh.outcome.notFound",
    });
    expect(outcomeBannerView({ kind: "key-conflict" })).toEqual({
      variant: "warning",
      messageKey: "stock.refresh.outcome.keyConflict",
    });
    expect(outcomeBannerView({ kind: "error" })).toEqual({
      variant: "danger",
      messageKey: "stock.refresh.outcome.error",
    });
  });
});
