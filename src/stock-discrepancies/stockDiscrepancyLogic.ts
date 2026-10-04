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

/** True when the API says a snapshot exists (so the "as of" time is shown). */
export function hasSnapshot(status: SnapshotStatusCode): boolean {
  return status === "fresh" || status === "stale";
}

export interface SnapshotStatusLabel {
  label: string;
  badgeClass: string;
}

/** Badge label per API snapshot status. Never "live" or "current". */
export function snapshotStatusLabel(status: SnapshotStatusCode): SnapshotStatusLabel {
  switch (status) {
    case "fresh":
      return { label: "Fresh snapshot", badgeClass: "badge badge--active" };
    case "stale":
      return { label: "Stale snapshot", badgeClass: "badge badge--suspended" };
    case "no_snapshot":
      return { label: "No ERPNext snapshot", badgeClass: "badge badge--pending" };
    case "no_warehouse_mapping":
      return { label: "No ERPNext snapshot", badgeClass: "badge" };
  }
}

/** Why a store has no snapshot, for the summary list's "As of" cell. */
export function noSnapshotReason(status: SnapshotStatusCode): string {
  return status === "no_warehouse_mapping" ? "No warehouse mapping" : "Not recorded yet";
}

/**
 * The summary-list count cell. `negativeItemCount` is `0` for
 * `no_warehouse_mapping` / `no_snapshot`, which the contract defines as
 * UNKNOWN — never "no issues" (AC2).
 */
export function negativeCountLabel(status: SnapshotStatusCode, count: number): string {
  if (!hasSnapshot(status)) return "Unknown";
  return String(count);
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

/** Request id from a backend error envelope, for banners. */
export function requestIdOf(error: unknown): string | undefined {
  return (error as BackendError | undefined)?.error?.request_id;
}
