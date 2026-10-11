import { returnPathOf, safeReturnPath } from "@/shell/return-path";
import { describe, expect, test } from "vitest";

/**
 * RT-355: the path a signed-out user asked for is kept across sign-in, and only
 * a same-origin, in-app path is ever honored (no open redirect).
 */
describe("returnPathOf", () => {
  test("keeps path, search and hash", () => {
    expect(returnPathOf({ pathname: "/audit", search: "?actor=u1", hash: "#top" })).toBe(
      "/audit?actor=u1#top",
    );
  });
});

describe("safeReturnPath", () => {
  test.each([
    ["/audit?actor=u1#top", "/audit?actor=u1#top"],
    ["/stores/s1", "/stores/s1"],
    ["/", "/"],
  ])("honors the in-app path %s", (raw, expected) => {
    expect(safeReturnPath(raw)).toBe(expected);
  });

  test.each([
    ["absolute URL", "https://evil.example/x"],
    ["protocol-relative URL", "//evil.example/x"],
    ["backslash host", "/\\evil.example/x"],
    ["javascript scheme", "javascript:alert(1)"],
    ["relative path", "audit"],
    ["the sign-in page", "/signin"],
    ["the sign-in page with a query", "/signin?next=/audit"],
    ["the sign-in page with a trailing slash", "/signin/"],
    ["an empty string", ""],
    ["undefined", undefined],
    ["a non-string", { pathname: "/audit" }],
  ])("falls back to / for %s", (_label, raw) => {
    expect(safeReturnPath(raw)).toBe("/");
  });
});
