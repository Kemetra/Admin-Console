/**
 * RT-726 pure helpers for the sale sync-ops surfaces. No React, no fetch.
 *
 * Truth rules (RT-642 semantic traps): the sync status is Backend-Core's
 * acceptance of the sale, not its ERPNext posting. `synced` is never "posted",
 * an unknown code is never "not posted", and no open dead letter is never
 * "posted". The helpers return catalog keys; copy never infers ERP state.
 *
 * RT-399: helpers return catalog message keys, never copy.
 */
import type { MessageKey } from "@/i18n";
import type { SaleSyncStatus } from "@/lib/sale-sync-ops-queries";

/** Roles the API lets use every sale sync-ops route (`@Roles("owner", "tenant_admin")`). */
export const SYNC_OPS_ROLES = ["owner", "tenant_admin"] as const;

/** Navigation and section gate: mirrors the API's roles. Not an authorization decision. */
export function canUseSaleSyncOps(role: string | null | undefined): boolean {
  return (SYNC_OPS_ROLES as readonly string[]).includes(role ?? "");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The `?store=` filter: "" (all stores) or a UUID. Anything else is never sent. */
export function isStoreFilter(value: string): boolean {
  return value === "" || UUID_PATTERN.test(value);
}

function keyOf(map: Record<string, MessageKey>, code: string, fallback: MessageKey): MessageKey {
  return Object.hasOwn(map, code) ? map[code] : fallback;
}

// --- Sync status -------------------------------------------------------------

export interface SyncStatusView {
  labelKey: MessageKey;
  /** The sentence under the status that says what it does and does not mean. */
  meaningKey: MessageKey;
  /** Badge modifier: the label always carries the meaning, the colour only reinforces it. */
  badge: "" | "badge--pending" | "badge--suspended";
}

const SYNC_VIEWS: Record<string, SyncStatusView> = {
  captured: {
    labelKey: "saleSync.status.captured",
    meaningKey: "saleSync.meaning.captured",
    badge: "badge--pending",
  },
  synced: {
    labelKey: "saleSync.status.synced",
    meaningKey: "saleSync.meaning.synced",
    badge: "",
  },
  "failed-retryable": {
    labelKey: "saleSync.status.failedRetryable",
    meaningKey: "saleSync.meaning.failedRetryable",
    badge: "badge--pending",
  },
  "failed-needs-repair": {
    labelKey: "saleSync.status.failedNeedsRepair",
    meaningKey: "saleSync.meaning.failedNeedsRepair",
    badge: "badge--suspended",
  },
};

/** An unrecognised code is unknown (red), never a guess at either side. */
const UNKNOWN_SYNC: SyncStatusView = {
  labelKey: "saleSync.status.unknown",
  meaningKey: "saleSync.meaning.unknown",
  badge: "badge--suspended",
};

export function syncStatusView(code: string): SyncStatusView {
  return Object.hasOwn(SYNC_VIEWS, code) ? SYNC_VIEWS[code] : UNKNOWN_SYNC;
}

/**
 * Repair is offered only for a sale the server classifies NEEDS_REPAIR with an
 * open dead letter. The server still decides: anything else is its 409.
 */
export function isRepairable(status: SaleSyncStatus): boolean {
  const dead = status.deadLetter;
  return (
    status.syncStatus === "failed-needs-repair" &&
    dead !== null &&
    dead !== undefined &&
    !dead.resolvedAt
  );
}

const CLASSIFICATION_KEYS: Record<string, MessageKey> = {
  retryable: "saleSync.deadLetter.retryable",
  "needs-repair": "saleSync.deadLetter.needsRepair",
};

export function classificationKey(code: string): MessageKey {
  return keyOf(CLASSIFICATION_KEYS, code, "saleSync.deadLetter.unknown");
}

// --- Audit timeline ------------------------------------------------------------

/** The labels Backend-Core emits today, plus the contract's documented examples. */
const EVENT_KEYS: Record<string, MessageKey> = {
  "sale.captured": "saleSync.event.saleCaptured",
  "sync.synced": "saleSync.event.syncSynced",
  "sync.retryable": "saleSync.event.syncRetryable",
  "sync.needs_repair": "saleSync.event.syncNeedsRepair",
  "sync.failed": "saleSync.event.syncFailed",
  "repair.requested": "saleSync.event.repairRequested",
  "repair.resolved": "saleSync.event.repairResolved",
};

export function eventKey(event: string): MessageKey {
  return keyOf(EVENT_KEYS, event, "saleSync.event.unknown");
}

export function isKnownEvent(event: string): boolean {
  return Object.hasOwn(EVENT_KEYS, event);
}

// --- Keyset paging -------------------------------------------------------------

/** getNextPageParam: only a null cursor ends the walk. */
export function nextRepairCursor(page: { nextCursor: string | null }): string | undefined {
  return page.nextCursor ?? undefined;
}

// --- Errors ----------------------------------------------------------------------

interface ErrorEnvelope {
  error?: { code?: string; request_id?: string };
}

export function requestIdOf(error: unknown): string | undefined {
  return (error as ErrorEnvelope | undefined)?.error?.request_id;
}

export function errorCodeOf(error: unknown): string | undefined {
  return (error as ErrorEnvelope | undefined)?.error?.code;
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

// --- Repair outcome --------------------------------------------------------------

export interface RepairResult {
  status: number;
  data?: SaleSyncStatus;
  error?: unknown;
  retryAfter?: number;
}

export type RepairOutcome =
  | { kind: "repaired"; status: SaleSyncStatus }
  | {
      kind:
        | "conflict"
        | "key-conflict"
        | "not-found"
        | "forbidden"
        | "session"
        | "rejected"
        | "rate-limited"
        | "unconfirmed";
      messageKey: MessageKey;
      requestId?: string;
      retryAfter?: number;
    };

type Refusal = Exclude<RepairOutcome, { kind: "repaired" }>;
type RefusalView = Pick<Refusal, "kind" | "messageKey">;

/** Refusals by status, or by `status:code` where the code changes the meaning. */
const REFUSALS: Record<string, RefusalView> = {
  "400": { kind: "rejected", messageKey: "saleSync.repair.error.rejected" },
  "401": { kind: "session", messageKey: "saleSync.error.session" },
  "403": { kind: "forbidden", messageKey: "saleSync.repair.error.forbidden" },
  "403:origin_rejected": { kind: "forbidden", messageKey: "saleSync.repair.error.originRejected" },
  "404": { kind: "not-found", messageKey: "saleSync.repair.error.notFound" },
  "409": { kind: "conflict", messageKey: "saleSync.repair.error.conflict" },
  "409:idempotency_key_conflict": {
    kind: "key-conflict",
    messageKey: "saleSync.repair.error.keyConflict",
  },
};

/** Anything unlisted (a 5xx, no response) may have been applied: never "failed". */
const UNCONFIRMED: RefusalView = {
  kind: "unconfirmed",
  messageKey: "saleSync.repair.error.unconfirmed",
};

function refusalOf(status: number, code: string | undefined): RefusalView {
  return REFUSALS[`${status}:${code}`] ?? REFUSALS[String(status)] ?? UNCONFIRMED;
}

/**
 * Maps the server's answer to what the operator sees. Only a 200 is a repair;
 * a 5xx or a lost response is "unconfirmed" (the server may have acted), never
 * "failed". Nothing here retries.
 */
export function classifyRepair(result: RepairResult): RepairOutcome {
  if (result.status === 200 && result.data) return { kind: "repaired", status: result.data };
  const requestId = requestIdOf(result.error);
  if (result.status === 429) {
    const { retryAfter } = result;
    return {
      kind: "rate-limited",
      messageKey: retryAfter
        ? "saleSync.repair.error.rateLimitedFor"
        : "saleSync.repair.error.rateLimited",
      requestId,
      retryAfter,
    };
  }
  return { ...refusalOf(result.status, errorCodeOf(result.error)), requestId };
}

/**
 * Whether the next confirmation may send the same Idempotency-Key. After an
 * unconfirmed or rate-limited attempt the same key replays the server's
 * stored outcome instead of asking twice; any answered outcome ends the key.
 */
export function keepsKey(outcome: RepairOutcome): boolean {
  return outcome.kind === "unconfirmed" || outcome.kind === "rate-limited";
}

/** A v4 UUID: satisfies the Idempotency-Key format. No new dependency. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
