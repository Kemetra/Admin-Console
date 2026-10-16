/**
 * RT-18 pure helpers for the shift-close variance review. No React, no fetch.
 * The view never recomputes money: it renders the API's `variance`, `expectedCash`
 * and `countedCash` as received (variance = counted - expected, signed).
 *
 * RT-399: helpers return catalog message keys, never copy; components translate
 * at render so a locale switch re-renders them.
 */
import type { MessageKey } from "@/i18n";
import type { CloseKind, ShiftCashMovement, ShiftClosePage } from "@/lib/shift-close-queries";

/** Roles the API lets read the shift-close review (RT-383). */
export const READ_ROLES = ["owner", "tenant_admin", "store_manager"] as const;

/** Navigation gate: mirrors the API's read roles. Not an authorization decision. */
export function canReadShiftCloses(role: string | null | undefined): boolean {
  return (READ_ROLES as readonly string[]).includes(role ?? "");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A route id that is not a UUID would be a contract 400: it renders as not-found. */
export function isShiftId(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

// --- Keyset paging -----------------------------------------------------------

/** getNextPageParam: a null cursor stops paging (undefined in TanStack v5). */
export function nextShiftCloseCursor(page: ShiftClosePage): string | undefined {
  return page.nextCursor ?? undefined;
}

export function flattenShiftClosePages<T>(
  pages: readonly { items: T[]; nextCursor?: string | null }[],
): T[] {
  return pages.flatMap((page) => page.items);
}

// --- Variance ----------------------------------------------------------------

export type VarianceDirection = "over" | "short" | "none";

const ZERO_VARIANCE = /^[+-]?0*(\.0*)?$/;

/**
 * Over (counted > expected), short (counted < expected) or none, read from the
 * exact-decimal string without parsing it as a float.
 */
export function varianceDirection({ variance }: { variance: string }): VarianceDirection {
  const trimmed = variance.trim();
  if (ZERO_VARIANCE.test(trimmed)) return "none";
  return trimmed.startsWith("-") ? "short" : "over";
}

const DIRECTION_KEYS: Record<VarianceDirection, MessageKey> = {
  over: "shift.variance.over",
  short: "shift.variance.short",
  none: "shift.variance.none",
};

export function varianceDirectionKey(amount: { variance: string }): MessageKey {
  return DIRECTION_KEYS[varianceDirection(amount)];
}

// --- Label keys (machine codes drive copy; they are not copy) -------------------

const CLOSE_KIND_KEYS: Record<CloseKind, MessageKey> = {
  normal: "shift.kind.normal",
  forced: "shift.kind.forced",
};

export function closeKindKey({ closeKind }: { closeKind: string }): MessageKey {
  return Object.hasOwn(CLOSE_KIND_KEYS, closeKind)
    ? CLOSE_KIND_KEYS[closeKind as CloseKind]
    : "shift.kind.unknown";
}

const MOVEMENT_KIND_KEYS: Record<ShiftCashMovement["kind"], MessageKey> = {
  pay_in: "shift.movement.kind.pay_in",
  pay_out: "shift.movement.kind.pay_out",
};

export function movementKindKey({ kind }: { kind: string }): MessageKey {
  return Object.hasOwn(MOVEMENT_KIND_KEYS, kind)
    ? MOVEMENT_KIND_KEYS[kind as ShiftCashMovement["kind"]]
    : "shift.movement.kind.unknown";
}

const REASON_KEYS: Record<ShiftCashMovement["reasonCode"], MessageKey> = {
  bank_drop: "shift.movement.reason.bank_drop",
  float_top_up: "shift.movement.reason.float_top_up",
  petty_expense: "shift.movement.reason.petty_expense",
  other: "shift.movement.reason.other",
};

export function reasonCodeKey({ reasonCode }: { reasonCode: string }): MessageKey {
  return Object.hasOwn(REASON_KEYS, reasonCode)
    ? REASON_KEYS[reasonCode as ShiftCashMovement["reasonCode"]]
    : "shift.movement.reason.unknown";
}

// --- Errors --------------------------------------------------------------------

export function requestIdOf(error: unknown): string | undefined {
  return (error as { error?: { request_id?: string } } | undefined)?.error?.request_id;
}
