import { type MessageKey, translate } from "@/i18n";
import { LOCALES } from "@/i18n/locale";
import { ar } from "@/i18n/messages/ar";
import {
  ATTENTION_DAYS,
  canOpenAudit,
  isRefusal,
  pageCount,
  shiftAttention,
  todayInZone,
} from "@/overview/overviewLogic";
import { filtersFromSearch } from "@/shift-closes/shiftCloseFilters";
import { describe, expect, test } from "vitest";

const STORE = "0190f000-0000-7000-8000-0000000000a1";

describe("pageCount (spec 009 §6.3)", () => {
  test("a last page is an exact count", () => {
    expect(pageCount(3, null)).toEqual({ kind: "exact", count: 3 });
    expect(pageCount(3, undefined)).toEqual({ kind: "exact", count: 3 });
  });

  test("a page with a further cursor is 'at least' the rows actually returned", () => {
    expect(pageCount(50, "c2")).toEqual({ kind: "atLeast", count: 50 });
    expect(pageCount(12, "c2")).toEqual({ kind: "atLeast", count: 12 });
  });

  test("'none' only for an empty page with no cursor", () => {
    expect(pageCount(0, null)).toEqual({ kind: "none" });
  });

  test("an empty page with a cursor is not proven empty", () => {
    expect(pageCount(0, "c2")).toEqual({ kind: "unproven" });
  });
});

describe("isRefusal (spec 009 §6.2)", () => {
  test("403 and 404 omit the panel; anything else does not", () => {
    expect(isRefusal(403)).toBe(true);
    expect(isRefusal(404)).toBe(true);
    for (const status of [400, 401, 409, 500, 503]) expect(isRefusal(status)).toBe(false);
  });
});

describe("todayInZone", () => {
  // 2026-10-15T22:30Z is already Oct 16 in Cairo (UTC+3 in October) but Oct 15 in UTC.
  const NOW = Date.parse("2026-10-15T22:30:00Z");

  test("reads the calendar day in the given zone, not the browser's", () => {
    expect(todayInZone("Africa/Cairo", NOW)).toBe("2026-10-16");
    expect(todayInZone("UTC", NOW)).toBe("2026-10-15");
    expect(todayInZone("America/New_York", NOW)).toBe("2026-10-15");
  });

  test("an unknown zone reads as UTC", () => {
    expect(todayInZone("Not/AZone", NOW)).toBe("2026-10-15");
  });
});

describe("shiftAttention (OD-009-2)", () => {
  const NOW = Date.parse("2026-10-15T22:30:00Z");

  test("the window is today plus the six days before it, in the store's zone", () => {
    expect(ATTENTION_DAYS).toBe(7);
    const view = shiftAttention({ storeId: STORE, timeZone: "Africa/Cairo", nowMs: NOW });
    expect(view.filters.fromDate).toBe("2026-10-10");
    // Oct 10 00:00 in Cairo (UTC+3) is Oct 9 21:00Z.
    expect(view.query.closed_from).toBe("2026-10-09T21:00:00.000Z");
  });

  test("asks the server for unapproved closes with any non-zero variance, in the active store", () => {
    const { query } = shiftAttention({ storeId: STORE, timeZone: "Africa/Cairo", nowMs: NOW });
    expect(query).toEqual({
      approval: "not_approved",
      min_abs_variance: "0.0001",
      store_id: STORE,
      closed_from: "2026-10-09T21:00:00.000Z",
    });
  });

  test("reads one page at the contract default: no page_size, no closed_to", () => {
    const { query } = shiftAttention({ storeId: STORE, timeZone: "UTC", nowMs: NOW });
    expect(query).not.toHaveProperty("page_size");
    expect(query).not.toHaveProperty("closed_to");
  });

  test("tenant-wide: UTC dates and no store_id", () => {
    const view = shiftAttention({ storeId: null, timeZone: "UTC", nowMs: NOW });
    expect(view.filters.fromDate).toBe("2026-10-09");
    expect(view.query.closed_from).toBe("2026-10-09T00:00:00.000Z");
    expect(view.query).not.toHaveProperty("store_id");
  });

  test("the link opens the same subset: the destination parses back the same filters", () => {
    const view = shiftAttention({ storeId: STORE, timeZone: "Africa/Cairo", nowMs: NOW });
    const [path, search] = view.href.split("?");
    expect(path).toBe("/shift-closes");
    expect(filtersFromSearch(new URLSearchParams(search))).toEqual(view.filters);
    expect(view.filters).toMatchObject({
      storeId: STORE,
      approval: "not_approved",
      minVariance: "0.0001",
      toDate: "",
    });
  });
});

describe("canOpenAudit (P-5 deferred, OD-009-3)", () => {
  test("only the roles listAuditEvents serves get the /audit link", () => {
    expect(canOpenAudit("owner")).toBe(true);
    expect(canOpenAudit("tenant_admin")).toBe(true);
    for (const role of ["store_manager", "store_staff", "platform_admin", "", null, undefined]) {
      expect(canOpenAudit(role)).toBe(false);
    }
  });
});

describe("link names (the Overview sits beside the nav)", () => {
  const keys = Object.keys(ar) as MessageKey[];
  const navLabels = keys.filter(
    (k) =>
      k.startsWith("shell.nav.") && k !== "shell.nav.label" && !k.startsWith("shell.nav.section."),
  );
  const links = keys.filter((k) => /^overview\.[a-z]+\.(open|openAll)$/.test(k));

  test("no Overview link name contains a nav label, so a nav link stays unambiguous", () => {
    expect(links.length).toBeGreaterThan(0);
    for (const locale of LOCALES) {
      for (const link of links) {
        const name = translate(locale, link, { state: "" }).toLowerCase();
        for (const nav of navLabels) {
          expect(
            name.includes(translate(locale, nav).toLowerCase()),
            `${locale} ${link} ~ ${nav}`,
          ).toBe(false);
        }
      }
    }
  });
});
