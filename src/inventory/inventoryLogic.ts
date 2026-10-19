/**
 * RT-728 pure helpers for the inventory read views. No React, no fetch.
 *
 * Truth rules: quantities are the API's exact-decimal strings, rendered as
 * sent and never parsed or summed here. A value the API did not send, or a
 * read that failed, is Unknown, never zero. ERPNext book stock is not shown
 * on these views (it lives on the stock-discrepancy view); `integrationState`
 * is the movement's ERP posting state as the API reports it, nothing more.
 *
 * RT-399: helpers return catalog message keys, never copy.
 */
import type { MessageKey } from "@/i18n";
import type { InventoryStatus, StockMovement } from "@/lib/inventory-queries";

/**
 * Console roles that may open the inventory views. The API itself checks only
 * tenant membership and store access (non-disclosing 404 outside it); these are
 * the console roles with store-scoped operational reads (as for sales).
 * Navigation gate only, not an authorization decision.
 */
export const READ_ROLES = ["owner", "tenant_admin", "store_manager"] as const;

/** `listTrackingIdentities` is owner / tenant_admin only (any other role: 404). */
export const TRACKING_ROLES = ["owner", "tenant_admin"] as const;

export function canReadInventory(role: string | null | undefined): boolean {
  return (READ_ROLES as readonly string[]).includes(role ?? "");
}

export function canReadTracking(role: string | null | undefined): boolean {
  return (TRACKING_ROLES as readonly string[]).includes(role ?? "");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A route id that is not a UUID would be a contract 400: it renders as not-found. */
export function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

function keyOf(map: Record<string, MessageKey>, code: string, fallback: MessageKey): MessageKey {
  return Object.hasOwn(map, code) ? map[code] : fallback;
}

// --- Movement fields ----------------------------------------------------------

const MOVEMENT_TYPE_KEYS: Record<string, MessageKey> = {
  inbound: "inventory.movementType.inbound",
  outbound: "inventory.movementType.outbound",
  adjustment: "inventory.movementType.adjustment",
  transfer_out: "inventory.movementType.transfer_out",
  transfer_in: "inventory.movementType.transfer_in",
  count_correction: "inventory.movementType.count_correction",
};

export function movementTypeKey(code: string): MessageKey {
  return keyOf(MOVEMENT_TYPE_KEYS, code, "inventory.value.unknown");
}

const STATUS_KEYS: Record<string, MessageKey> = {
  sellable: "inventory.status.sellable",
  return_inspection: "inventory.status.return_inspection",
  quality_hold: "inventory.status.quality_hold",
  damaged: "inventory.status.damaged",
  expired: "inventory.status.expired",
  recall_hold: "inventory.status.recall_hold",
};

export function inventoryStatusKey(code: InventoryStatus | string): MessageKey {
  return keyOf(STATUS_KEYS, code, "inventory.value.unknown");
}

const INTEGRATION_KEYS: Record<string, MessageKey> = {
  not_posted: "inventory.integration.not_posted",
  pending: "inventory.integration.pending",
  confirmed: "inventory.integration.confirmed",
  rejected: "inventory.integration.rejected",
  reconciliation_required: "inventory.integration.reconciliation_required",
  external: "inventory.integration.external",
};

/** A missing state is "Not recorded" (the API's null); an unrecognised one is Unknown. */
export function integrationStateKey(code: StockMovement["integrationState"]): MessageKey {
  if (code === null || code === undefined) return "inventory.value.notRecorded";
  return keyOf(INTEGRATION_KEYS, code, "inventory.value.unknown");
}

const LOCATION_KIND_KEYS: Record<string, MessageKey> = {
  primary: "inventory.locations.kind.primary",
  storage: "inventory.locations.kind.storage",
};

export function locationKindKey(code: string): MessageKey {
  return keyOf(LOCATION_KIND_KEYS, code, "inventory.value.unknown");
}

const TRACKING_KIND_KEYS: Record<string, MessageKey> = {
  batch: "inventory.tracking.kind.batch",
  serial: "inventory.tracking.kind.serial",
};

export function trackingKindKey(code: string): MessageKey {
  return keyOf(TRACKING_KIND_KEYS, code, "inventory.value.unknown");
}

/** The product a movement belongs to, or undefined for an ad-hoc (null-product) movement. */
export function movementProductId(movement: StockMovement): string | undefined {
  const ref = movement.tenantProductRef;
  return isUuid(ref ?? undefined) ? (ref as string) : undefined;
}

/** A stock location's display name from the store's locations, or undefined when not listed. */
export function locationLabel(
  locations: readonly { id: string; name: string; code: string }[] | undefined,
  id: string,
): string | undefined {
  const found = locations?.find((l) => l.id === id);
  return found ? found.name || found.code : undefined;
}

// --- Paging and errors --------------------------------------------------------

/** getNextPageParam: a null cursor stops paging (undefined in TanStack v5). */
export function nextCursorOf(page: { nextCursor?: string | null }): string | undefined {
  return page.nextCursor ?? undefined;
}

export type ReadErrorKind =
  | "not-found"
  | "forbidden"
  | "session"
  | "rejected"
  | "rate-limited"
  | "generic";

const READ_KINDS: Record<number, ReadErrorKind> = {
  400: "rejected",
  401: "session",
  403: "forbidden",
  404: "not-found",
  429: "rate-limited",
};

export function readErrorKind(status: number): ReadErrorKind {
  return READ_KINDS[status] ?? "generic";
}

interface ErrorEnvelope {
  error?: { request_id?: string };
}

export function requestIdOf(error: unknown): string | undefined {
  return (error as ErrorEnvelope | undefined)?.error?.request_id;
}

/** A 403 or 404 on an optional section (tracking) means: not for this caller, omit it. */
export function isHiddenSection(kind: ReadErrorKind): boolean {
  return kind === "forbidden" || kind === "not-found";
}
