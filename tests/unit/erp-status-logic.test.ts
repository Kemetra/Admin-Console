import {
  canReadErpStatus,
  domainKey,
  domainStatusView,
  flattenPages,
  isStoreFilter,
  joinConnections,
  livenessSignal,
  mismatchEntries,
  nextCursor,
  postingKindKey,
  reachabilityKey,
  runStatusView,
  runTriggerKey,
  signalView,
  sinceSeconds,
} from "@/erp-status/erpStatusLogic";
import { describe, expect, test } from "vitest";
import { healthView, instance } from "./erp-status-fixtures";

/**
 * RT-560 / spec 016 Phase A truth rules, as pure functions. Liveness comes from
 * C2 only: a missing C2 row, a failed C2 read or an unknown verdict is "no
 * signal", never healthy and never an error (A-1, A-2). Nothing collapses the
 * domains into one "ERP OK" bit (A-4).
 */
describe("role gate (A-6)", () => {
  test.each(["owner", "tenant_admin"])("%s may read", (role) => {
    expect(canReadErpStatus(role)).toBe(true);
  });
  test.each(["store_manager", "cashier", "auditor", "", null, undefined])(
    "%s may not read",
    (role) => {
      expect(canReadErpStatus(role)).toBe(false);
    },
  );
});

describe("store filter value", () => {
  test("all stores or a UUID is sent", () => {
    expect(isStoreFilter("")).toBe(true);
    expect(isStoreFilter("0190f000-0000-7000-8000-0000000000a1")).toBe(true);
  });
  test.each(["abc", "1", "0190f000-0000-7000-8000", "' or 1=1"])("%s is not sent", (value) => {
    expect(isStoreFilter(value)).toBe(false);
  });
});

describe("liveness → signal (A-1, A-2)", () => {
  test.each([
    ["healthy", "healthy"],
    ["stale", "stale"],
    ["never_seen", "no_signal"],
    ["disabled", "disabled"],
  ] as const)("%s renders as %s", (liveness, signal) => {
    expect(livenessSignal(healthView({ liveness }))).toBe(signal);
  });

  test("a missing C2 row is no signal", () => {
    expect(livenessSignal(undefined)).toBe("no_signal");
  });

  test("an unknown verdict is no signal, never healthy", () => {
    expect(livenessSignal(healthView({ liveness: "great" as never }))).toBe("no_signal");
  });

  test("each signal has its own label; no signal is a hollow neutral dot", () => {
    expect(signalView("healthy")).toEqual({
      labelKey: "erp.signal.healthy",
      tone: "success",
      hollow: false,
    });
    expect(signalView("stale")).toEqual({
      labelKey: "erp.signal.stale",
      tone: "warning",
      hollow: false,
    });
    expect(signalView("no_signal")).toEqual({
      labelKey: "erp.signal.noSignal",
      tone: "neutral",
      hollow: true,
    });
    expect(signalView("disabled")).toEqual({
      labelKey: "erp.signal.disabled",
      tone: "neutral",
      hollow: true,
    });
  });
});

