/**
 * RT-818 data layer (RT-751 slice 1): typed wrapper over the generated
 * `apiClient` for the one read operation of the Backend-Core console sales
 * summary (RT-649 contract / RT-739 runtime):
 *
 *   - `consoleGetSalesSummary`: deterministic received-sales KPIs per store,
 *     business date and currency over an inclusive range of at most 31 days.
 *
 * Boundary: ONE read-only op is wrapped; no UI lives here (VIZ-1 to VIZ-3).
 * Same `{ status, data?, error? }` shape as `src/lib/sale-queries.ts`; cookie
 * transport is on the generated client. No hand-rolled fetch.
 *
 * Error mapping: exactly the statuses the contract documents.
 *   - 400 `validation_error` carries no field detail in the envelope, so a
 *     range problem (`to` before `from`, or wider than 31 days) is told apart
 *     from any other bad field by checking the request that was sent, never by
 *     parsing the message.
 *   - 404 is the non-disclosing not-found: no request id, no cause.
 *   - 429 is the shared `RateLimitBanner` (clock fed by the middleware in
 *     `src/lib/rate-limit.ts`); this mapper adds no copy and no countdown.
 *   - 5xx is a retryable banner carrying the `request_id`.
 * Copy is the surface's: the 400 / 404 kinds carry none, and the 5xx / generic
 * kinds carry a shared catalog key (RT-399), never a translated string.
 */
import { apiClient } from "@/generated/client";
import type { ConsoleSalesSummarySchema } from "@/generated/schema";
import type { MessageKey } from "@/i18n";

type Schemas = ConsoleSalesSummarySchema.components["schemas"];

// --- Generated projections (no hand-typed shapes) -----------------------------

export type SalesSummary = Schemas["ConsoleSalesSummary"];
export type SalesSummaryQuery =
  ConsoleSalesSummarySchema.operations["consoleGetSalesSummary"]["parameters"]["query"];

/** `to - from <= 30`: 31 business days inclusive (the contract's bound). */
export const SALES_SUMMARY_MAX_SPAN_DAYS = 30;

const MS_PER_DAY = 86_400_000;
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// --- Typed operation wrapper --------------------------------------------------

/** GET /api/v1/sales-summary: a `store_id` outside the caller's scope is the non-disclosing 404. */
export async function consoleGetSalesSummary(query: SalesSummaryQuery) {
  const { data, error, response } = await apiClient.GET("/api/v1/sales-summary", {
    params: { query },
  });
  return { status: response.status, data, error };
}

// --- Range check --------------------------------------------------------------

export type SalesSummaryRangeProblem = "to-before-from" | "range-too-wide";

function utcDay(value: string): number | null {
  const match = CALENDAR_DATE.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const ms = Date.UTC(Number(y), Number(m) - 1, Number(d));
  const date = new Date(ms);
  const valid =
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d);
  return valid ? ms / MS_PER_DAY : null;
}

/**
 * The range rule the server enforces, for a surface that wants to refuse before
 * sending. Null when the range is fine, or when a value is not a calendar date
 * (that is a field problem, not a range one).
 */
export function salesSummaryRangeProblem(
  range: Pick<SalesSummaryQuery, "from" | "to">,
): SalesSummaryRangeProblem | null {
  const from = utcDay(range.from);
  const to = utcDay(range.to);
  if (from === null || to === null) return null;
  if (to < from) return "to-before-from";
  return to - from > SALES_SUMMARY_MAX_SPAN_DAYS ? "range-too-wide" : null;
}

// --- Typed error mapping ------------------------------------------------------

/** Backend error envelope: { error: { code, message, request_id } } (generated schema Error). */
type BackendError = Schemas["Error"];

export interface SalesSummaryErrorContext {
  status: number;
  error?: BackendError;
  /** The query that was sent; lets a 400 be told apart as a range problem. */
  query?: SalesSummaryQuery;
}

export type SalesSummaryErrorRender =
  /** 400: `to` before `from`, or a range wider than 31 days. */
  | { kind: "range"; problem: SalesSummaryRangeProblem; requestId?: string }
  /** 400 otherwise: a malformed, repeated or unknown value, a bad cursor or page size. */
  | { kind: "field"; requestId?: string }
  /** 404: non-disclosing; absent, out of scope and role-refused are one answer. */
  | { kind: "not-found" }
  /** 429: the shared RateLimitBanner owns the countdown and the retry. */
  | { kind: "rate-limited" }
  /** 5xx: retryable banner with the correlation id. */
  | { kind: "server"; messageKey: MessageKey; requestId?: string; retryable: true }
  /** 401 and any status the contract does not document. */
  | { kind: "generic"; messageKey: MessageKey; requestId?: string };

const COPY = {
  serverError: "errors.server",
  generic: "errors.generic",
} as const satisfies Record<string, MessageKey>;

function mapBadRequest(
  query: SalesSummaryQuery | undefined,
  requestId?: string,
): SalesSummaryErrorRender {
  const problem = query ? salesSummaryRangeProblem(query) : null;
  return problem ? { kind: "range", problem, requestId } : { kind: "field", requestId };
}

export function mapSalesSummaryError(input: SalesSummaryErrorContext): SalesSummaryErrorRender {
  const requestId = input.error?.error?.request_id;
  if (input.status === 400) return mapBadRequest(input.query, requestId);
  if (input.status === 404) return { kind: "not-found" };
  if (input.status === 429) return { kind: "rate-limited" };
  if (input.status >= 500) {
    return { kind: "server", messageKey: COPY.serverError, requestId, retryable: true };
  }
  // 401 (the auth interceptor owns the session) and anything undocumented.
  return { kind: "generic", messageKey: COPY.generic, requestId };
}
