import {
  formatDateTime,
  formatDuration,
  formatEvidenceTime,
  formatMoney,
  formatNumber,
} from "@/i18n/format";
import { translate } from "@/i18n/translate";
import { describe, expect, test } from "vitest";

/** RT-399 formatters (RT-266 plan §3.4, UX-12). */

const ARABIC_INDIC_DIGIT = /[٠-٩۰-۹]/;

describe("money: 1,250.00 EGP from the exact decimal string", () => {
  test.each([
    ["1250", "1,250.00 EGP"],
    ["1250.5", "1,250.50 EGP"],
    ["1250.5000", "1,250.50 EGP"],
    ["0", "0.00 EGP"],
    ["0.0000", "0.00 EGP"],
    ["999", "999.00 EGP"],
    ["1000", "1,000.00 EGP"],
    ["1234567.89", "1,234,567.89 EGP"],
    ["007.10", "7.10 EGP"],
  ])("%s → %s", (input, expected) => {
    expect(formatMoney(input)).toBe(expected);
  });

  test("a negative value (variance) keeps its sign", () => {
    expect(formatMoney("-1250.5")).toBe("-1,250.50 EGP");
    expect(formatMoney("-0.0000")).toBe("0.00 EGP");
  });

  test("beyond float precision, every digit survives (no parseFloat)", () => {
    expect(formatMoney("12345678901234567.8900")).toBe("12,345,678,901,234,567.89 EGP");
  });

  test("a non-zero third or fourth decimal is kept, never rounded away", () => {
    expect(formatMoney("10.1250")).toBe("10.125 EGP");
    expect(formatMoney("10.0001")).toBe("10.0001 EGP");
  });

  // RT-510 (Sonar S8786): grouping and zero-trimming stay linear on long input
  // (the old regexes took several seconds here; the budget leaves CI headroom).
  test("a very long amount is formatted in linear time", () => {
    const zeros = "0".repeat(100_000);
    const start = performance.now();
    expect(formatMoney("1".repeat(100_001))).toBe(`11${",111".repeat(33_333)}.00 EGP`);
    expect(formatMoney(`1.${zeros}1`)).toBe(`1.${zeros}1 EGP`);
    expect(formatMoney(`1.1${zeros}`)).toBe("1.10 EGP");
    expect(performance.now() - start).toBeLessThan(1000);
  });

  test("anything that is not a plain decimal is shown as given, not guessed at", () => {
    expect(formatMoney("1e3")).toBe("1e3");
    expect(formatMoney("")).toBe("");
    expect(formatMoney("12,50")).toBe("12,50");
  });
});

describe("numbers: Western digits in both locales", () => {
  test("grouped, Latin digits", () => {
    expect(formatNumber(1284, "ar")).toBe("1,284");
    expect(formatNumber(1284, "en")).toBe("1,284");
    expect(ARABIC_INDIC_DIGIT.test(formatNumber(1234567890, "ar"))).toBe(false);
  });

  test("numeric params in messages render the same way", () => {
    expect(translate("ar", "format.duration.hours", { count: 1200 })).toBe("1,200 ساعة");
  });
});

describe("operational date/time", () => {
  const iso = "2026-10-07T13:42:05Z";

  test("Arabic in the Store's zone: «7 أكتوبر 2026، 13:42»", () => {
    expect(formatDateTime(iso, { locale: "ar", timeZone: "UTC" })).toBe("7 أكتوبر 2026، 13:42");
  });

  test("English in the Store's zone: Oct 7, 2026, 13:42", () => {
    expect(formatDateTime(iso, { locale: "en", timeZone: "UTC" })).toBe("Oct 7, 2026, 13:42");
  });

  test("the Store's zone moves the wall clock (Africa/Cairo is UTC+3 in October 2026)", () => {
    expect(formatDateTime(iso, { locale: "ar", timeZone: "Africa/Cairo" })).toBe(
      "7 أكتوبر 2026، 16:42",
    );
  });

  test("24-hour, zero-padded hours", () => {
    expect(formatDateTime("2026-10-06T09:05:00Z", { locale: "en", timeZone: "UTC" })).toBe(
      "Oct 6, 2026, 09:05",
    );
  });

  test("with no Store zone (RT-401 pending) the time is UTC and says so", () => {
    expect(formatDateTime(iso, { locale: "ar" })).toBe("7 أكتوبر 2026، 13:42 UTC");
    expect(formatDateTime(iso, { locale: "en" })).toBe("Oct 7, 2026, 13:42 UTC");
  });

  test("an invalid zone falls back to labelled UTC instead of throwing", () => {
    expect(formatDateTime(iso, { locale: "en", timeZone: "Mars/Olympus" })).toBe(
      "Oct 7, 2026, 13:42 UTC",
    );
  });

  test("an unparseable value is shown as given", () => {
    expect(formatDateTime("not-a-date", { locale: "ar" })).toBe("not-a-date");
  });

  test("Western digits only", () => {
    expect(ARABIC_INDIC_DIGIT.test(formatDateTime(iso, { locale: "ar" }))).toBe(false);
  });
});

describe("evidence timestamps", () => {
  test("exact UTC, locale-independent, nothing dropped", () => {
    expect(formatEvidenceTime("2026-10-07T13:42:05.123Z")).toBe("2026-10-07 13:42:05.123 UTC");
  });
});

describe("durations: whole phrases with Arabic plural categories", () => {
  test.each([
    [0, "0 ساعة"],
    [3600, "ساعة واحدة"],
    [7200, "ساعتان"],
    [3 * 3600, "3 ساعات"],
    [11 * 3600, "11 ساعة"],
    [24 * 3600, "24 ساعة"],
    [100 * 3600, "100 ساعة"],
  ])("Arabic hours: %ss → %s", (seconds, expected) => {
    expect(formatDuration(seconds, "ar")).toBe(expected);
  });

  test("minutes and seconds", () => {
    expect(formatDuration(120, "ar")).toBe("دقيقتان");
    expect(formatDuration(5 * 60, "ar")).toBe("5 دقائق");
    expect(formatDuration(1, "ar")).toBe("ثانية واحدة");
    expect(formatDuration(45, "ar")).toBe("45 ثانية");
  });

  test("English keeps the shipped phrasing", () => {
    expect(formatDuration(86400, "en")).toBe("24 hours");
    expect(formatDuration(3600, "en")).toBe("1 hour");
    expect(formatDuration(60, "en")).toBe("1 minute");
    expect(formatDuration(90, "en")).toBe("90 seconds");
  });
});
