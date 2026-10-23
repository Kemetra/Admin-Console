/**
 * RT-753 (UX-10) — the pure half of the shared table sort.
 *
 * `DataTable` never reorders the rows it is given: the CALLER owns the sort
 * state and the order. "Sort the dataset, not the viewport": paged or
 * server-backed data must sort at the query layer, so `sortRows` is only for a
 * COMPLETE in-memory set (an endpoint with no cursor, limit or cap). Sorting
 * only the loaded pages of a paged list would imply an order the dataset does
 * not have.
 */

export type SortDirection = "asc" | "desc";

export interface SortState {
  readonly key: string;
  readonly direction: SortDirection;
}

/**
 * RT-758 three-state cycle: a clicked column sorts ascending, then descending,
 * then clears (`null` = the server's order). A different column starts ascending.
 */
export function nextSort(current: SortState | null | undefined, key: string): SortState | null {
  if (current?.key !== key) return { key, direction: "asc" };
  return current.direction === "asc" ? { key, direction: "desc" } : null;
}

export type SortValue = string | number | null | undefined;

function isEmpty(value: SortValue): value is null | undefined {
  return value === null || value === undefined || value === "";
}

/**
 * A new array ordered by `sort` (the input is never mutated; `null` keeps the
 * given order, i.e. the server's). Text is compared with the locale's collation
 * and numerically ("Mall 2" before "Mall 10"); empty values sort last in both
 * directions; ties keep their original order.
 */
export function sortRows<Row>(
  rows: readonly Row[],
  sort: SortState | null,
  valueFor: (row: Row, key: string) => SortValue,
  locale: string,
): Row[] {
  if (sort === null) return [...rows];
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = valueFor(a, sort.key);
    const right = valueFor(b, sort.key);
    if (isEmpty(left) || isEmpty(right)) {
      return Number(isEmpty(left)) - Number(isEmpty(right));
    }
    if (typeof left === "number" && typeof right === "number") {
      return sign * (left - right);
    }
    return sign * collator.compare(String(left), String(right));
  });
}
