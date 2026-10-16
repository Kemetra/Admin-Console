/**
 * RT-559 pure helpers for the Overview (spec 009). No React, no fetch.
 *
 * - Counts follow §6.3: one page per panel, "at least N" when a further page
 *   exists, "none" only when an empty page has no cursor. No page walking.
 * - The shift-close window follows OD-009-2 and is built with the destination's
 *   own helpers (`buildListQuery`, `filtersToSearch`, `zonedDayStartIso`), so
 *   the row and the linked list cover the same subset.
 * - Recent activity (P-5) is deferred (OD-009-3, RT-567): owner and tenant_admin
 *   get a plain link to `/audit`, with no list and no counts.
 */
import { isValidZone } from "@/i18n/format";
import type { ShiftCloseListQuery } from "@/lib/shift-close-queries";
import {
  MIN_NONZERO_VARIANCE,
  type ShiftCloseFilters,
  buildListQuery,
  filtersToSearch,
} from "@/shift-closes/shiftCloseFilters";

// --- Counts ----------------------------------------------------------------------

export type PageCount =
  | { kind: "exact"; count: number }
  | { kind: "atLeast"; count: number }
  | { kind: "none" }
  /** An empty page that still has a cursor: not proven empty. */
  | { kind: "unproven" };

/** What one page proves, from the rows actually returned and the next cursor. */
export function pageCount(returned: number, nextCursor: string | null | undefined): PageCount {
  const more = nextCursor != null;
  if (returned === 0) return more ? { kind: "unproven" } : { kind: "none" };
  return more ? { kind: "atLeast", count: returned } : { kind: "exact", count: returned };
}

/** A 403 or 404 means the session may not read this panel: it is omitted (§6.2). */
export function isRefusal(status: number): boolean {
  return status === 403 || status === 404;
}

// --- Shift-close attention window (OD-009-2) --------------------------------------

/** Today plus the six days before it. */
export const ATTENTION_DAYS = 7;

/** Today's calendar day (`YYYY-MM-DD`) in a time zone; an unknown zone is UTC. */
export function todayInZone(timeZone: string, nowMs: number): string {
  const zone = isValidZone(timeZone) ? timeZone : "UTC";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The calendar day `days` before `date` (pure date arithmetic, no zone). */
function daysBefore(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

export interface ShiftAttentionInput {
  /** The active store, or null tenant-wide. */
  storeId: string | null;
  /** The active store's zone (the destination's fallback is UTC). */
  timeZone: string;
  nowMs: number;
}

export interface ShiftAttention {
  filters: ShiftCloseFilters;
  query: ShiftCloseListQuery;
  href: string;
}

/**
 * Unapproved closes with any non-zero variance, closed in the last
 * `ATTENTION_DAYS` days. The query is the destination's own `buildListQuery`
 * without its page size, so the server's default page (50) is read (§6.3).
 */
export function shiftAttention({ storeId, timeZone, nowMs }: ShiftAttentionInput): ShiftAttention {
  const filters: ShiftCloseFilters = {
    storeId: storeId ?? "",
    fromDate: daysBefore(todayInZone(timeZone, nowMs), ATTENTION_DAYS - 1),
    toDate: "",
    closeKind: "",
    minVariance: MIN_NONZERO_VARIANCE,
    currency: "",
    approval: "not_approved",
  };
  const { page_size: _pageSize, ...query } = buildListQuery({ filters, timeZone });
  return { filters, query, href: `/shift-closes?${filtersToSearch(filters).toString()}` };
}

// --- Audit link (P-5 deferred, OD-009-3) -------------------------------------------

/** Roles `listAuditEvents` serves (spec 009 §5.1); the link mirrors the API. */
export const AUDIT_READ_ROLES = ["owner", "tenant_admin"] as const;

/** Whether to show the plain link to `/audit`. Not an authorization decision. */
export function canOpenAudit(role: string | null | undefined): boolean {
  return (AUDIT_READ_ROLES as readonly string[]).includes(role ?? "");
}
