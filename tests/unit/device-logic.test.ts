import { tabForKey, tabFromSearch } from "@/devices/DeviceTabs";
import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  buildListQuery,
  filtersFromSearch,
  filtersToSearch,
  isFiltered,
} from "@/devices/deviceFilters";
import {
  canReadDevices,
  flattenDevicePages,
  isPastExpiry,
  isUuid,
  lastSeenView,
  listSearchFrom,
  nextDeviceCursor,
  revokeReasonKey,
  trustStateView,
} from "@/devices/deviceLogic";
import { describe, expect, test } from "vitest";
import {
  DEVICE_1,
  DEVICE_2,
  DEVICE_3,
  DUBAI_STORE,
  EXPIRES_FUTURE,
  EXPIRES_PAST,
  summary,
} from "./device-fixtures";

/**
 * RT-371 pure helpers. The truth rules (RT-287 D-Q6): no helper output names a
 * healthy / OK state, unknown stays unknown, and active is not the success tone.
 */
describe("device logic (RT-371)", () => {
  test.each(["owner", "tenant_admin", "store_manager"])("%s can read devices", (role) => {
    expect(canReadDevices(role)).toBe(true);
  });

  test.each(["store_staff", "cashier", "auditor", "", null, undefined])(
    "%s cannot read devices",
    (role) => {
      expect(canReadDevices(role)).toBe(false);
    },
  );

  test("isUuid accepts a UUID in any case and rejects anything else", () => {
    expect(isUuid(DEVICE_1)).toBe(true);
    expect(isUuid(DEVICE_1.toUpperCase())).toBe(true);
    expect(isUuid("till-1")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });

  test("trust state: active is neutral (never the success tone), revoked danger, retired muted", () => {
    expect(trustStateView({ trustState: "active" })).toEqual({
      key: "devices.trust.active",
      tone: "neutral",
    });
    expect(trustStateView({ trustState: "revoked" }).tone).toBe("danger");
    expect(trustStateView({ trustState: "retired" }).tone).toBe("muted");
  });

  test("an unknown trust state is shown as unknown, in the danger tone", () => {
    expect(trustStateView({ trustState: "expired" })).toEqual({
      key: "devices.trust.unknown",
      tone: "danger",
    });
  });

  test("revoke reason: null is 'not recorded' (pre-RT-365), an unknown code is 'unknown'", () => {
    expect(revokeReasonKey({ revokeReason: "stolen" })).toBe("devices.reason.stolen");
    expect(revokeReasonKey({ revokeReason: null })).toBe("devices.reason.notRecorded");
    expect(revokeReasonKey({ revokeReason: "bored" })).toBe("devices.reason.unknown");
  });

  test("last seen: no value is Unknown", () => {
    expect(lastSeenView({ lastSeenAt: null, lastSeenSource: null })).toEqual({
      kind: "unknown",
      key: "devices.lastSeen.unknown",
    });
  });

  test("last seen: activity is labelled as activity", () => {
    expect(
      lastSeenView({ lastSeenAt: "2026-10-15T18:45:00Z", lastSeenSource: "activity" }),
    ).toEqual({
      kind: "seen",
      at: "2026-10-15T18:45:00Z",
      sourceKey: "devices.lastSeen.source.activity",
      sourceKnown: true,
    });
  });

  test.each([["heartbeat"], [null]])(
    "last seen: a source the console does not know (%s) keeps the time, source unknown",
    (source) => {
      const view = lastSeenView({ lastSeenAt: "2026-10-15T18:45:00Z", lastSeenSource: source });
      expect(view).toMatchObject({
        kind: "seen",
        sourceKey: "devices.lastSeen.source.unknown",
        sourceKnown: false,
      });
    },
  );

  test("D-Q6: no trust or last-seen output maps to a healthy / OK label", () => {
    const keys = [
      ...["active", "revoked", "retired", "x"].map((s) => trustStateView({ trustState: s }).key),
      ...[null, "2026-10-15T18:45:00Z"].flatMap((at) =>
        ["activity", "heartbeat", null].map((source) => {
          const view = lastSeenView({ lastSeenAt: at, lastSeenSource: source });
          return view.kind === "seen" ? view.sourceKey : view.key;
        }),
      ),
    ];
    for (const key of keys) expect(key).not.toMatch(/health|ok\b|online|good/i);
  });

  test("isPastExpiry compares against the given clock only", () => {
    const now = Date.parse("2026-10-16T00:00:00Z");
    expect(isPastExpiry(EXPIRES_PAST, now)).toBe(true);
    expect(isPastExpiry(EXPIRES_FUTURE, now)).toBe(false);
    expect(isPastExpiry("not a date", now)).toBe(false);
  });

  test("paging keeps the server's order across pages and stops on a null cursor", () => {
    const first = { items: [summary({ deviceId: DEVICE_2 })], nextCursor: "c2" };
    const second = { items: [summary({ deviceId: DEVICE_1 })], nextCursor: null };
    expect(nextDeviceCursor(first as never)).toBe("c2");
    expect(nextDeviceCursor(second as never)).toBeUndefined();
    expect(flattenDevicePages([first, second] as never).map((d) => d.deviceId)).toEqual([
      DEVICE_2,
      DEVICE_1,
    ]);
  });

  test("a device repeated on a later page (its rank changed mid-walk) is shown once, where it first appeared", () => {
    const first = {
      items: [summary({ deviceId: DEVICE_2 }), summary({ deviceId: DEVICE_1 })],
      nextCursor: "c2",
    };
    const second = {
      items: [
        summary({ deviceId: DEVICE_2, trustState: "revoked" }),
        summary({ deviceId: DEVICE_3 }),
      ],
      nextCursor: null,
    };
    const rows = flattenDevicePages([first, second] as never);
    expect(rows.map((d) => d.deviceId)).toEqual([DEVICE_2, DEVICE_1, DEVICE_3]);
    expect(rows[0].trustState).toBe("active");
  });
});

describe("device detail navigation (RT-371)", () => {
  test("listSearchFrom keeps only the list's search string", () => {
    expect(listSearchFrom({ list: "?state=active" })).toBe("?state=active");
    expect(listSearchFrom({ list: "state=active" })).toBe("");
    expect(listSearchFrom({ list: 3 })).toBe("");
    expect(listSearchFrom(null)).toBe("");
    expect(listSearchFrom(undefined)).toBe("");
  });

  test("tabFromSearch: only `history` selects History", () => {
    expect(tabFromSearch(new URLSearchParams("tab=history"))).toBe("history");
    expect(tabFromSearch(new URLSearchParams("tab=health"))).toBe("overview");
    expect(tabFromSearch(new URLSearchParams())).toBe("overview");
  });

  test("tabForKey: either arrow moves to the other tab (RTL-safe), Home / End, else nothing", () => {
    expect(tabForKey("ArrowLeft", "overview")).toBe("history");
    expect(tabForKey("ArrowRight", "overview")).toBe("history");
    expect(tabForKey("ArrowLeft", "history")).toBe("overview");
    expect(tabForKey("Home", "history")).toBe("overview");
    expect(tabForKey("End", "overview")).toBe("history");
    expect(tabForKey("Enter", "overview")).toBeUndefined();
  });
});

describe("device filters (RT-371)", () => {
  test("parse the URL: store as given, trust state only from the closed set", () => {
    expect(filtersFromSearch(new URLSearchParams(`store=${DUBAI_STORE}&state=revoked`))).toEqual({
      storeId: DUBAI_STORE,
      trustState: "revoked",
    });
    expect(filtersFromSearch(new URLSearchParams("state=expired"))).toEqual(EMPTY_FILTERS);
  });

  test("write the URL without empty values", () => {
    expect(filtersToSearch({ storeId: DUBAI_STORE, trustState: "" }).toString()).toBe(
      `store=${DUBAI_STORE}`,
    );
    expect(filtersToSearch(EMPTY_FILTERS).toString()).toBe("");
  });

  test("build the list query: the server applies store and trust state", () => {
    expect(buildListQuery(EMPTY_FILTERS)).toEqual({ page_size: PAGE_SIZE });
    expect(buildListQuery({ storeId: DUBAI_STORE, trustState: "active" })).toEqual({
      page_size: PAGE_SIZE,
      store_id: DUBAI_STORE,
      trust_state: "active",
    });
  });

  test("isFiltered", () => {
    expect(isFiltered(EMPTY_FILTERS)).toBe(false);
    expect(isFiltered({ storeId: "", trustState: "retired" })).toBe(true);
  });
});
