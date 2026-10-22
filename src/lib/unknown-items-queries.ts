/**
 * RF-4a data layer (T003): typed wrappers over the generated `apiClient` for the
 * unknown-items review-queue operations, stable query keys, and the per-op
 * typed-error mapping the surfaces branch on. RF-4a wraps list / inspect /
 * dismiss; RT-724 (RF-4b) adds create-product, reopen and bulk-dismiss; RT-767
 * adds link.
 *
 * Reuse posture (research R4a-1): this mirrors `src/lib/rf2-queries.ts` exactly —
 * the same generated client (the ONLY DP2 call surface, Principle 8), the same
 * `{ status, data?, error? }` result shape, the same Banner/InlineError surface.
 * It adds NO new dependency and NO new context operation; scope (active tenant /
 * store) is read from RF-1's `ActiveContextProvider` at the call sites, not
 * fetched here.
 *
 * Boundary (VG-4): seven ops are wrapped. `posCaptureItem` is terminal-side and
 * is NOT wrapped and NOT called. `tenantAdminLinkUnknownItem` was deferred by
 * RT-724 for want of a product picker; RT-767 wraps it, and the product id it
 * sends always comes from the shared catalog picker, never from typed text.
 *
 * Error mapping (research R4a-3, AS-5 discipline): each op maps EXACTLY the
 * statuses its contract documents, asserting no undocumented status. Unlike RF-2,
 * a 409 is never a slug/code uniqueness conflict: it is `already_reconciled`
 * (the item is already terminal), `alias_conflict` (create-product: the
 * identifier is bound to another product, which is NEVER named), or
 * `idempotency_key_conflict` (reopen / bulk-dismiss). The 007 `forbidden` (403)
 * is its own branch, distinct from the non-disclosing 404. Since the RT-723
 * repin every op documents the console 429 `rate_limited` (RT-574); the keyed
 * ops (reopen / bulk-dismiss) also document 425. No 422 is documented.
 *
 * RT-399: the mapper returns a catalog `messageKey`, never copy; the surfaces
 * translate it at render, so a locale switch never leaves a cached string in
 * the old language (the render decision lives in the TanStack Query cache).
 */
import { apiClient } from "@/generated/client";
import type { components, operations } from "@/generated/schema";
import type { MessageKey } from "@/i18n";

// --- Generated projections (no hand-typed shapes) -----------------------------

/** The review-surface projection: `UnknownItem` minus `sale_context` (FR-007). */
export type ReviewQueueItem = components["schemas"]["ReviewQueueItem"];
/** List response: `{ items: ReviewQueueItem[]; next_cursor: string | null }`. */
export type ListUnknownItemsResponse = components["schemas"]["ListUnknownItemsResponse"];
/** The typed query params for the list op (007 source_system / sort / group_by). */
export type ListUnknownItemsParams = NonNullable<
  operations["tenantAdminListUnknownItems"]["parameters"]["query"]
>;
/** create-product body: `name` + `tax_category` (+ optional `category_id`). */
export type CreateProductFromUnknownItemRequest =
  components["schemas"]["CreateProductFromUnknownItemRequest"];
/** link body: the target `product_id` only (scope is the session's). */
export type LinkUnknownItemRequest = components["schemas"]["LinkUnknownItemRequest"];
/** One per-id outcome of a bulk dismiss (`dismissed` / `already_reconciled` / `not_found`). */
export type BulkDismissOutcome = components["schemas"]["BulkDismissOutcome"];

/** FR-044: a bulk dismiss over this many ids is rejected whole (never clamped). */
export const BULK_DISMISS_MAX = 200;

// --- Typed operation wrappers -------------------------------------------------
// Each returns `{ status, data?, error? }` so callers branch on `status`
// uniformly, mirroring src/lib/rf2-queries.ts. No hand-rolled fetch (VG-3);
// cookie transport is already on the generated client.

/** GET /api/v1/catalog/unknown-items — the pending review queue (scoped by RLS). */
export async function listUnknownItems(params?: ListUnknownItemsParams) {
  const { data, error, response } = await apiClient.GET("/api/v1/catalog/unknown-items", {
    params: { query: params },
  });
  return { status: response.status, data, error };
}