describe("C1 ⋈ C2 join (§4.1)", () => {
  const a = instance({ id: "a", display_name: "Cairo ERP" });
  const b = instance({ id: "b", display_name: "Giza ERP" });

  test("rows are C1-driven and joined by registration id", () => {
    const rows = joinConnections([a, b], {
      items: [healthView({ connectorId: "b", liveness: "healthy" })],
    });
    expect(rows.map((r) => [r.instance.id, r.health?.liveness])).toEqual([
      ["a", undefined],
      ["b", "healthy"],
    ]);
    expect(rows.map((r) => r.signal)).toEqual(["no_signal", "healthy"]);
  });

  test("a C2 row with no C1 registration is dropped", () => {
    const rows = joinConnections([a], {
      items: [healthView({ connectorId: "ghost", liveness: "healthy" })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].signal).toBe("no_signal");
  });

  test("a failed C2 read leaves every instance at no signal", () => {
    const rows = joinConnections([a, b], undefined);
    expect(rows.map((r) => r.signal)).toEqual(["no_signal", "no_signal"]);
  });

  test("today's main (no heartbeat sender): every instance is no signal", () => {
    const rows = joinConnections([a, b], {
      items: [
        healthView({ connectorId: "a", liveness: "never_seen", lastSeenAt: null }),
        healthView({ connectorId: "b", liveness: "never_seen", lastSeenAt: null }),
      ],
    });
    expect(rows.every((r) => r.signal === "no_signal")).toBe(true);
  });

  test("C1 disabled_at does not override the C2 verdict", () => {
    const disabled = instance({ id: "a", disabled_at: "2026-10-01T00:00:00Z" });
    const [row] = joinConnections([disabled], undefined);
    expect(row.signal).toBe("no_signal");
  });
});

describe("self-reported reachability (A-3)", () => {
  test.each([
    [true, "erp.reported.reachable"],
    [false, "erp.reported.unreachable"],
    [null, "erp.reported.notReported"],
    [undefined, "erp.reported.notReported"],
  ])("%s → %s", (value, key) => {
    expect(reachabilityKey(value)).toBe(key);
  });
});

describe("since last seen", () => {
  test("rounds down to the largest whole unit", () => {
    expect(sinceSeconds(45)).toBe(45);
    expect(sinceSeconds(437)).toBe(420);
    expect(sinceSeconds(7299)).toBe(7200);
  });
  test("null stays null", () => {
    expect(sinceSeconds(null)).toBeNull();
    expect(sinceSeconds(undefined)).toBeNull();
  });
});

describe("sync-ops domains (A-4)", () => {
  test.each([
    ["posting", "erp.domain.posting"],
    ["reconciliation", "erp.domain.reconciliation"],
    ["connector_health", "erp.domain.connector_health"],
    ["product_master", "erp.domain.product_master"],
    ["something_new", "erp.domain.unknown"],
  ])("%s labels as %s", (domain, key) => {
    expect(domainKey(domain)).toBe(key);
  });

  test("ok, attention and not_available render separately, never as one bit", () => {
    expect(domainStatusView("ok")).toEqual({
      labelKey: "erp.domainStatus.ok",
      tone: "success",
      hollow: false,
    });
    expect(domainStatusView("attention")).toEqual({
      labelKey: "erp.domainStatus.attention",
      tone: "warning",
      hollow: false,
    });
    expect(domainStatusView("not_available")).toEqual({
      labelKey: "erp.domainStatus.notAvailable",
      tone: "neutral",
      hollow: true,
    });
  });

  test("an unknown status is unknown (danger), never ok", () => {
    expect(domainStatusView("weird")).toEqual({
      labelKey: "erp.domainStatus.unknown",
      tone: "danger",
      hollow: true,
    });
  });
});

describe("posting backlog (A-5)", () => {
  test.each([
    ["sale_post", "erp.backlog.kind.sale_post"],
    ["reversal", "erp.backlog.kind.reversal"],
    ["other", "erp.backlog.kind.unknown"],
  ])("%s → %s", (kind, key) => {
    expect(postingKindKey(kind)).toBe(key);
  });
});

describe("reconciliation runs", () => {
  test.each([
    ["on_demand", "erp.runs.trigger.on_demand"],
    ["scheduled", "erp.runs.trigger.scheduled"],
    ["later", "erp.runs.trigger.unknown"],
  ])("trigger %s → %s", (trigger, key) => {
    expect(runTriggerKey(trigger)).toBe(key);
  });

  test("status views", () => {
    expect(runStatusView("running").tone).toBe("info");
    expect(runStatusView("completed").tone).toBe("success");
    expect(runStatusView("failed").tone).toBe("danger");
    expect(runStatusView("odd")).toEqual({
      labelKey: "erp.runs.status.unknown",
      tone: "danger",
      hollow: true,
    });
  });

  test("mismatch counts are listed by class, as received", () => {
    expect(mismatchEntries({ qty_drift: 3, missing_bin: 1 })).toEqual([
      ["missing_bin", 1],
      ["qty_drift", 3],
    ]);
    expect(mismatchEntries(null)).toEqual([]);
    expect(mismatchEntries(undefined)).toEqual([]);
  });
});

describe("cursor paging", () => {
  test("a null cursor stops paging", () => {
    expect(nextCursor({ items: [], nextCursor: null })).toBeUndefined();
    expect(nextCursor({ items: [], nextCursor: "12" })).toBe("12");
  });
  test("pages flatten in order", () => {
    expect(
      flattenPages([
        { items: [1, 2], nextCursor: "x" },
        { items: [3], nextCursor: null },
      ]),
    ).toEqual([1, 2, 3]);
  });
});
