import type { SettlementSchema } from "@/generated/schema";
/**
 * 017 payer-list keyset pagination — pure helpers (FR-007 / OQ-CON-LIST-FILTER).
 * No client, no React. The useInfiniteQuery binding calls these:
 * `nextPayerCursor` is the `getNextPageParam` rule, `flattenPayerPages` is the
 * `data.pages` projection. Server-side filtering is `category` + opaque cursor
 * only; any displayName search is a client-side affordance over the
 * already-returned rows (not modeled here).
 *
 * A page can be empty while its cursor is non-null (the server MAY return
 * fewer than `page_size`): "no more" is a null cursor, never an empty page.
 */
import type { MessageKey } from "@/i18n";

type Schemas = SettlementSchema.components["schemas"];

/** A payer account as the API projects it (`PayerAccount`). */
export type PayerRow = Schemas["PayerAccount"];

/** One page of the `PayerAccountPage` projection. */
export type PayerListPage = Schemas["PayerAccountPage"];

/**
 * getNextPageParam rule: a present cursor means "more pages"; `null` means the
 * last page → return `undefined` so useInfiniteQuery stops.
 */
export function nextPayerCursor(page: PayerListPage): string | undefined {
  return page.nextCursor ?? undefined;
}

/**
 * Flatten fetched pages into a single newest-first row list (fetch order). A
 * keyset walk is not a snapshot, so a payer that comes back on a later page is
 * kept once, where it first appeared: the table never holds two rows (or two
 * React keys) for one payer.
 */
export function flattenPayerPages(pages: readonly PayerListPage[]): PayerRow[] {
  const seen = new Set<string>();
  return pages
    .flatMap((page) => page.items)
    .filter((row) => {
      if (seen.has(row.payerRef)) return false;
      seen.add(row.payerRef);
      return true;
    });
}

/** What a payer's scope reads as: the whole tenant, or one store (named when the roster knows it). */
export type PayerScope = { kind: "tenant" } | { kind: "store"; name?: string };

export function payerScope(
  row: Pick<PayerRow, "storeId">,
  stores: readonly { id: string; name?: string }[],
): PayerScope {
  if (!row.storeId) return { kind: "tenant" };
  const name = stores.find((s) => s.id === row.storeId)?.name;
  return name ? { kind: "store", name } : { kind: "store" };
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
