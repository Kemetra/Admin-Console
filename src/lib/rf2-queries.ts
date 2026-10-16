/**
 * RF-2 data layer (T005): typed wrappers over the generated `apiClient` for the
 * ten tenant/store operations, stable query keys, and the typed-error mapping
 * the surfaces branch on.
 *
 * Reuse posture (research R4-1..R4-5): this builds ON TOP of RF-1's primitives —
 * the same generated client (the ONLY DP2 call surface, Principle 8), the same
 * TanStack Query, the same Banner/InlineError surface. It adds NO new dependency
 * and NO new context operation; scope (active tenant) is read from RF-1's
 * `ActiveContextProvider`, not fetched here.
 *
 * Error mapping covers exactly the statuses the tenant/store contracts document
 * at pin 62d0906 (FR-004-007/008): 403→banner, 404→uniform not-found,
 * 409→inline conflict (tenant slug | store code, OQ-9), store 401→scope prompt
 * (distinct from session-expiry, OQ-4), 5xx→retry-able banner. The contracts
 * document NO 422/429 on these ops, so none is asserted (AS-5, Principle 2).
 */
import { apiClient } from "@/generated/client";
import type { components } from "@/generated/schema";
import type { MessageKey } from "@/i18n";

// --- Typed operation wrappers -------------------------------------------------
// Each returns `{ status, data?, error? }` so callers branch on `status`
// uniformly, mirroring src/lib/client.ts (RF-1). No hand-rolled fetch
// (FR-004-002); cookie transport is already on the generated client.

export interface TenantCreateBody {
  slug: string;
  name: string;
}
export interface TenantUpdateBody {
  name?: string;
  status?: "active" | "suspended";
}
/** From the generated contract, so a field it does not have cannot be sent (RT-477). */
export type StoreCreateBody = components["schemas"]["StoreCreate"];
export type StoreUpdateBody = components["schemas"]["StoreUpdate"];
export type StoreTimezoneChangePreview = components["schemas"]["StoreTimezoneChangePreview"];

/** GET /api/v1/tenants */
export async function listTenants() {
  const { data, error, response } = await apiClient.GET("/api/v1/tenants", {});
  return { status: response.status, data, error };
}

/** GET /api/v1/tenants/{tenant_id} */
export async function readTenant(tenantId: string) {
  const { data, error, response } = await apiClient.GET("/api/v1/tenants/{tenant_id}", {
    params: { path: { tenant_id: tenantId } },
  });
  return { status: response.status, data, error };
}

/** POST /api/v1/tenants */
export async function createTenant(body: TenantCreateBody) {
  const { data, error, response } = await apiClient.POST("/api/v1/tenants", { body });
  return { status: response.status, data, error };
}

/** PATCH /api/v1/tenants/{tenant_id} */
export async function updateTenant(tenantId: string, body: TenantUpdateBody) {
  const { data, error, response } = await apiClient.PATCH("/api/v1/tenants/{tenant_id}", {
    params: { path: { tenant_id: tenantId } },
    body,
  });
  return { status: response.status, data, error };
}

/** DELETE /api/v1/tenants/{tenant_id} */
export async function softDeleteTenant(tenantId: string) {
  const { data, error, response } = await apiClient.DELETE("/api/v1/tenants/{tenant_id}", {
    params: { path: { tenant_id: tenantId } },
  });
  return { status: response.status, data, error };
}

/** GET /api/v1/stores */
export async function listStores() {
  const { data, error, response } = await apiClient.GET("/api/v1/stores", {});
  return { status: response.status, data, error };
}

/** GET /api/v1/stores/{store_id} */
export async function readStore(storeId: string) {
  const { data, error, response } = await apiClient.GET("/api/v1/stores/{store_id}", {
    params: { path: { store_id: storeId } },
  });
  return { status: response.status, data, error };
}

/** POST /api/v1/stores */
export async function createStore(body: StoreCreateBody) {
  const { data, error, response } = await apiClient.POST("/api/v1/stores", { body });
  return { status: response.status, data, error };
}

/** PATCH /api/v1/stores/{store_id} */
export async function updateStore(storeId: string, body: StoreUpdateBody) {
  const { data, error, response } = await apiClient.PATCH("/api/v1/stores/{store_id}", {
    params: { path: { store_id: storeId } },
    body,
  });
  return { status: response.status, data, error };
}

/** GET /api/v1/stores/{store_id}/timezone-change-preview: read-only impact review. */
export async function previewStoreTimezoneChange(request: {
  storeId: string;
  timezone: string;
}) {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/stores/{store_id}/timezone-change-preview",
    { params: { path: { store_id: request.storeId }, query: { timezone: request.timezone } } },
  );
  return { status: response.status, data, error };
}

// --- Query keys ---------------------------------------------------------------
// Store keys are scoped by the active tenant id so a tenant switch re-scopes the
// cache (S7); RF-2 holds no authoritative scope (OQ-5) — the id comes from the
// RF-1 provider at call sites.

export const rf2QueryKeys = {
  tenants: ["rf2", "tenants"] as const,
  tenant: (tenantId: string) => ["rf2", "tenant", tenantId] as const,
  stores: (tenantId: string | null) => ["rf2", "stores", tenantId] as const,
  store: (storeId: string) => ["rf2", "store", storeId] as const,
  timezonePreview: (storeId: string, timezone: string) =>
    ["rf2", "store-timezone-preview", storeId, timezone] as const,
  timezonePreviews: (storeId: string) => ["rf2", "store-timezone-preview", storeId] as const,
} as const;

