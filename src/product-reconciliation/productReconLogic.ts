/**
 * RT-727 pure helpers for ERPNext product-master reconciliation (Backend-Core
 * spec 021). No React, no fetch.
 *
 * Truth rules: every server value is mapped to a catalog key or shown as
 * received. A value this build does not know (a new class, status, outcome)
 * reads "Unknown": it is never folded into a known one. Counts and detail
 * values are shown as the server sent them; nothing is computed or invented.
 *
 * Repair scope: `suggest_confirm` for a product with no mapping at all
 * (`unmapped_dp2_product`), with the ERPNext item reference the operator types.
 * Since RT-733 the reads carry the 013 mapping id and `version`, so a
 * `suggestion_unconfirmed` row is `confirm`ed and an open `attribute_drift`
 * result is `re_point`ed against exactly the id and version the server sent.
 * A row without both facts is never sent with a guessed version: it points to
 * the item mappings screen instead.
 *
 * RT-399: helpers return catalog message keys, never copy.
 */
import type { StatusView } from "@/erp-status/erpStatusLogic";
import type { MessageKey } from "@/i18n";
import type {
  BacklogClass,
  BacklogItem,
  MismatchClass,
  ProductReconciliationResult,
  ProductReconciliationRun,
  RecordedProductRepair,
  RepairProductMappingRequest,
} from "@/lib/product-reconciliation-queries";

/** Roles the API lets use this surface (`@Roles("owner", "tenant_admin")` on all five). */
export const RECON_ROLES = ["owner", "tenant_admin"] as const;

