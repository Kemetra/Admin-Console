import { formatMoney, formatSignedMoney } from "@/i18n/format";
import { zonedDayStartIso } from "@/shift-closes/shiftCloseDates";
import {
  MIN_NONZERO_VARIANCE,
  PAGE_SIZE,
  buildListQuery,
  filtersFromSearch,
  filtersToSearch,
  validateFilters,
} from "@/shift-closes/shiftCloseFilters";
import {
  canReadShiftCloses,
  flattenShiftClosePages,
  isShiftId,
  nextShiftCloseCursor,
  varianceDirection,
} from "@/shift-closes/shiftCloseLogic";
import { describe, expect, test } from "vitest";

/**
 * RT-18 pure helpers. "Exception" is non-zero variance only: the floor is sent
 * to the server (never a client-side row filter), variance is signed
 * (counted minus expected), and a date filter carries an explicit zone.
 */

describe("currency-aware money (RT-18)", () => {
  test("formatMoney defaults to EGP and takes a currency code", () => {
    expect(formatMoney("1250")).toBe("1,250.00 EGP");
    expect(formatMoney("1250", "USD")).toBe("1,250.00 USD");
  });

  test("signed money: explicit plus for overage, minus for shortage, bare zero", () => {
    expect(formatSignedMoney("12.5", "EGP")).toBe("+12.50 EGP");
    expect(formatSignedMoney("-12.5000", "EGP")).toBe("-12.50 EGP");
    expect(formatSignedMoney("0.0000", "EGP")).toBe("0.00 EGP");
    expect(formatSignedMoney("-0.0000", "EGP")).toBe("0.00 EGP");
    expect(formatSignedMoney("+3", "SAR")).toBe("+3.00 SAR");
  });

  test("signed money keeps every digit of a large exact decimal", () => {
    expect(formatSignedMoney("-12345678901234.5678", "EGP")).toBe("-12,345,678,901,234.5678 EGP");
  });

  test("a value that is not a plain decimal is returned unchanged", () => {
    expect(formatSignedMoney("n/a", "EGP")).toBe("n/a");
  });
});

describe("varianceDirection", () => {
  test.each([
    ["25.0000", "over"],
    ["+0.0001", "over"],
    ["-25.0000", "short"],
    ["-0.0001", "short"],
    ["0", "none"],
    ["0.0000", "none"],
    ["-0.0000", "none"],
  ])("%s → %s", (variance, expected) => {
    expect(varianceDirection({ variance })).toBe(expected);
  });
});

describe("role gate and ids", () => {
  test("only owner, tenant_admin and store_manager may read", () => {
    expect(canReadShiftCloses("owner")).toBe(true);
    expect(canReadShiftCloses("tenant_admin")).toBe(true);
    expect(canReadShiftCloses("store_manager")).toBe(true);
    expect(canReadShiftCloses("cashier")).toBe(false);
    expect(canReadShiftCloses("manager")).toBe(false);
    expect(canReadShiftCloses(null)).toBe(false);
    expect(canReadShiftCloses(undefined)).toBe(false);
  });

  test("isShiftId accepts a UUID of any case and nothing else", () => {
    expect(isShiftId("0190F000-0000-7000-8000-0000000000A1")).toBe(true);
    expect(isShiftId("not-a-uuid")).toBe(false);
    expect(isShiftId(undefined)).toBe(false);
  });
});

describe("keyset paging", () => {
  test("the next cursor is the server's, and null stops paging", () => {
    expect(nextShiftCloseCursor({ items: [], nextCursor: "c2" })).toBe("c2");
    expect(nextShiftCloseCursor({ items: [], nextCursor: null })).toBeUndefined();
  });

  test("pages flatten in order", () => {
    const a = { shiftId: "a" };
    const b = { shiftId: "b" };
    expect(
      flattenShiftClosePages([
        { items: [a], nextCursor: "x" },
        { items: [b], nextCursor: null },
      ]),
    ).toEqual([a, b]);
  });
});

describe("zonedDayStartIso", () => {
  test("UTC start of day", () => {
    expect(zonedDayStartIso({ date: "2026-10-07", timeZone: "UTC" })).toBe(
      "2026-10-07T00:00:00.000Z",
    );
  });

  test("a zone ahead of UTC starts the day the evening before (UTC)", () => {
    expect(zonedDayStartIso({ date: "2026-10-07", timeZone: "Asia/Dubai" })).toBe(
      "2026-10-06T20:00:00.000Z",
    );
  });

  test("a zone behind UTC, with its daylight offset on that date", () => {
    expect(zonedDayStartIso({ date: "2026-10-07", timeZone: "America/New_York" })).toBe(
      "2026-10-07T04:00:00.000Z",
    );
    expect(zonedDayStartIso({ date: "2026-11-02", timeZone: "America/New_York" })).toBe(
      "2026-11-02T05:00:00.000Z",
    );
  });

  test("the day a zone's clocks change still starts at local midnight", () => {
    expect(zonedDayStartIso({ date: "2026-11-01", timeZone: "America/New_York" })).toBe(
      "2026-11-01T04:00:00.000Z",
    );
  });

  test("an unknown zone falls back to UTC rather than the browser's zone", () => {
    expect(zonedDayStartIso({ date: "2026-10-07", timeZone: "Not/AZone" })).toBe(
      "2026-10-07T00:00:00.000Z",
    );
  });
});