// --- Typed error mapping ------------------------------------------------------

/** Backend error envelope: { error: { code, message, request_id } } (schema Error). */
interface BackendError {
  error?: { code?: string; message?: string; request_id?: string };
}

/** Which resource family raised the error — disambiguates 409 field + 401 meaning. */
export type Rf2Resource = "tenant" | "store";

export interface Rf2ErrorContext {
  status: number;
  error?: BackendError;
  context: Rf2Resource;
}

/**
 * A render decision. It carries the catalog KEY of its copy (RT-399), never a
 * translated string: the decision lives in the TanStack Query cache and in
 * component state, and the surface renders `t(render.messageKey)`, so a locale
 * switch re-renders it in the new language.
 */
export type Rf2ErrorRender =
  /** Persistent banner (403 permission, or retryable 5xx). Surfaces request_id. */
  | { kind: "banner"; messageKey: MessageKey; requestId?: string; retryable: boolean }
  /** Uniform 404 — absent vs no-access indistinguishable (FR-004-008). */
  | { kind: "not-found"; messageKey: MessageKey }
  /** 409 conflict, rendered inline on the named field (slug | code, OQ-9). */
  | { kind: "conflict"; field: "slug" | "code"; messageKey: MessageKey }
  /** 400 `invalid_timezone` (RT-401): inline on the time zone field. */
  | { kind: "field-error"; field: "timezone"; messageKey: MessageKey }
  /** Store 401 "No active tenant" — scope precondition, NOT session expiry (OQ-4). */
  | { kind: "scope-required"; messageKey: MessageKey }
  /** Anything else (incl. an undocumented tenant 401) — generic banner copy. */
  | { kind: "generic"; messageKey: MessageKey; requestId?: string };

/** Client-authored copy, selected by status (never raw backend text). */
const COPY = {
  forbidden403: "errors.forbidden",
  notFound: "errors.notFound",
  slugConflict: "tenants.errors.slugConflict",
  codeConflict: "stores.errors.codeConflict",
  scopeRequired: "stores.errors.scopeRequired",
  timezoneInvalid: "stores.errors.timezoneInvalid",
  timezoneChangedConcurrently: "stores.errors.timezoneChangedConcurrently",
  storeHasOpenShift: "stores.errors.storeHasOpenShift",
  serverError: "errors.server",
  generic: "errors.generic",
} as const satisfies Record<string, MessageKey>;

function requestIdOf(input: Rf2ErrorContext): string | undefined {
  return input.error?.error?.request_id;
}

/**
 * RT-401 store time zone errors, keyed by the backend `error.code`. They share
 * statuses with older store errors (a 409 was always the code conflict), so the
 * code decides, and only on a store.
 */
function timezoneErrorRender(input: Rf2ErrorContext): Rf2ErrorRender | undefined {
  if (input.context !== "store") return undefined;
  const requestId = requestIdOf(input);
  switch (input.error?.error?.code) {
    case "invalid_timezone":
      return { kind: "field-error", field: "timezone", messageKey: COPY.timezoneInvalid };
    case "timezone_changed_concurrently":
      return {
        kind: "banner",
        messageKey: COPY.timezoneChangedConcurrently,
        requestId,
        retryable: false,
      };
    case "store_has_open_shift":
      return { kind: "banner", messageKey: COPY.storeHasOpenShift, requestId, retryable: false };
    default:
      return undefined;
  }
}

/**
 * Only the store ops document a 401 (scope precondition). A 401 on a tenant op
 * is undocumented: do not invent scope handling, fall through to generic.
 */
function unauthorizedRender(input: Rf2ErrorContext): Rf2ErrorRender {
  if (input.context === "store") return { kind: "scope-required", messageKey: COPY.scopeRequired };
  return { kind: "generic", messageKey: COPY.generic, requestId: requestIdOf(input) };
}

/** A 409 with no time zone code: the unique slug (tenant) or code (store). */
function conflictRender(input: Rf2ErrorContext): Rf2ErrorRender {
  return input.context === "tenant"
    ? { kind: "conflict", field: "slug", messageKey: COPY.slugConflict }
    : { kind: "conflict", field: "code", messageKey: COPY.codeConflict };
}

/**
 * Map an RF-2 operation's failure to a render decision. Pure; no React, no
 * fetch. The store 401 → `scope-required` is deliberately distinct from a
 * session-expiry 401: it must NOT trigger a refresh or sign-out, because RF-2's
 * calls do not run through RF-1's per-call context interceptor (OQ-4/OQ-10).
 */
export function mapRf2Error(input: Rf2ErrorContext): Rf2ErrorRender {
  const timezoneError = timezoneErrorRender(input);
  if (timezoneError) return timezoneError;
  const requestId = requestIdOf(input);
  switch (input.status) {
    case 401:
      return unauthorizedRender(input);
    case 403:
      return { kind: "banner", messageKey: COPY.forbidden403, requestId, retryable: false };
    case 404:
      return { kind: "not-found", messageKey: COPY.notFound };
    case 409:
      return conflictRender(input);
    default:
      if (input.status >= 500) {
        return { kind: "banner", messageKey: COPY.serverError, requestId, retryable: true };
      }
      return { kind: "generic", messageKey: COPY.generic, requestId };
  }
}
