/**
 * RT-178 pure presentation helpers for the ERPNext stock discrepancy view. No
 * React, no fetch. The view never recomputes "negative" or "stale": it renders
 * the API's `snapshot.status`, `negativeItemCount` and `quantity` as received
 * (RT-178 non-goal: no business logic beyond presentation).
 */
import type { SnapshotStatusCode, StockSnapshotStatus } from "@/lib/stock-discrepancy-queries";

/** Roles the API lets read the negative on-hand surface (RT-177 `@Roles`). */
export const READ_ROLES = ["owner", "tenant_admin", "store_manager"] as const;
/** Roles the API lets trigger a stock run (the refresh action). */
export const REFRESH_ROLES = ["owner", "tenant_admin"] as const;

/** Navigation gate: mirrors the API's read roles. Not an authorization decision. */
export function canReadStockDiscrepancies(role: string | null | undefined): boolean {
  return (READ_ROLES as readonly string[]).includes(role ?? "");
}

/** Refresh-button gate: mirrors the API's `triggerReconciliationRun` roles. */
export function canRequestSnapshot(role: string | null | undefined): boolean {
  return (REFRESH_ROLES as readonly string[]).includes(role ?? "");
}

export interface SnapshotStatusLabel {
  label: string;
  badgeClass: string;
}

/** Banner a no-snapshot state shows on the store page (AC2). */
export interface SnapshotStateNotice {
  variant: "info";
  message: string;
}

/**
 * Everything the UI derives from one API snapshot status, as one lookup. No
 * label says "live" or "current" (AC7); both no-snapshot states say
 * "No ERPNext snapshot" and are never "no discrepancies" (AC2).
 */
export interface SnapshotStatusView extends SnapshotStatusLabel {
  hasSnapshot: boolean;
  /** Summary-list "As of" text when no snapshot exists. */
  noSnapshotReason: string;
  /** Store-page banner for a no-snapshot state; null when a snapshot exists. */
  notice: SnapshotStateNotice | null;
  /** Whether a refresh can produce a snapshot (needs a warehouse mapping). */
  canRefresh: boolean;
}

const NOT_SAME_AS_CLEAN = "This is not the same as having no discrepancies.";

const STATUS_VIEW: Record<SnapshotStatusCode, SnapshotStatusView> = {
  fresh: {
    label: "Fresh snapshot",
    badgeClass: "badge badge--active",
    hasSnapshot: true,
    noSnapshotReason: "",
    notice: null,
    canRefresh: true,
  },
  stale: {
    label: "Stale snapshot",
    badgeClass: "badge badge--suspended",
    hasSnapshot: true,
    noSnapshotReason: "",
    notice: null,
    canRefresh: true,
  },
  no_snapshot: {
    label: "No ERPNext snapshot",
    badgeClass: "badge badge--pending",
    hasSnapshot: false,
    noSnapshotReason: "Not recorded yet",
    notice: {
      variant: "info",
      message: `No ERPNext snapshot has been recorded for this store yet, so its ERPNext stock is unknown. ${NOT_SAME_AS_CLEAN}`,
    },
    canRefresh: true,
  },
  no_warehouse_mapping: {
    label: "No ERPNext snapshot",
    badgeClass: "badge",
    hasSnapshot: false,
    noSnapshotReason: "No warehouse mapping",
    notice: {
      variant: "info",
      message: `No ERPNext snapshot: this store has no ERPNext stock warehouse mapping, so its ERPNext stock is unknown. ${NOT_SAME_AS_CLEAN}`,
    },
    canRefresh: false,
  },
};

/** The full view for one API snapshot status. */
export function statusView(status: SnapshotStatusCode): SnapshotStatusView {
  return STATUS_VIEW[status];
}

/** True when the API says a snapshot exists (so the "as of" time is shown). */
export function hasSnapshot(status: SnapshotStatusCode): boolean {
  return STATUS_VIEW[status].hasSnapshot;
}