/** GET /api/v1/catalog/unknown-items/{id} — inspect one item as a ReviewQueueItem. */
export async function inspectUnknownItem(id: string) {
  const { data, error, response } = await apiClient.GET("/api/v1/catalog/unknown-items/{id}", {
    params: { path: { id } },
  });
  return { status: response.status, data, error };
}

/** POST /api/v1/catalog/unknown-items/{id}/dismiss — terminate a pending item. */
export async function dismissUnknownItem(id: string) {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/catalog/unknown-items/{id}/dismiss",
    { params: { path: { id } } },
  );
  return { status: response.status, data, error };
}

/**
 * POST /api/v1/catalog/unknown-items/{id}/create-product — create a tenant
 * product from a pending item and resolve it (`resolution_action = created`).
 */
export async function createProductFromUnknownItem(
  id: string,
  body: CreateProductFromUnknownItemRequest,
) {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/catalog/unknown-items/{id}/create-product",
    { params: { path: { id } }, body },
  );
  return { status: response.status, data, error };
}

/**
 * POST /api/v1/catalog/unknown-items/{id}/link — bind the item's identifier to an
 * existing active product and resolve it (`resolution_action = linked`). Not
 * keyed: the contract documents no `Idempotency-Key` and no 425 for link.
 */
export async function linkUnknownItem(id: string, productId: string) {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/catalog/unknown-items/{id}/link",
    { params: { path: { id } }, body: { product_id: productId } },
  );
  return { status: response.status, data, error };
}

/**
 * POST /api/v1/catalog/unknown-items/{id}/reopen — a fresh `pending` row for a
 * dismissed item (tenant-wide actors only). Idempotency-keyed: the caller owns
 * the key so a manual retry of the same item replays instead of reopening twice.
 */
export async function reopenUnknownItem(id: string, idempotencyKey: string) {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/catalog/unknown-items/{id}/reopen",
    { params: { path: { id }, header: { "Idempotency-Key": idempotencyKey } }, body: {} },
  );
  return { status: response.status, data, error };
}

/**
 * POST /api/v1/catalog/unknown-items/bulk-dismiss — dismiss up to
 * {@link BULK_DISMISS_MAX} items; one outcome per id. Idempotency-keyed.
 */
export async function bulkDismissUnknownItems(ids: string[], idempotencyKey: string) {
  const { data, error, response } = await apiClient.POST(
    "/api/v1/catalog/unknown-items/bulk-dismiss",
    { params: { header: { "Idempotency-Key": idempotencyKey } }, body: { ids } },
  );
  return { status: response.status, data, error };
}

// --- Query keys ---------------------------------------------------------------
// Keys are scoped by the active tenant id (+ the list filter/sort/group params)
// so a tenant switch or a filter change re-keys the cache structurally (R4a-6);
// RF-4a holds no authoritative scope — the tenant id comes from the RF-1 provider
// at the call sites.

export const unknownItemsQueryKeys = {
  list: (tenantId: string | null, params?: ListUnknownItemsParams) =>
    ["rf4a", "unknown-items", tenantId, params ?? {}] as const,
  item: (id: string) => ["rf4a", "unknown-item", id] as const,
} as const;

// --- Enum labels --------------------------------------------------------------
// Contract enums drive copy; they are not copy (UX-12). Each maps to a catalog
// key, so a raw code never renders in either locale.

const IDENTIFIER_TYPE: Record<ReviewQueueItem["identifier_type"], MessageKey> = {
  barcode: "unknownItems.identifierType.barcode",
  sku: "unknownItems.identifierType.sku",
  plu: "unknownItems.identifierType.plu",
  supplier_code: "unknownItems.identifierType.supplier_code",
  external_pos_id: "unknownItems.identifierType.external_pos_id",
};

const RESOLUTION_STATUS: Record<ReviewQueueItem["resolution_status"], MessageKey> = {
  pending: "unknownItems.status.pending",
  resolved: "unknownItems.status.resolved",
  dismissed: "unknownItems.status.dismissed",
};

