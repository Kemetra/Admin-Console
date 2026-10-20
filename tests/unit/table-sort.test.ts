import { nextSort, sortRows } from "@/components/tableSort";
import { describe, expect, test } from "vitest";

/**
 * RT-753 (UX-10) — the pure half of the shared table sort. `DataTable` never
 * reorders rows; the caller owns the sort state and, for a complete in-memory
 * set, orders it with `sortRows`. Paged/server-backed data must NOT use
 * `sortRows` ("sort the dataset, not the viewport").
 */

describe("nextSort", () => {
  test("an unsorted table sorts a clicked column ascending", () => {
    expect(nextSort(null, "name")).toEqual({ key: "name", direction: "asc" });
  });

  test("clicking the ascending column flips it to descending", () => {
    expect(nextSort({ key: "name", direction: "asc" }, "name")).toEqual({
      key: "name",
      direction: "desc",
    });
  });

  test("clicking the descending column flips it back to ascending", () => {
    expect(nextSort({ key: "name", direction: "desc" }, "name")).toEqual({
      key: "name",
      direction: "asc",
    });
  });

  test("clicking another column starts that column ascending", () => {
    expect(nextSort({ key: "name", direction: "desc" }, "code")).toEqual({
      key: "code",
      direction: "asc",
    });
  });
});

interface Row {
  id: string;
  name: string | null;
  qty: number;
}

const valueFor = (row: Row, key: string): string | number | null =>
  key === "qty" ? row.qty : row.name;

const rows: Row[] = [
  { id: "a", name: "Mall 10", qty: 5 },
  { id: "b", name: "Mall 2", qty: 12 },
  { id: "c", name: null, qty: 7 },
  { id: "d", name: "Alexandria", qty: 7 },
];

describe("sortRows", () => {
  test("no sort returns the rows in the order given (the server's order)", () => {
    expect(sortRows(rows, null, valueFor, "en").map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });

  test("never mutates the input array", () => {
    const copy = [...rows];
    sortRows(rows, { key: "qty", direction: "asc" }, valueFor, "en");
    expect(rows).toEqual(copy);
  });

  test("orders numbers numerically and keeps ties in their original order", () => {
    const out = sortRows(rows, { key: "qty", direction: "asc" }, valueFor, "en");
    expect(out.map((r) => r.id)).toEqual(["a", "c", "d", "b"]);
  });

  test("descending reverses the comparison but still keeps ties stable", () => {
    const out = sortRows(rows, { key: "qty", direction: "desc" }, valueFor, "en");
    expect(out.map((r) => r.id)).toEqual(["b", "c", "d", "a"]);
  });

  test("text is compared naturally: Mall 2 before Mall 10", () => {
    const out = sortRows(rows, { key: "name", direction: "asc" }, valueFor, "en");
    expect(out.map((r) => r.id)).toEqual(["d", "b", "a", "c"]);
  });

  test("empty values sort last in both directions", () => {
    const asc = sortRows(rows, { key: "name", direction: "asc" }, valueFor, "en");
    const desc = sortRows(rows, { key: "name", direction: "desc" }, valueFor, "en");
    expect(asc.at(-1)?.id).toBe("c");
    expect(desc.at(-1)?.id).toBe("c");
  });

  test("Arabic text uses the Arabic collation", () => {
    const arabic = [
      { id: "1", name: "مدينة نصر", qty: 0 },
      { id: "2", name: "الإسكندرية", qty: 0 },
      { id: "3", name: "القاهرة", qty: 0 },
    ];
    const out = sortRows(arabic, { key: "name", direction: "asc" }, valueFor, "ar");
    expect(out.map((r) => r.name)).toEqual(["الإسكندرية", "القاهرة", "مدينة نصر"]);
  });
});
