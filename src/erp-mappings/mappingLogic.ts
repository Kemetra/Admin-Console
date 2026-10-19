/**
 * RT-725 pure helpers for the ERPNext item and warehouse mapping screens. No
 * React, no fetch; helpers return catalog message keys, never copy (RT-399).
 *
 * Truth rules: a lifecycle value this build does not know reads "unknown", and
 * offers no action. A mutation that got no answer, or a 5xx, may or may not have
 * been applied: it reads as an unknown outcome, never as a failure or a success,
 * and it is never retried for the operator.
 */
import type { MessageKey } from "@/i18n";
import type {
  ErpnextItemMapping,
  ErpnextWarehouseMapping,
  ItemMappingState,
  MappingResult,
} from "@/lib/erp-mapping-queries";

export { canReadErpStatus as canManageMappings } from "@/erp-status/erpStatusLogic";

/** Which operation a failure came from: each one documents its own statuses. */
export type MappingOp =
  | "listItems"
  | "listWarehouses"
  | "suggest"
  | "confirm"
  | "retireItem"
  | "setWarehouse"
  | "retireWarehouse";

export type MappingFailure =
  /** 400: the server rejected the values (or, on a read, the filter). */
  | { kind: "validation"; requestId?: string }
  /** 401: the session ended. */
  | { kind: "session"; requestId?: string }
  /** A read refused with 403/404: the surface is not this caller's. Hidden, not explained. */
  | { kind: "unavailable"; requestId?: string }
  /** A mutation 403: `origin_rejected`. */
  | { kind: "origin"; requestId?: string }
  /** A mutation 404: the addressed row, product or store is absent or out of scope. */
  | { kind: "not-found"; requestId?: string }
  /** 409 `conflict`: stale version, wrong state, or an active mapping already exists. */
  | { kind: "conflict"; requestId?: string }
  /** 429 `rate_limited`. Never retried for the operator. */
  | { kind: "rate-limited"; retryAfter?: number; requestId?: string }
  /** A mutation with no answer or a 5xx: it may or may not have been applied. */
  | { kind: "unknown"; requestId?: string }
  /** A read that failed for any other reason (5xx, no answer, undocumented status). */
  | { kind: "failed"; requestId?: string };

const READS: readonly MappingOp[] = ["listItems", "listWarehouses"];

export function isRead(op: MappingOp): boolean {
  return READS.includes(op);
}