const RESOLUTION_ACTION: Record<NonNullable<ReviewQueueItem["resolution_action"]>, MessageKey> = {
  linked: "unknownItems.action.linked",
  created: "unknownItems.action.created",
  dismissed: "unknownItems.action.dismissed",
};

function enumKey<K extends string>(map: Record<K, MessageKey>, value: string): MessageKey | null {
  return Object.hasOwn(map, value) ? map[value as K] : null;
}

/**
 * Label key for an identifier type. Null only for a value outside the contract
 * enum, which the surface then shows verbatim rather than guessing a label.
 */
export function identifierTypeKey(type: ReviewQueueItem["identifier_type"]): MessageKey | null {
  return enumKey(IDENTIFIER_TYPE, type);
}

/** Label key for a resolution status (null outside the contract enum). */
export function resolutionStatusKey(
  status: ReviewQueueItem["resolution_status"],
): MessageKey | null {
  return enumKey(RESOLUTION_STATUS, status);
}

/** Label key for a resolution action; null while pending (or outside the enum). */
export function resolutionActionKey(
  action: ReviewQueueItem["resolution_action"],
): MessageKey | null {
  return action ? enumKey(RESOLUTION_ACTION, action) : null;
}

// --- Typed error mapping ------------------------------------------------------

/** Backend error envelope: { error: { code, message, request_id } } (schema Error). */
interface BackendError {
  error?: { code?: string; message?: string; request_id?: string | null };
}

/** Which op raised the error — disambiguates which statuses are documented. */
export type UnknownItemOp =
  | "list"
  | "inspect"
  | "dismiss"
  | "createProduct"
  | "link"
  | "reopen"
  | "bulkDismiss";

export interface UnknownItemErrorContext {
  status: number;
  error?: BackendError;
  op: UnknownItemOp;
}

export type UnknownItemErrorRender =
  /** Persistent banner (403 forbidden, or retryable 5xx). Surfaces request_id. */
  | { kind: "banner"; messageKey: MessageKey; requestId?: string; retryable: boolean }
  /** Uniform 404 — absent vs no-access indistinguishable (SI-004, inspect/dismiss). */
  | { kind: "not-found"; messageKey: MessageKey }
  /** 409 `already_reconciled` — the item is already terminal (dismiss / create / reopen). */
  | { kind: "already-reconciled"; messageKey: MessageKey }
  /** 400 the server refused the request body (create-product fields; bulk batch over the ceiling). */
  | { kind: "validation"; messageKey: MessageKey; requestId?: string }
  /** 409 `alias_conflict` — the identifier is bound to another product (never named, FR-042). */
  | { kind: "alias-conflict"; messageKey: MessageKey; requestId?: string }
  /** 409 `target_unavailable` — the target product is retired or deleted. */
  | { kind: "target-unavailable"; messageKey: MessageKey; requestId?: string }
  /** 409 `idempotency_key_conflict` — the key is spent; the next attempt needs a new one. */
  | { kind: "key-conflict"; messageKey: MessageKey; requestId?: string }
  /** 425 — the original keyed request is still in flight; the operator may try again. */
  | { kind: "in-progress"; messageKey: MessageKey }
  /** Anything else (incl. a 400 bad param) — generic banner copy. */
  | { kind: "generic"; messageKey: MessageKey; requestId?: string };

/** Catalog keys per render decision. 5xx and bad-request reuse the shared errors.* copy. */
const COPY = {
  forbidden403: "unknownItems.errors.forbidden",
  reopenForbidden: "unknownItems.errors.reopenForbidden",
  notFound: "unknownItems.errors.notFound",
  alreadyReconciled: "unknownItems.errors.alreadyReconciled",
  reopenResolved: "unknownItems.errors.reopenResolved",
  createValidation: "unknownItems.errors.createValidation",
  linkValidation: "unknownItems.errors.linkValidation",
  linkAliasConflict: "unknownItems.errors.linkAliasConflict",
  originRejected: "unknownItems.errors.originRejected",
  bulkRejected: "unknownItems.errors.bulkRejected",
  aliasConflict: "unknownItems.errors.aliasConflict",
  targetUnavailable: "unknownItems.errors.targetUnavailable",
  keyConflict: "unknownItems.errors.keyConflict",
  inProgress: "unknownItems.errors.inProgress",
  rateLimited: "unknownItems.errors.rateLimited",
  serverError: "errors.server",
  badRequest: "errors.generic",
} as const satisfies Record<string, MessageKey>;

