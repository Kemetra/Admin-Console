/**
 * RT-767 pure helpers for the shared product picker. No React, no fetch; helpers
 * return catalog message keys, never copy (RT-399).
 *
 * The picker lists ACTIVE products only (RT-743 D6) and asks for no store view:
 * no `store_id` means no `storeView`, so no price reaches it (RT-743 D4) and a
 * store out of scope cannot refuse it.
 */
import type { MessageKey } from "@/i18n";
import type { CatalogListQuery } from "@/lib/catalog-queries";
import { MAX_QUERY_LENGTH } from "./catalogLogic";

/** The page size asked for. Without a total, a longer list is narrowed by searching. */
export const PICKER_PAGE_SIZE = 25;

/** The contract's limit on the search text. */
export const MAX_PICKER_QUERY_LENGTH = MAX_QUERY_LENGTH;

/** The query: always active, never a store; the search text goes verbatim. */
export function buildPickerQuery(q: string): NonNullable<CatalogListQuery> {
  return { ...(q === "" ? {} : { q }), status: "active", limit: PICKER_PAGE_SIZE };
}

/** What the server would refuse with a 400, caught before the request. */
export function validatePickerQuery(q: string): MessageKey | undefined {
  return q.length > MAX_PICKER_QUERY_LENGTH ? "catalog.picker.qTooLong" : undefined;
}

export type PickerErrorKind = "not-found" | "session" | "rejected" | "rate-limited" | "generic";

const ERROR_KEYS: Record<PickerErrorKind, MessageKey> = {
  "not-found": "catalog.picker.error.notFound",
  session: "catalog.picker.error.session",
  rejected: "catalog.picker.error.rejected",
  "rate-limited": "catalog.picker.error.rateLimited",
  generic: "catalog.picker.error.generic",
};

export function pickerErrorKey(kind: PickerErrorKind): MessageKey {
  return ERROR_KEYS[kind];
}

/** Which failure each refused status is. A 5xx or no answer is `generic`. */
export const PICKER_STATUS_KINDS: Readonly<Record<number, PickerErrorKind>> = {
  400: "rejected",
  401: "session",
  404: "not-found",
  429: "rate-limited",
};

/** Enter and Space choose the active option. */
export function isChooseKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

/**
 * The listbox's next active option for a navigation key, or null when the key
 * moves nothing. From no active option (-1) ArrowDown enters at the first and
 * ArrowUp at the last; the ends stop rather than wrap.
 */
export function nextOptionIndex(current: number, key: string, count: number): number | null {
  if (count === 0) return null;
  const last = count - 1;
  switch (key) {
    case "ArrowDown":
      return Math.min(current + 1, last);
    case "ArrowUp":
      return current < 0 ? last : Math.max(current - 1, 0);
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}