/** The server's correlation id from the canonical error envelope, when present. */
export function requestIdOf(error: unknown): string | undefined {
  const id = (error as { error?: { request_id?: unknown } } | undefined)?.error?.request_id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

type Kind = MappingFailure["kind"];

/** What each documented status means on a read and on a mutation. */
const STATUS_KINDS: Readonly<Record<number, { read: Kind; write: Kind }>> = {
  400: { read: "validation", write: "validation" },
  401: { read: "session", write: "session" },
  403: { read: "unavailable", write: "origin" },
  404: { read: "unavailable", write: "not-found" },
  409: { read: "failed", write: "conflict" },
  429: { read: "rate-limited", write: "rate-limited" },
};

/** Any other status: a 5xx on a mutation may or may not have applied; the rest failed. */
function kindOf(status: number, read: boolean): Kind {
  const known = STATUS_KINDS[status];
  if (known) return read ? known.read : known.write;
  return status >= 500 && !read ? "unknown" : "failed";
}

/** A refused or unanswered call as a typed failure. `result` undefined = no answer at all. */
export function classifyFailure(
  op: MappingOp,
  result: Pick<MappingResult<unknown>, "status" | "error" | "retryAfter"> | undefined,
): MappingFailure {
  const read = isRead(op);
  if (result === undefined) return { kind: read ? "failed" : "unknown" };
  const kind = kindOf(result.status, read);
  const id = requestIdOf(result.error);
  const wait = kind === "rate-limited" ? result.retryAfter : undefined;
  return {
    kind,
    ...(wait === undefined ? {} : { retryAfter: wait }),
    ...(id === undefined ? {} : { requestId: id }),
  } as MappingFailure;
}

/** After these the list on screen may be wrong, so it is read again (a read, never the mutation). */
export function shouldRefreshAfter(failure: MappingFailure): boolean {
  return failure.kind === "conflict" || failure.kind === "not-found" || failure.kind === "unknown";
}

const KIND_KEYS: Readonly<Record<Kind, MessageKey>> = {
  validation: "erp.map.error.validation",
  session: "erp.map.error.session",
  unavailable: "erp.map.error.unavailable",
  origin: "erp.map.error.origin",
  "not-found": "erp.map.error.mappingNotFound",
  conflict: "erp.map.error.failed",
  "rate-limited": "erp.map.error.rateLimited",
  unknown: "erp.map.error.unknownOutcome",
  failed: "erp.map.error.failed",
};

/** A read has no addressed row: its refusals read as the surface's. */
const READ_KEYS: Readonly<Partial<Record<Kind, MessageKey>>> = {
  validation: "erp.map.error.readRejected",
  "not-found": "erp.map.error.unavailable",
};

type WriteOp = Exclude<MappingOp, "listItems" | "listWarehouses">;

/** A mutation's 409 and 404 name what it addressed. */
const WRITE_KEYS: Readonly<Record<WriteOp, Partial<Record<Kind, MessageKey>>>> = {
  suggest: {
    conflict: "erp.map.error.suggestConflict",
    "not-found": "erp.map.error.productNotFound",
  },
  confirm: { conflict: "erp.map.error.confirmConflict" },
  retireItem: { conflict: "erp.map.error.retireConflict" },
  setWarehouse: {
    conflict: "erp.map.error.setConflict",
    "not-found": "erp.map.error.storeNotFound",
  },
  retireWarehouse: { conflict: "erp.map.error.retireConflict" },
};

/** The message a failure reads as for `op`. A rate limit with a wait has its own key. */
export function failureKey(op: MappingOp, failure: MappingFailure): MessageKey {
  if (failure.kind === "rate-limited" && failure.retryAfter !== undefined) {
    return "erp.map.error.rateLimitedWait";
  }
  const own = isRead(op) ? READ_KEYS : WRITE_KEYS[op as WriteOp];
  return own[failure.kind] ?? KIND_KEYS[failure.kind];
}

// --- Labels -------------------------------------------------------------------------

export type Tone = "success" | "warning" | "neutral";

export interface StateView {
  labelKey: MessageKey;
  tone: Tone;
  hollow: boolean;
  /** False for a value this build does not know: no action is offered on it. */
  known: boolean;
}

const STATE_VIEWS: Record<ItemMappingState, StateView> = {
  suggested: { labelKey: "erp.map.state.suggested", tone: "warning", hollow: true, known: true },
  confirmed: { labelKey: "erp.map.state.confirmed", tone: "success", hollow: false, known: true },
};

const UNKNOWN_STATE: StateView = {
  labelKey: "erp.map.state.unknown",
  tone: "neutral",
  hollow: true,
  known: false,
};

export function stateView(state: string): StateView {
  return Object.hasOwn(STATE_VIEWS, state) ? STATE_VIEWS[state as ItemMappingState] : UNKNOWN_STATE;
}

const SOURCE_KEYS: Record<ErpnextItemMapping["suggestion_source"], MessageKey> = {
  barcode: "erp.map.source.barcode",
  item_code: "erp.map.source.itemCode",
  manual: "erp.map.source.manual",
};

/** A known source's label key, or undefined: the raw value is then shown as received. */
export function sourceKey(source: string): MessageKey | undefined {
  return Object.hasOwn(SOURCE_KEYS, source)
    ? SOURCE_KEYS[source as keyof typeof SOURCE_KEYS]
    : undefined;
}

const PURPOSE_KEYS: Record<ErpnextWarehouseMapping["purpose"], MessageKey> = {
  stock: "erp.map.purpose.stock",
  returns: "erp.map.purpose.returns",
};

export function purposeKey(purpose: string): MessageKey | undefined {
  return Object.hasOwn(PURPOSE_KEYS, purpose)
    ? PURPOSE_KEYS[purpose as keyof typeof PURPOSE_KEYS]
    : undefined;
}

// --- Inputs ---------------------------------------------------------------------------

/** The `?state=` filter: one of the contract's two states, else all (a bad value is never sent). */
export function parseStateFilter(value: string | null): ItemMappingState | "" {
  return value === "suggested" || value === "confirmed" ? value : "";
}

/** An ERPNext reference as typed: trimmed. Empty means nothing to send. */
export function cleanRef(value: string): string {
  return value.trim();
}

/** A row is active when it has not been retired. The lists return active rows only. */
export function isActive(row: { retired_at?: string | null }): boolean {
  return row.retired_at === null || row.retired_at === undefined;
}

/** The stores a warehouse mapping can still be set for: no active `stock` mapping yet. */
export function unmappedStores<S extends { id: string }>(
  stores: readonly S[],
  mappings: readonly ErpnextWarehouseMapping[],
): S[] {
  const mapped = new Set(
    mappings.filter((m) => isActive(m) && m.purpose === "stock").map((m) => m.store_id),
  );
  return stores.filter((s) => !mapped.has(s.id));
}