/** Ops whose contract documents a 404 (the non-disclosing not-found). */
const NOT_FOUND_OPS: ReadonlySet<UnknownItemOp> = new Set([
  "inspect",
  "dismiss",
  "createProduct",
  "link",
  "reopen",
]);

/** Ops carrying an `Idempotency-Key` (they document 409 key conflicts and 425). */
const KEYED_OPS: ReadonlySet<UnknownItemOp> = new Set(["reopen", "bulkDismiss"]);

function requestIdOf(input: UnknownItemErrorContext): string | undefined {
  return input.error?.error?.request_id ?? undefined;
}

function codeOf(input: UnknownItemErrorContext): string | undefined {
  return input.error?.error?.code;
}

/** 403: reopen needs tenant-wide authority; link may be an `origin_rejected`. */
function forbiddenKey(input: UnknownItemErrorContext): MessageKey {
  if (input.op === "reopen") return COPY.reopenForbidden;
  if (input.op === "link" && codeOf(input) === "origin_rejected") return COPY.originRejected;
  return COPY.forbidden403;
}

/** 400: a refused body is form-level on the write ops; anything else is generic. */
function mapBadRequest(input: UnknownItemErrorContext): UnknownItemErrorRender {
  const requestId = requestIdOf(input);
  if (input.op === "createProduct") {
    return { kind: "validation", messageKey: COPY.createValidation, requestId };
  }
  if (input.op === "link") {
    return { kind: "validation", messageKey: COPY.linkValidation, requestId };
  }
  if (input.op === "bulkDismiss") {
    // FR-044: the whole batch is rejected; nothing was dismissed.
    return { kind: "validation", messageKey: COPY.bulkRejected, requestId };
  }
  return { kind: "generic", messageKey: COPY.badRequest, requestId };
}

/** A reconciliation 409 (create-product / link): the code decides, no product is ever named. */
function mapReconciliationConflict(
  code: string | undefined,
  aliasConflictKey: typeof COPY.aliasConflict | typeof COPY.linkAliasConflict,
  requestId: string | undefined,
): UnknownItemErrorRender {
  if (code === "alias_conflict") {
    return { kind: "alias-conflict", messageKey: aliasConflictKey, requestId };
  }
  if (code === "target_unavailable") {
    return { kind: "target-unavailable", messageKey: COPY.targetUnavailable, requestId };
  }
  if (code === "already_reconciled") {
    return { kind: "already-reconciled", messageKey: COPY.alreadyReconciled };
  }
  return { kind: "generic", messageKey: COPY.badRequest, requestId };
}

/** 409: the documented `error.code` decides; the conflicting product is never named. */
function mapConflict(input: UnknownItemErrorContext): UnknownItemErrorRender {
  const requestId = requestIdOf(input);
  const code = codeOf(input);
  if (KEYED_OPS.has(input.op) && code === "idempotency_key_conflict") {
    return { kind: "key-conflict", messageKey: COPY.keyConflict, requestId };
  }
  switch (input.op) {
    case "dismiss":
      return { kind: "already-reconciled", messageKey: COPY.alreadyReconciled };
    case "reopen":
      // The only other documented reopen 409: the item is `resolved`, not dismissed.
      return { kind: "already-reconciled", messageKey: COPY.reopenResolved };
    case "createProduct":
      return mapReconciliationConflict(code, COPY.aliasConflict, requestId);
    case "link":
      return mapReconciliationConflict(code, COPY.linkAliasConflict, requestId);
    default:
      return { kind: "generic", messageKey: COPY.badRequest, requestId };
  }
}