describe("filters ⇄ URL", () => {
  test("empty search is the default filter set", () => {
    expect(filtersFromSearch(new URLSearchParams(""))).toEqual({
      storeId: "",
      fromDate: "",
      toDate: "",
      closeKind: "",
      minVariance: "",
      currency: "",
      approval: "",
    });
  });

  test("round-trips, omitting blanks", () => {
    const filters = {
      storeId: "0190f000-0000-7000-8000-0000000000a1",
      fromDate: "2026-10-01",
      toDate: "2026-10-07",
      closeKind: "forced",
      minVariance: "5",
      currency: "EGP",
      approval: "not_approved",
    } as const;
    const search = filtersToSearch(filters);
    expect(Object.fromEntries(search)).toEqual({
      store: filters.storeId,
      from: "2026-10-01",
      to: "2026-10-07",
      kind: "forced",
      min: "5",
      currency: "EGP",
      approval: "not_approved",
    });
    expect(filtersFromSearch(search)).toEqual(filters);
    expect(filtersToSearch(filtersFromSearch(new URLSearchParams(""))).toString()).toBe("");
  });

  test("a date that is not a real calendar day in a sane year is dropped from the URL", () => {
    for (const bad of ["9999-12-31", "0050-01-01", "2026-02-31", "2026-13-01", "10000-01-01"]) {
      expect(filtersFromSearch(new URLSearchParams({ from: bad, to: bad }))).toMatchObject({
        fromDate: "",
        toDate: "",
      });
    }
    expect(filtersFromSearch(new URLSearchParams({ from: "2026-02-28" })).fromDate).toBe(
      "2026-02-28",
    );
  });

  test("an unknown close kind or approval in the URL is dropped, never sent", () => {
    const f = filtersFromSearch(new URLSearchParams("kind=bogus&approval=maybe"));
    expect(f.closeKind).toBe("");
    expect(f.approval).toBe("");
  });
});

const NONE = filtersFromSearch(new URLSearchParams(""));

describe("validateFilters", () => {
  test("defaults are valid", () => {
    expect(validateFilters(NONE)).toEqual({});
  });

  test("a minimum variance must be a plain non-negative decimal of at most 4 places", () => {
    expect(validateFilters({ ...NONE, minVariance: "12.5" })).toEqual({});
    expect(validateFilters({ ...NONE, minVariance: "abc" }).minVariance).toBe(
      "shift.filter.minVarianceInvalid",
    );
    expect(validateFilters({ ...NONE, minVariance: "-1" }).minVariance).toBe(
      "shift.filter.minVarianceInvalid",
    );
    expect(validateFilters({ ...NONE, minVariance: "1.23456" }).minVariance).toBe(
      "shift.filter.minVarianceInvalid",
    );
  });

  test("a currency is a three-letter code", () => {
    expect(validateFilters({ ...NONE, currency: "egp" })).toEqual({});
    expect(validateFilters({ ...NONE, currency: "EG" }).currency).toBe(
      "shift.filter.currencyInvalid",
    );
  });

  test("a typed date outside real calendar days is flagged, never sent", () => {
    for (const bad of ["9999-12-31", "2026-02-31", "10000-01-01"]) {
      expect(validateFilters({ ...NONE, toDate: bad }).date).toBe("shift.filter.dateInvalid");
      expect(validateFilters({ ...NONE, fromDate: bad }).date).toBe("shift.filter.dateInvalid");
    }
  });

  test("the end date may not be before the start date", () => {
    expect(validateFilters({ ...NONE, fromDate: "2026-10-07", toDate: "2026-10-07" })).toEqual({});
    expect(validateFilters({ ...NONE, fromDate: "2026-10-07", toDate: "2026-10-06" }).range).toBe(
      "shift.filter.rangeInvalid",
    );
  });
});

describe("buildListQuery", () => {
  test("with no filters it still asks the server for non-zero variance only", () => {
    expect(buildListQuery({ filters: NONE, timeZone: "UTC" })).toEqual({
      min_abs_variance: MIN_NONZERO_VARIANCE,
      page_size: PAGE_SIZE,
    });
    expect(MIN_NONZERO_VARIANCE).toBe("0.0001");
  });

  test("a zero or blank minimum is raised to the floor; a larger one is kept", () => {
    expect(
      buildListQuery({ filters: { ...NONE, minVariance: "0" }, timeZone: "UTC" }).min_abs_variance,
    ).toBe("0.0001");
    expect(
      buildListQuery({ filters: { ...NONE, minVariance: "0.0000" }, timeZone: "UTC" })
        .min_abs_variance,
    ).toBe("0.0001");
    expect(
      buildListQuery({ filters: { ...NONE, minVariance: "25.50" }, timeZone: "UTC" })
        .min_abs_variance,
    ).toBe("25.50");
  });

  test("maps every filter to the generated client's query keys", () => {
    const q = buildListQuery({
      filters: {
        storeId: "0190f000-0000-7000-8000-0000000000a1",
        fromDate: "2026-10-01",
        toDate: "2026-10-07",
        closeKind: "forced",
        minVariance: "5",
        currency: "egp",
        approval: "approved",
      },
      timeZone: "Asia/Dubai",
    });
    expect(q).toEqual({
      store_id: "0190f000-0000-7000-8000-0000000000a1",
      closed_from: "2026-09-30T20:00:00.000Z",
      // exclusive upper bound: the start of the day AFTER the end date
      closed_to: "2026-10-07T20:00:00.000Z",
      close_kind: "forced",
      min_abs_variance: "5",
      currency_code: "EGP",
      approval: "approved",
      page_size: PAGE_SIZE,
    });
  });
});
