/**
 * RT-560 pure helpers for the ERP connection & sync status surface (spec 016
 * Phase A). No React, no fetch.
 *
 * Truth rules: liveness is C2's read-derived verdict and nothing else. A missing
 * C2 row, a failed C2 read or an unknown verdict is "no signal": never healthy,
 * never an error (A-1, A-2). C1 `disabled_at` is shown as its own lifecycle
 * fact; it does not replace the verdict. Each C3 domain keeps its own status:
 * there is no collapsed "ERP OK" (A-4). Server values are mapped to catalog keys
 * or shown as received; no reason text is invented (A-5).
 *
 * RT-399: helpers return catalog message keys, never copy.
 */
import type { MessageKey } from "@/i18n";
import type {
  ConnectorHealthList,
  ConnectorHealthView,
  ConnectorInstance,
  Liveness,
} from "@/lib/erp-status-queries";

/** Roles the API lets read this surface (owner / tenant_admin, spec 016 §2). */
export const READ_ROLES = ["owner", "tenant_admin"] as const;

/** Navigation and page gate: mirrors the API's roles. Not an authorization decision. */
export function canReadErpStatus(role: string | null | undefined): boolean {
  return (READ_ROLES as readonly string[]).includes(role ?? "");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The `?store=` filter: "" (all stores) or a UUID. Anything else would be a
 * contract 400, so it is never sent and renders as not-found, like an
 * out-of-scope store.
 */
export function isStoreFilter(value: string): boolean {
  return value === "" || UUID_PATTERN.test(value);
}

// --- Status pills ---------------------------------------------------------------

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

/** A status pill: its label, its semantic tone, and a hollow dot for "no signal" states. */
export interface StatusView {
  labelKey: MessageKey;
  tone: Tone;
  hollow: boolean;
}

function lookup<K extends string>(
  table: Record<K, StatusView>,
  value: string,
  fallback: StatusView,
): StatusView {
  return Object.hasOwn(table, value) ? table[value as K] : fallback;
}

function keyOf<K extends string>(
  table: Record<K, MessageKey>,
  value: string,
  fallback: MessageKey,
): MessageKey {
  return Object.hasOwn(table, value) ? table[value as K] : fallback;
}

// --- Connection liveness (C2) ---------------------------------------------------

export type Signal = "healthy" | "stale" | "no_signal" | "disabled";

const LIVENESS_SIGNALS: Record<Liveness, Signal> = {
  healthy: "healthy",
  stale: "stale",
  never_seen: "no_signal",
  disabled: "disabled",
};

/** C2's verdict as a signal. No row, or a verdict this build does not know, is no signal. */
export function livenessSignal(view: ConnectorHealthView | undefined): Signal {
  if (!view || !Object.hasOwn(LIVENESS_SIGNALS, view.liveness)) return "no_signal";
  return LIVENESS_SIGNALS[view.liveness];
}

const SIGNAL_VIEWS: Record<Signal, StatusView> = {
  healthy: { labelKey: "erp.signal.healthy", tone: "success", hollow: false },
  stale: { labelKey: "erp.signal.stale", tone: "warning", hollow: false },
  no_signal: { labelKey: "erp.signal.noSignal", tone: "neutral", hollow: true },
  disabled: { labelKey: "erp.signal.disabled", tone: "neutral", hollow: true },
};

export function signalView(signal: Signal): StatusView {
  return SIGNAL_VIEWS[signal];
}

export interface ConnectionRow {
  instance: ConnectorInstance;
  /** The C2 row for this registration, when the read succeeded and has one. */
  health?: ConnectorHealthView;
  signal: Signal;
}

/**
 * One row per C1 registration, joined with C2 by registration id. C2 rows with
 * no registration are dropped; `health` undefined (a failed C2 read) leaves
 * every row at no signal.
 */
export function joinConnections(
  instances: readonly ConnectorInstance[],
  health: ConnectorHealthList | undefined,
): ConnectionRow[] {
  const byId = new Map((health?.items ?? []).map((view) => [view.connectorId, view]));
  return instances.map((instance) => {
    const view = byId.get(instance.id);
    return { instance, health: view, signal: livenessSignal(view) };
  });
}

/** The connector's self-reported ERPNext reachability (A-3): never a Backend-Core probe. */
export function reachabilityKey(value: boolean | null | undefined): MessageKey {
  if (value === true) return "erp.reported.reachable";
  if (value === false) return "erp.reported.unreachable";
  return "erp.reported.notReported";
}

/** Seconds since last seen, floored to the largest whole unit for display. */
export function sinceSeconds(seconds: number | null | undefined): number | null {
  if (seconds === null || seconds === undefined) return null;
  if (seconds >= 3600) return Math.floor(seconds / 3600) * 3600;
  if (seconds >= 60) return Math.floor(seconds / 60) * 60;
  return seconds;
}

// --- Sync-ops summary (C3) --------------------------------------------------------

const DOMAIN_KEYS: Record<string, MessageKey> = {
  posting: "erp.domain.posting",
  reconciliation: "erp.domain.reconciliation",
  connector_health: "erp.domain.connector_health",
  product_master: "erp.domain.product_master",
};

export function domainKey(domain: string): MessageKey {
  return keyOf(DOMAIN_KEYS, domain, "erp.domain.unknown");
}

const UNKNOWN_DOMAIN_STATUS: StatusView = {
  labelKey: "erp.domainStatus.unknown",
  tone: "danger",
  hollow: true,
};

const DOMAIN_STATUS_VIEWS: Record<string, StatusView> = {
  ok: { labelKey: "erp.domainStatus.ok", tone: "success", hollow: false },
  attention: { labelKey: "erp.domainStatus.attention", tone: "warning", hollow: false },
  not_available: { labelKey: "erp.domainStatus.notAvailable", tone: "neutral", hollow: true },
};

export function domainStatusView(status: string): StatusView {
  return lookup(DOMAIN_STATUS_VIEWS, status, UNKNOWN_DOMAIN_STATUS);
}

// --- Posting backlog (C3) -----------------------------------------------------------

const POSTING_KIND_KEYS: Record<string, MessageKey> = {
  sale_post: "erp.backlog.kind.sale_post",
  reversal: "erp.backlog.kind.reversal",
};

export function postingKindKey(kind: string): MessageKey {
  return keyOf(POSTING_KIND_KEYS, kind, "erp.backlog.kind.unknown");
}

// --- Reconciliation runs (C3) ---------------------------------------------------------

const TRIGGER_KEYS: Record<string, MessageKey> = {
  on_demand: "erp.runs.trigger.on_demand",
  scheduled: "erp.runs.trigger.scheduled",
};

export function runTriggerKey(trigger: string): MessageKey {
  return keyOf(TRIGGER_KEYS, trigger, "erp.runs.trigger.unknown");
}

const RUN_STATUS_VIEWS: Record<string, StatusView> = {
  running: { labelKey: "erp.runs.status.running", tone: "info", hollow: true },
  completed: { labelKey: "erp.runs.status.completed", tone: "success", hollow: false },
  failed: { labelKey: "erp.runs.status.failed", tone: "danger", hollow: false },
};

export function runStatusView(status: string): StatusView {
  return lookup(RUN_STATUS_VIEWS, status, {
    labelKey: "erp.runs.status.unknown",
    tone: "danger",
    hollow: true,
  });
}

/** Per-class mismatch counts as received, ordered by class for a stable read. */
export function mismatchEntries(
  summary: Record<string, number> | null | undefined,
): [string, number][] {
  return Object.entries(summary ?? {}).sort(([a], [b]) => a.localeCompare(b));
}

// --- Cursor paging --------------------------------------------------------------------

export interface Page<T> {
  items: T[];
  nextCursor?: string | null;
}

/** getNextPageParam: a null cursor stops paging (undefined in TanStack v5). */
export function nextCursor(page: Page<unknown>): string | undefined {
  return page.nextCursor ?? undefined;
}

export function flattenPages<T>(pages: readonly Page<T>[]): T[] {
  return pages.flatMap((page) => page.items);
}

// --- Errors ------------------------------------------------------------------------------

export function requestIdOf(error: unknown): string | undefined {
  return (error as { error?: { request_id?: string } } | undefined)?.error?.request_id;
}