/** Navigation and page gate: mirrors the API's roles. Not an authorization decision. */
export function canUseProductReconciliation(role: string | null | undefined): boolean {
  return (RECON_ROLES as readonly string[]).includes(role ?? "");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The `:runId` route segment: a UUID, or the request would be a contract 400. */
export function isRunId(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

function lookup<K extends string, V>(table: Record<K, V>, value: string, fallback: V): V {
  return Object.hasOwn(table, value) ? table[value as K] : fallback;
}

// --- Mismatch classes ------------------------------------------------------------

export const RESULT_CLASSES: readonly MismatchClass[] = [
  "match",
  "unmapped_dp2_product",
  "suggestion_unconfirmed",
  "unmapped_erpnext_item",
  "attribute_drift",
  "sellable_state_divergence",
];

export const BACKLOG_CLASSES: readonly BacklogClass[] = [
  "unmapped_dp2_product",
  "suggestion_unconfirmed",
];

const CLASS_VIEWS: Record<MismatchClass, StatusView> = {
  match: { labelKey: "productRecon.class.match", tone: "success", hollow: false },
  unmapped_dp2_product: {
    labelKey: "productRecon.class.unmapped_dp2_product",
    tone: "warning",
    hollow: false,
  },
  suggestion_unconfirmed: {
    labelKey: "productRecon.class.suggestion_unconfirmed",
    tone: "info",
    hollow: true,
  },
  unmapped_erpnext_item: {
    labelKey: "productRecon.class.unmapped_erpnext_item",
    tone: "warning",
    hollow: false,
  },
  attribute_drift: {
    labelKey: "productRecon.class.attribute_drift",
    tone: "warning",
    hollow: false,
  },
  sellable_state_divergence: {
    labelKey: "productRecon.class.sellable_state_divergence",
    tone: "danger",
    hollow: false,
  },
};

const UNKNOWN: StatusView = { labelKey: "productRecon.unknown", tone: "neutral", hollow: true };

export function classView(value: string): StatusView {
  return lookup(CLASS_VIEWS, value, UNKNOWN);
}

/** The `?class=` filter: a class the list accepts, or "" (all). Anything else is ignored. */
export function classFilter<C extends string>(value: string | null, allowed: readonly C[]): C | "" {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as C) : "";
}

// --- Runs ----------------------------------------------------------------------------

const RUN_STATUS_VIEWS: Record<ProductReconciliationRun["status"], StatusView> = {
  running: { labelKey: "productRecon.runs.status.running", tone: "info", hollow: true },
  completed: { labelKey: "productRecon.runs.status.completed", tone: "success", hollow: false },
  failed: { labelKey: "productRecon.runs.status.failed", tone: "danger", hollow: false },
};

export function runStatusView(status: string): StatusView {
  return lookup(RUN_STATUS_VIEWS, status, UNKNOWN);
}

/** The connector-view availability: reported, never a run failure (FR-007). */
const VIEW_STATUS_VIEWS: Record<ProductReconciliationRun["erpnextViewStatus"], StatusView> = {
  available: { labelKey: "productRecon.runs.view.available", tone: "success", hollow: false },
  partial: { labelKey: "productRecon.runs.view.partial", tone: "warning", hollow: false },
  unavailable: { labelKey: "productRecon.runs.view.unavailable", tone: "neutral", hollow: true },
};

export function viewStatusView(status: string): StatusView {
  return lookup(VIEW_STATUS_VIEWS, status, UNKNOWN);
}

const TRIGGER_KEYS: Record<ProductReconciliationRun["trigger"], MessageKey> = {
  on_demand: "productRecon.runs.trigger.on_demand",
  scheduled: "productRecon.runs.trigger.scheduled",
};

export function runTriggerKey(trigger: string): MessageKey {
  return lookup(TRIGGER_KEYS, trigger, "productRecon.unknown");
}

/** A value as received, as display text: strings verbatim, anything else as JSON. */
export function asReceived(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** The run summary's per-class counts as received, ordered by key for a stable read. */
export function summaryEntries(
  summary: Record<string, unknown> | null | undefined,
): [string, string][] {
  return Object.entries(summary ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => [key, asReceived(value)]);
}

/** A result's detail as received, ordered by key. */
export function detailEntries(
  detail: Record<string, unknown> | null | undefined,
): [string, string][] {
  return summaryEntries(detail);
}

// --- Results ---------------------------------------------------------------------------

const RESULT_STATE_VIEWS: Record<ProductReconciliationResult["resultState"], StatusView> = {
  open: { labelKey: "productRecon.results.state.open", tone: "warning", hollow: false },
  repaired: { labelKey: "productRecon.results.state.repaired", tone: "success", hollow: false },
  accepted: { labelKey: "productRecon.results.state.accepted", tone: "neutral", hollow: false },
};

export function resultStateView(state: string): StatusView {
  return lookup(RESULT_STATE_VIEWS, state, UNKNOWN);
}

// --- Repair ------------------------------------------------------------------------------

export type RepairKind = RepairProductMappingRequest["repairKind"];

/** The 013 row a `confirm` / `re_point` acts on, at the version the server last sent. */
export interface MappingRef {
  mappingId: string;
  version: number;
}

/** What a repair addresses: a backlog product, or an open result of a run. */
export interface RepairTarget {
  repairKind: RepairKind;
  tenantProductId: string;
  /** Required for `confirm` / `re_point`; never set for `suggest_confirm`. */
  mapping?: MappingRef;
  /** The mapping's ERPNext item reference as received, shown on the confirm step. */
  erpnextItemRef?: string | null;
  /** Set together for a run-result repair, so the result moves open → repaired. */
  runId?: string;
  resultId?: string;
}

/** Why a row cannot be repaired here. */
export type RepairBlock = "needs-version" | "not-open" | "not-repairable";

/** A row's repair: the target to open, or why there is none. */
export type RepairPlan = RepairTarget | RepairBlock;

/** Both facts as the server sent them, or null: a version is never guessed. */
export function mappingRefOf(
  mappingId: string | null | undefined,
  version: number | null | undefined,
): MappingRef | null {
  if (!mappingId || !UUID_PATTERN.test(mappingId)) return null;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return null;
  return { mappingId, version };
}

export function backlogRepair(item: BacklogItem): RepairPlan {
  const tenantProductId = item.tenantProductId;
  if (item.mismatchClass === "unmapped_dp2_product") {
    return { repairKind: "suggest_confirm", tenantProductId };
  }
  if (item.mismatchClass === "suggestion_unconfirmed") {
    const mapping = mappingRefOf(item.suggestionMappingId, item.suggestionMappingVersion);
    if (!mapping) return "needs-version";
    return { repairKind: "confirm", tenantProductId, mapping, erpnextItemRef: item.erpnextItemRef };
  }
  return "not-repairable";
}

export function resultRepair(result: ProductReconciliationResult): RepairPlan {
  if (result.resultState !== "open") return "not-open";
  const tenantProductId = result.tenantProductId;
  if (!tenantProductId) return "not-repairable";
  const ids = { runId: result.runId, resultId: result.id };
  if (result.mismatchClass === "unmapped_dp2_product") {
    return { repairKind: "suggest_confirm", tenantProductId, ...ids };
  }
  const mapping = mappingRefOf(result.mappingId, result.mappingVersion);
  const erpnextItemRef = result.erpnextItemRef;
  if (result.mismatchClass === "suggestion_unconfirmed") {
    if (!mapping) return "needs-version";
    return { repairKind: "confirm", tenantProductId, mapping, erpnextItemRef, ...ids };
  }
  if (result.mismatchClass === "attribute_drift" && mapping) {
    return { repairKind: "re_point", tenantProductId, mapping, erpnextItemRef, ...ids };
  }
  return "not-repairable";
}

/** The contract bound on `erpnextItemRef` (1..180 characters). */
export const ITEM_REF_MAX = 180;

/** The typed ERPNext item reference, trimmed, or null when it is empty or too long. */
export function itemRefOf(input: string): string | null {
  const ref = input.trim();
  return ref.length >= 1 && ref.length <= ITEM_REF_MAX ? ref : null;
}

/** The strict request: `tenant_id` and the actor are server-resolved and never sent. */
export function suggestConfirmRequest(
  target: RepairTarget,
  erpnextItemRef: string,
): RepairProductMappingRequest {
  return {
    repairKind: "suggest_confirm",
    tenantProductId: target.tenantProductId,
    erpnextItemRef,
    ...resultIdsOf(target),
  };
}

function resultIdsOf(target: RepairTarget): { runId?: string; resultId?: string } {
  return target.runId && target.resultId ? { runId: target.runId, resultId: target.resultId } : {};
}

/** A `confirm` / `re_point` with the id and version as received; null without both. */
export function mappingRepairRequest(target: RepairTarget): RepairProductMappingRequest | null {
  if (target.repairKind === "suggest_confirm" || !target.mapping) return null;
  return {
    repairKind: target.repairKind,
    tenantProductId: target.tenantProductId,
    mappingId: target.mapping.mappingId,
    version: target.mapping.version,
    ...resultIdsOf(target),
  };
}

/** One Idempotency-Key per confirmed action: a v4 UUID. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

// --- Errors and outcomes ------------------------------------------------------------------

interface ErrorEnvelope {
  error?: { code?: string; message?: string; request_id?: string };
}

export function requestIdOf(error: unknown): string | undefined {
  return (error as ErrorEnvelope | undefined)?.error?.request_id;
}

/** A failed read. A 404 is the API's non-disclosing refusal (role, or a run out of scope). */
export interface ReadError {
  kind: "session" | "forbidden" | "not-found" | "rejected" | "rate-limited" | "generic";
  requestId?: string;
  retryAfterSeconds?: number;
}

const READ_STATUS_KINDS: Record<number, ReadError["kind"]> = {
  400: "rejected",
  401: "session",
  403: "forbidden",
  404: "not-found",
  429: "rate-limited",
};

export interface ApiResult<P> {
  status: number;
  data?: P;
  error?: unknown;
  retryAfterSeconds?: number;
}

export function readErrorOf(result: ApiResult<unknown>): ReadError {
  return {
    kind: READ_STATUS_KINDS[result.status] ?? "generic",
    requestId: requestIdOf(result.error),
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

/** The server's refusal of a mutation, by status. Never retried by the console. */
export type Refusal =
  | "rejected" // 400 validation_error
  | "session" // 401
  | "origin" // 403 origin_rejected
  | "not-found" // 404 not_found (repair only)
  | "conflict" // 409 conflict (stale version or idempotency-key conflict)
  | "rate-limited" // 429 rate_limited
  | "error"; // 5xx system_failure, or anything else

const REFUSALS: Record<number, Refusal> = {
  400: "rejected",
  401: "session",
  403: "origin",
  404: "not-found",
  409: "conflict",
  429: "rate-limited",
};

export interface RefusedOutcome {
  kind: "refused";
  refusal: Refusal;
  requestId?: string;
  retryAfterSeconds?: number;
}

function refusedOf(result: ApiResult<unknown>): RefusedOutcome {
  return {
    kind: "refused",
    refusal: REFUSALS[result.status] ?? "error",
    requestId: requestIdOf(result.error),
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

/** 201, or an idempotent replay's 200: the body the server returned. */
const ACCEPTED = new Set([200, 201]);

function acceptedBody<P>(result: ApiResult<P>): P | undefined {
  return ACCEPTED.has(result.status) ? result.data : undefined;
}

export type TriggerOutcome = { kind: "started"; run: ProductReconciliationRun } | RefusedOutcome;

/** 201 (or an idempotent replay's 200) with the run is started; anything else is refused. */
export function classifyTrigger(result: ApiResult<ProductReconciliationRun>): TriggerOutcome {
  const run = acceptedBody(result);
  return run ? { kind: "started", run } : refusedOf(result);
}

export type RepairOutcome = { kind: "recorded"; repair: RecordedProductRepair } | RefusedOutcome;

/** 201 recorded, or 200 for a replay / `no_op_echo`; anything else is refused. */
export function classifyRepair(result: ApiResult<RecordedProductRepair>): RepairOutcome {
  const repair = acceptedBody(result);
  return repair ? { kind: "recorded", repair } : refusedOf(result);
}

export interface OutcomeView {
  variant: "success" | "warning" | "danger" | "info";
  messageKey: MessageKey;
}

const REPAIR_OUTCOME_VIEWS: Record<RecordedProductRepair["outcome"], OutcomeView> = {
  mapped: { variant: "success", messageKey: "productRecon.repair.outcome.mapped" },
  no_op_echo: { variant: "info", messageKey: "productRecon.repair.outcome.no_op_echo" },
  still_unmapped: { variant: "warning", messageKey: "productRecon.repair.outcome.still_unmapped" },
  conflict: { variant: "warning", messageKey: "productRecon.repair.outcome.conflict" },
};

const UNKNOWN_OUTCOME: OutcomeView = {
  variant: "warning",
  messageKey: "productRecon.repair.outcome.unknown",
};

/**
 * The recorded repair outcome as the server reported it; an unknown one stays
 * unknown. A `no_op_echo` of a `confirm` / `re_point` (FR-011) is about the
 * mapping the operator acted on, so it says that mapping was already confirmed.
 */
export function repairOutcomeView(outcome: string, repairKind?: RepairKind): OutcomeView {
  if (outcome === "no_op_echo" && (repairKind === "confirm" || repairKind === "re_point")) {
    return { variant: "info", messageKey: "productRecon.repair.outcome.no_op_echo_mapping" };
  }
  return lookup(REPAIR_OUTCOME_VIEWS, outcome, UNKNOWN_OUTCOME);
}

const REFUSAL_VIEWS: Record<Refusal, OutcomeView> = {
  rejected: { variant: "warning", messageKey: "productRecon.refusal.rejected" },
  session: { variant: "danger", messageKey: "productRecon.refusal.session" },
  origin: { variant: "danger", messageKey: "productRecon.refusal.origin" },
  "not-found": { variant: "warning", messageKey: "productRecon.refusal.notFound" },
  conflict: { variant: "warning", messageKey: "productRecon.refusal.conflict" },
  "rate-limited": { variant: "warning", messageKey: "productRecon.refusal.rateLimited" },
  error: { variant: "danger", messageKey: "productRecon.refusal.error" },
};

export function refusalView(refusal: Refusal): OutcomeView {
  return REFUSAL_VIEWS[refusal];
}
