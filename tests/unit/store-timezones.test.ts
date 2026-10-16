import {
  DEFAULT_STORE_TIMEZONE,
  isIanaTimezone,
  timezoneOptions,
  zoneLabel,
} from "@/lib/timezones";
import { describe, expect, test } from "vitest";

/**
 * RT-477 store time zone helpers: the IANA shape the contract accepts
 * (`IanaTimezone`), and the label shown for a zone: the IANA identity with its
 * city name, never a fixed UTC offset.
 */
describe("DEFAULT_STORE_TIMEZONE", () => {
  test("is Africa/Cairo (owner decision, Jira RT-477 comment 12083)", () => {
    expect(DEFAULT_STORE_TIMEZONE).toBe("Africa/Cairo");
  });
});

describe("isIanaTimezone", () => {
  test.each(["UTC", "Africa/Cairo", "Asia/Riyadh", "America/Argentina/Buenos_Aires"])(
    "accepts %s",
    (zone) => expect(isIanaTimezone(zone)).toBe(true),
  );

  test.each([
    ["empty", ""],
    ["an abbreviation", "EET"],
    ["a POSIX string", "UTC+2"],
    ["an offset", "+02:00"],
    ["an Etc zone", "Etc/GMT+2"],
    ["a legacy alias tree", "US/Eastern"],
    ["the wrong case", "africa/cairo"],
    ["an unknown location", "Africa/Nowhere"],
    ["an unknown area", "Mars/Base"],
    ["surrounding whitespace", " Africa/Cairo "],
  ])("rejects %s", (_name, zone) => expect(isIanaTimezone(zone)).toBe(false));
});

describe("zoneLabel", () => {
  test("a known zone: city name and the IANA identity, no UTC offset", () => {
    expect(zoneLabel("Africa/Cairo", "en")).toBe("Cairo (Africa/Cairo)");
    expect(zoneLabel("Africa/Cairo", "ar")).toBe("القاهرة (Africa/Cairo)");
    expect(zoneLabel("Africa/Cairo", "en")).not.toMatch(/UTC[+-]|GMT|\+\d\d:\d\d/);
  });

  test("UTC is shown as UTC alone", () => {
    expect(zoneLabel("UTC", "en")).toBe("UTC");
    expect(zoneLabel("UTC", "ar")).toBe("UTC");
  });

  test("a zone with no curated name is shown as its IANA identity", () => {
    expect(zoneLabel("Asia/Tokyo", "en")).toBe("Asia/Tokyo");
    expect(zoneLabel("Asia/Tokyo", "ar")).toBe("Asia/Tokyo");
  });
});

describe("timezoneOptions", () => {
  test("lists the common zones first, Africa/Cairo among them", () => {
    const { common } = timezoneOptions();
    expect(common).toContain("Africa/Cairo");
    expect(common).toContain("UTC");
  });

  test("the other zones are valid IANA names and never repeat a common one", () => {
    const { common, other } = timezoneOptions();
    expect(other.length).toBeGreaterThan(0);
    expect(other.every(isIanaTimezone)).toBe(true);
    expect(other.some((zone) => common.includes(zone))).toBe(false);
    expect(new Set(other).size).toBe(other.length);
  });

  test("a store's current zone is always an option, even outside both lists", () => {
    const { common, other } = timezoneOptions("Antarctica/Troll");
    expect([...common, ...other]).toContain("Antarctica/Troll");
    const legacy = timezoneOptions("Not/Listed");
    expect([...legacy.common, ...legacy.other]).toContain("Not/Listed");
  });
});
