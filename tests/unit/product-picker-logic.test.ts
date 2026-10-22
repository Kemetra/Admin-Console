import {
  MAX_PICKER_QUERY_LENGTH,
  PICKER_PAGE_SIZE,
  buildPickerQuery,
  isChooseKey,
  nextOptionIndex,
  pickerErrorKey,
  validatePickerQuery,
} from "@/catalog/productPickerLogic";
import { describe, expect, test } from "vitest";

/**
 * RT-767: the picker's pure rules. It lists ACTIVE products only (RT-743 D6),
 * sends the search text exactly as typed, and asks for no store view, so no
 * price and no store-scope refusal can reach it.
 */
describe("buildPickerQuery", () => {
  test("always asks for active products, a bounded page, and no store", () => {
    const query = buildPickerQuery("");
    expect(query).toEqual({ status: "active", limit: PICKER_PAGE_SIZE });
    expect(query).not.toHaveProperty("store_id");
    expect(query).not.toHaveProperty("category_id");
  });

  test("sends the search text verbatim: leading zeros and spaces are kept", () => {
    expect(buildPickerQuery("0012345678905")).toMatchObject({ q: "0012345678905" });
    expect(buildPickerQuery(" cola ")).toMatchObject({ q: " cola " });
  });
});

describe("validatePickerQuery", () => {
  test("a search within the contract limit is accepted", () => {
    expect(validatePickerQuery("a".repeat(MAX_PICKER_QUERY_LENGTH))).toBeUndefined();
    expect(validatePickerQuery("")).toBeUndefined();
  });

  test("a search over the limit is refused before any request", () => {
    expect(validatePickerQuery("a".repeat(MAX_PICKER_QUERY_LENGTH + 1))).toBe(
      "catalog.picker.qTooLong",
    );
  });
});

describe("pickerErrorKey", () => {
  test.each([
    ["not-found", "catalog.picker.error.notFound"],
    ["session", "catalog.picker.error.session"],
    ["rejected", "catalog.picker.error.rejected"],
    ["rate-limited", "catalog.picker.error.rateLimited"],
    ["generic", "catalog.picker.error.generic"],
  ] as const)("%s reads as %s", (kind, key) => {
    expect(pickerErrorKey(kind)).toBe(key);
  });
});

describe("nextOptionIndex", () => {
  test("ArrowDown and ArrowUp move one option and stop at the ends", () => {
    expect(nextOptionIndex(0, "ArrowDown", 3)).toBe(1);
    expect(nextOptionIndex(2, "ArrowDown", 3)).toBe(2);
    expect(nextOptionIndex(2, "ArrowUp", 3)).toBe(1);
    expect(nextOptionIndex(0, "ArrowUp", 3)).toBe(0);
  });

  test("Home and End jump to the first and last option", () => {
    expect(nextOptionIndex(1, "Home", 3)).toBe(0);
    expect(nextOptionIndex(1, "End", 3)).toBe(2);
  });

  test("from no active option, ArrowDown enters at the first and ArrowUp at the last", () => {
    expect(nextOptionIndex(-1, "ArrowDown", 3)).toBe(0);
    expect(nextOptionIndex(-1, "ArrowUp", 3)).toBe(2);
  });

  test("any other key, and an empty list, move nothing", () => {
    expect(nextOptionIndex(1, "Escape", 3)).toBeNull();
    expect(nextOptionIndex(1, "a", 3)).toBeNull();
    expect(nextOptionIndex(-1, "ArrowDown", 0)).toBeNull();
  });
});

describe("isChooseKey", () => {
  test("Enter and Space choose; nothing else does", () => {
    expect(isChooseKey("Enter")).toBe(true);
    expect(isChooseKey(" ")).toBe(true);
    expect(isChooseKey("Escape")).toBe(false);
    expect(isChooseKey("ArrowDown")).toBe(false);
  });
});