/**
 * Map an RF-4a operation's failure to a render decision. Pure; no React, no
 * fetch. Each op maps only the statuses its contract documents (AS-5); an
 * undocumented status falls to the generic branch rather than inventing
 * handling (no 422 is documented on any op).
 *
 * Documented statuses:
 *   - list:          400 / 401 / 403        (no 404 — RLS filters to an empty page)
 *   - inspect:       400 / 401 / 403 / 404
 *   - dismiss:       400 / 401 / 403 / 404 / 409 (already_reconciled)
 *   - createProduct: 400 (validation_error) / 401 / 403 / 404 /
 *                    409 (alias_conflict | already_reconciled)
 *   - link:          400 (validation_error) / 401 / 403 (forbidden |
 *                    origin_rejected) / 404 /
 *                    409 (alias_conflict | target_unavailable | already_reconciled)
 *                    (no Idempotency-Key, no 425)
 *   - reopen:        400 / 401 / 403 (tenant-wide only) / 404 /
 *                    409 (already_reconciled | idempotency_key_conflict) / 425
 *   - bulkDismiss:   400 (whole batch rejected) / 401 / 403 /
 *                    409 (idempotency_key_conflict) / 425
 *   - every op:      429 rate_limited (RT-574) — a persistent banner, never
 *                    retried automatically
 * `target_unavailable` is mapped wherever a reconciliation 409 carries it,
 * though create-product's contract does not list it (only link does). The
 * `target_unavailable` copy says "no longer available", never "retired": since
 * RT-745 Backend-Core also refuses an inactive target.
 *
 * 401 is intentionally NOT mapped to a scope/sign-out action here: the
 * generated client carries the cookie; a 401 on these dashboard ops is an
 * unauthenticated/expired session that RF-1's interceptor owns, so RF-4a renders
 * it as a generic banner and does not synthesize a refresh (parity with RF-2's
 * AS-5 restraint).
 */
export function mapUnknownItemError(input: UnknownItemErrorContext): UnknownItemErrorRender {
  const requestId = requestIdOf(input);
  switch (input.status) {
    case 400:
      return mapBadRequest(input);
    case 403:
      // 007 8th category: `error.code = "forbidden"` — in-scope but insufficient
      // authority. Distinct from the non-disclosing 404. Rendered as a banner.
      // Reopen's 403 is specifically "tenant-wide authority required" (FR-042).
      // Link also documents `origin_rejected` (RT-430): the request, not the role, was refused.
      return {
        kind: "banner",
        messageKey: forbiddenKey(input),
        requestId,
        retryable: false,
      };
    case 404:
      // SI-004 non-disclosing: absent and out-of-scope are one answer. The list
      // and bulk dismiss document no 404 (per-id not-found is an outcome).
      if (NOT_FOUND_OPS.has(input.op)) {
        return { kind: "not-found", messageKey: COPY.notFound };
      }
      return { kind: "generic", messageKey: COPY.badRequest, requestId };
    case 409:
      if (input.op === "list" || input.op === "inspect") {
        return { kind: "generic", messageKey: COPY.badRequest, requestId };
      }
      return mapConflict(input);
    case 429:
      // The per-user console budget is spent. Not a 401 (the session is fine)
      // and never retried for the operator: they wait and try again.
      return { kind: "banner", messageKey: COPY.rateLimited, requestId, retryable: false };
    case 425:
      // Documented on the keyed ops only. Never retried automatically: the
      // operator tries again, and the same key replays the original result.
      if (KEYED_OPS.has(input.op)) {
        return { kind: "in-progress", messageKey: COPY.inProgress };
      }
      return { kind: "generic", messageKey: COPY.badRequest, requestId };
    default:
      if (input.status >= 500) {
        return { kind: "banner", messageKey: COPY.serverError, requestId, retryable: true };
      }
      // 401 / any other documented-but-non-specific status.
      return { kind: "generic", messageKey: COPY.badRequest, requestId };
  }
}
