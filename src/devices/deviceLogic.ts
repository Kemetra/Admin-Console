/**
 * RT-371 pure helpers for the device registry. No React, no fetch.
 *
 * Truth rules (RT-287 D-Q6): there is no single health bit and nothing here
 * maps to "healthy". Trust state is the credential's state only. Last seen is
 * the last authenticated activity, labelled with its source; a missing value
 * or a source the console does not know reads as unknown, never as fine.
 * Helpers return catalog message keys, never copy (RT-399).
 */
import type { MessageKey } from "@/i18n";
import type { DevicePage, RevokeReason, TrustState } from "@/lib/device-queries";

/** Roles the API lets read the device registry (RT-365). */
export const READ_ROLES = ["owner", "tenant_admin", "store_manager"] as const;

/** Navigation gate: mirrors the API's read roles. Not an authorization decision. */
export function canReadDevices(role: string | null | undefined): boolean {
  return (READ_ROLES as readonly string[]).includes(role ?? "");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A value that is not a UUID would be a contract 400. */
export function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

// --- Keyset paging -----------------------------------------------------------

/** getNextPageParam: a null cursor stops paging (undefined in TanStack v5). */
export function nextDeviceCursor(page: DevicePage): string | undefined {
  return page.nextCursor ?? undefined;
}

/**
 * The server's order across pages, never re-sorted. A keyset walk is not a
 * snapshot: a device whose rank changes mid-walk (a revoke, a shift opening or
 * closing) can come back on a later page. It is shown once, where it first
 * appeared, so the table never holds two rows (or two React keys) for one device.
 */
export function flattenDevicePages(pages: readonly DevicePage[]): DevicePage["items"] {
  const seen = new Set<string>();
  return pages
    .flatMap((page) => page.items)
    .filter((device) => {
      if (seen.has(device.deviceId)) return false;
      seen.add(device.deviceId);
      return true;
    });
}

// --- Trust state ---------------------------------------------------------------

export type TrustTone = "neutral" | "danger" | "muted";

const TRUST_KEYS: Record<TrustState, MessageKey> = {
  active: "devices.trust.active",
  revoked: "devices.trust.revoked",
  retired: "devices.trust.retired",
};

/**
 * Active is neutral on purpose: a credential that still authenticates is not a
 * proven-healthy device, so it never takes the success colour.
 */
const TRUST_TONES: Record<TrustState, TrustTone> = {
  active: "neutral",
  revoked: "danger",
  retired: "muted",
};

export function trustStateView({ trustState }: { trustState: string }): {
  key: MessageKey;
  tone: TrustTone;
} {
  return Object.hasOwn(TRUST_KEYS, trustState)
    ? { key: TRUST_KEYS[trustState as TrustState], tone: TRUST_TONES[trustState as TrustState] }
    : { key: "devices.trust.unknown", tone: "danger" };
}

// --- Revoke reason -------------------------------------------------------------

const REASON_KEYS: Record<RevokeReason, MessageKey> = {
  lost: "devices.reason.lost",
  stolen: "devices.reason.stolen",
  suspected_compromise: "devices.reason.suspected_compromise",
  hardware_failure: "devices.reason.hardware_failure",
  replaced: "devices.reason.replaced",
  moved: "devices.reason.moved",
  retired: "devices.reason.retired",
  admin_error: "devices.reason.admin_error",
  other: "devices.reason.other",
};

/** A null reason is a revoke recorded before RT-365: "not recorded", never guessed. */
export function revokeReasonKey({ revokeReason }: { revokeReason: string | null }): MessageKey {
  if (revokeReason === null) return "devices.reason.notRecorded";
  return Object.hasOwn(REASON_KEYS, revokeReason)
    ? REASON_KEYS[revokeReason as RevokeReason]
    : "devices.reason.unknown";
}

// --- Last seen -----------------------------------------------------------------

const SOURCE_KEYS: Record<string, MessageKey> = {
  activity: "devices.lastSeen.source.activity",
};

export type LastSeenView =
  | { kind: "unknown"; key: MessageKey }
  | { kind: "seen"; at: string; sourceKey: MessageKey; sourceKnown: boolean };

/**
 * Last seen with its source. No value is Unknown (it is not recorded until
 * RT-370). A value whose source the console does not know (a later
 * `heartbeat`, or a missing source) keeps the time but labels the source as
 * unknown. Either way, this is never a health verdict.
 */
export function lastSeenView({
  lastSeenAt,
  lastSeenSource,
}: {
  lastSeenAt: string | null;
  lastSeenSource: string | null;
}): LastSeenView {
  if (lastSeenAt === null) return { kind: "unknown", key: "devices.lastSeen.unknown" };
  const known = lastSeenSource !== null && Object.hasOwn(SOURCE_KEYS, lastSeenSource);
  return {
    kind: "seen",
    at: lastSeenAt,
    sourceKey: known ? SOURCE_KEYS[lastSeenSource] : "devices.lastSeen.source.unknown",
    sourceKnown: known,
  };
}

// --- Expiry --------------------------------------------------------------------

/**
 * The credential's expiry is reported but not enforced until RT-370, so a
 * device past it is still active. Only "passed" is derived; there is no
 * "expiring soon" threshold (the server order already puts the soonest first).
 */
export function isPastExpiry(expiresAt: string, now: number): boolean {
  const at = Date.parse(expiresAt);
  return Number.isFinite(at) && at <= now;
}

// --- Navigation ------------------------------------------------------------------

/**
 * The list's filters, as the list put them in the navigation state for Back.
 * Anything that is not a search string is ignored (a hand-made state, a reload).
 */
export function listSearchFrom(state: unknown): string {
  const list = (state as { list?: unknown } | null)?.list;
  if (typeof list !== "string") return "";
  return list.startsWith("?") ? list : "";
}

// --- Errors --------------------------------------------------------------------

export function requestIdOf(error: unknown): string | undefined {
  return (error as { error?: { request_id?: string } } | undefined)?.error?.request_id;
}