/** Badge label per API snapshot status. Never "live" or "current". */
export function snapshotStatusLabel(status: SnapshotStatusCode): SnapshotStatusLabel {
  const { label, badgeClass } = STATUS_VIEW[status];
  return { label, badgeClass };
}

/** Why a store has no snapshot, for the summary list's "As of" cell. */
export function noSnapshotReason(status: SnapshotStatusCode): string {
  return STATUS_VIEW[status].noSnapshotReason;
}

/**
 * The summary-list count cell. `negativeItemCount` is `0` for
 * `no_warehouse_mapping` / `no_snapshot`, which the contract defines as
 * UNKNOWN — never "no issues" (AC2).
 */
export function negativeCountLabel(status: SnapshotStatusCode, count: number): string {
  return STATUS_VIEW[status].hasSnapshot ? String(count) : "Unknown";
}

/** The "as of" time to show, or null when the API reports no snapshot. */
export function asOfTime(snapshot: StockSnapshotStatus): string | null {
  return STATUS_VIEW[snapshot.status].hasSnapshot ? snapshot.readAt : null;
}

/** Human duration for `staleAfterSeconds` (v1 = 86400 → "24 hours"). */
export function formatStaleAfter(seconds: number): string {
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  return `${seconds} seconds`;
}

/**
 * Three Connector ticks (the Connector pulls bin-view requests every 5 min).
 * After this, a pending request reads "requested but not yet reported" and
 * names the likely causes (RT-51 D4).
 */
export const PENDING_OVERDUE_MS = 15 * 60 * 1000;

export function isPendingOverdue(
  pending: StockSnapshotStatus["pendingRequest"],
  nowMs: number,
): boolean {
  if (!pending) return false;
  const requestedMs = Date.parse(pending.requestedAt);
  if (Number.isNaN(requestedMs)) return false;
  return nowMs - requestedMs >= PENDING_OVERDUE_MS;
}

// --- Refresh (triggerReconciliationRun) ----------------------------------------

/**
 * Idempotency-Key for one refresh click: a v4 UUID (36 printable ASCII
 * characters, inside the contract's `^[\x21-\x7E]{16,128}$`).
 */
export function newSnapshotRequestKey(): string {
  return crypto.randomUUID();
}

interface BackendError {
  error?: { code?: string; message?: string; request_id?: string };
}

export interface TriggerResult {
  status: number;
  error?: unknown;
}

export type TriggerOutcome =
  | { kind: "requested" }
  | { kind: "not-found"; requestId?: string }
  | { kind: "key-conflict"; requestId?: string }
  | { kind: "error"; requestId?: string };

/**
 * 201 (created) and 200 (idempotent replay) both mean a run is requested. A 404
 * is the API's non-disclosing refusal. A 409 is an `idempotency_key_conflict`;
 * the next click generates a new key.
 */
export function classifyTriggerOutcome(result: TriggerResult): TriggerOutcome {
  const requestId = (result.error as BackendError | undefined)?.error?.request_id;
  if (result.status === 200 || result.status === 201) return { kind: "requested" };
  if (result.status === 404) return { kind: "not-found", requestId };
  if (result.status === 409) return { kind: "key-conflict", requestId };
  return { kind: "error", requestId };
}

/** Banner for a refresh outcome; `requested` shows none (the pending note does). */
export interface OutcomeBannerView {
  variant: "danger" | "warning";
  message: string;
}

const OUTCOME_BANNER: Record<TriggerOutcome["kind"], OutcomeBannerView | null> = {
  requested: null,
  "not-found": {
    variant: "danger",
    message: "Not found. A snapshot cannot be requested for this store.",
  },
  "key-conflict": {
    variant: "warning",
    message: "That snapshot request conflicted with an earlier one. Try again.",
  },
  error: { variant: "danger", message: "The snapshot request could not be sent. Try again." },
};

export function outcomeBannerView(outcome: TriggerOutcome): OutcomeBannerView | null {
  return OUTCOME_BANNER[outcome.kind];
}

/** Request id from a backend error envelope, for banners. */
export function requestIdOf(error: unknown): string | undefined {
  return (error as BackendError | undefined)?.error?.request_id;
}
