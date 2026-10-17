/**
 * RT-587 pure helpers for the sales screens. No React, no fetch. The view
 * renders server truth: it never recomputes money, totals, return or ERP
 * state (spec 012 FR-008 / FR-011).
 *
 * RT-399: helpers return catalog message keys, never copy; components translate
 * at render so a locale switch re-renders them.
 */
import type { MessageKey } from "@/i18n";

/** Roles the API lets read sales (OD-556-3). */
export const READ_ROLES = ["owner", "tenant_admin", "store_manager"] as const;

/** Navigation gate: mirrors the API's read roles. Not an authorization decision. */
export function canReadSales(role: string | null | undefined): boolean {
  return (READ_ROLES as readonly string[]).includes(role ?? "");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A route id that is not a UUID would be a contract 400: it renders as not-found. */
export function isSaleRef(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

// --- Keyset paging -----------------------------------------------------------

/**
 * getNextPageParam. A page may be short or empty with a non-null cursor (the
 * server bounds the rows it examines); only `null` ends the walk.
 */
export function nextSaleCursor(page: { nextCursor: string | null }): string | undefined {
  return page.nextCursor ?? undefined;
}

/** The walk has ended: the last loaded page carries `nextCursor: null`. */
export function listEnded(pages: readonly { nextCursor: string | null }[]): boolean {
  // No page yet is not an end: `undefined === null` is false.
  return pages.at(-1)?.nextCursor === null;
}

// --- Label keys (machine codes drive copy; they are not copy) -------------------

function keyOf(map: Record<string, MessageKey>, code: string, fallback: MessageKey): MessageKey {
  return Object.hasOwn(map, code) ? map[code] : fallback;
}

const SYNC_KEYS: Record<string, MessageKey> = {
  captured: "sales.sync.captured",
  synced: "sales.sync.synced",
  "failed-retryable": "sales.sync.failedRetryable",
  "failed-needs-repair": "sales.sync.failedNeedsRepair",
};

export function syncStatusKey({ syncStatus }: { syncStatus: string }): MessageKey {
  return keyOf(SYNC_KEYS, syncStatus, "sales.sync.unknownCode");
}

const RETURN_KEYS: Record<string, MessageKey> = {
  none: "sales.returns.none",
  partial: "sales.returns.partial",
  full: "sales.returns.full",
};

export function returnStateKey({ returnState }: { returnState: string }): MessageKey {
  return keyOf(RETURN_KEYS, returnState, "sales.returns.unknownCode");
}

const ERP_KEYS: Record<string, MessageKey> = {
  posted: "sales.erp.posted",
  pending: "sales.erp.pending",
  failed: "sales.erp.failed",
  unknown: "sales.erp.unknown",
};

/** An unrecognised code is shown as unknown: never as "not posted" (spec 012 §8). */
export function erpStateKey({ erpPostingState }: { erpPostingState: string }): MessageKey {
  return keyOf(ERP_KEYS, erpPostingState, "sales.erp.unknown");
}

const TENDER_KEYS: Record<string, MessageKey> = {
  cash: "sales.tender.cash",
  card_external: "sales.tender.card_external",
};

export function tenderMethodKey({ method }: { method: string }): MessageKey {
  return keyOf(TENDER_KEYS, method, "sales.tender.unknownMethod");
}

// --- Links ---------------------------------------------------------------------

/**
 * The shift-close exception list for the sale's store and business day (spec
 * 012 §7): the keys `ShiftCloseList` already reads. Not "this sale's shift".
 */
export function shiftClosesHref({
  storeRef,
  businessDate,
}: {
  storeRef: string;
  businessDate: string;
}): string {
  const search = new URLSearchParams({ store: storeRef, from: businessDate, to: businessDate });
  return `/shift-closes?${search.toString()}`;
}
