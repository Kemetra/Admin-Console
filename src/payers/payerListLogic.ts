/**
 * 017 payer-list keyset pagination — pure helpers (FR-007 / OQ-CON-LIST-FILTER).
 * No client, no React, no generated types. The useInfiniteQuery binding (in the
 * G-client slice) calls these: `nextPayerCursor` is the `getNextPageParam` rule,
 * `flattenPayerPages` is the `data.pages.flatMap` projection. Server-side
 * filtering is `category` + opaque cursor only; any displayName search is a
 * client-side affordance over the already-returned rows (not modeled here).
 */
import type { MessageKey } from "@/i18n";

/** A rendered payer row (subset; full projection lands with the generated type). */
export interface PayerRow {
  payerRef: string;
}

/** One page of the `PayerAccountPage` projection. */
export interface PayerListPage {
  items: PayerRow[];
  nextCursor: string | null;
}

/**
 * getNextPageParam rule: a present cursor means "more pages"; `null` means the
 * last page → return `undefined` so useInfiniteQuery stops.
 */
export function nextPayerCursor(page: PayerListPage): string | undefined {
  return page.nextCursor ?? undefined;
}

/** Flatten fetched pages into a single newest-first row list (fetch order). */
export function flattenPayerPages(pages: readonly PayerListPage[]): PayerRow[] {
  return pages.flatMap((page) => page.items);
}

// --- Display labels (RT-399) -------------------------------------------------
// Machine codes drive copy; they are not copy (UX-12). The raw `category` /
// `status` values stay as the API sent them; only their labels are localized.

const CATEGORY_KEYS: Record<string, MessageKey> = {
  credit_customer: "payers.category.credit_customer",
  corporate: "payers.category.corporate",
  insurer: "payers.category.insurer",
};

/**
 * The label key for a payer category. `PayerCategory` is extensible upstream,
 * so a code this build does not know gets a localized fallback, never the raw value.
 */
export function payerCategoryKey(category: string): MessageKey {
  return Object.hasOwn(CATEGORY_KEYS, category)
    ? CATEGORY_KEYS[category]
    : "payers.category.unknown";
}

/** The label key for a payer status (display-only; anything not suspended reads as active). */
export function payerStatusKey(status: string): MessageKey {
  return status === "suspended" ? "payers.status.suspended" : "payers.status.active";
}
