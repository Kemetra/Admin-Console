/**
 * RT-621 (RT-574 §5 issue 3, decision D8): the ONE place a 429 from Backend-Core
 * is classified. Behaviour keys on HTTP status 429; the envelope's `error.code`
 * is informational and matched case-insensitively (D5 leaves the casing to the
 * owner, O1).
 *
 * - `parseRetryAfter`: integer seconds, 30 s fallback, clamped to [1, 3600].
 * - A shared "limited until" clock, fed by an openapi-fetch middleware, so every
 *   wrapper in `src/lib` is covered without touching the generated client.
 * - The read retry policy: at most one retry, delayed by the remaining
 *   Retry-After plus 0-1 s jitter, never the default 1 s backoff. Mutations
 *   keep `retry: false` (src/lib/query.ts); nothing here retries a write.
 *
 * A 429 is not a 401: nothing in this module touches the session.
 */
import type { Client, Middleware } from "openapi-fetch";

export const RETRY_AFTER_FALLBACK_SECONDS = 30;
export const RETRY_AFTER_MIN_SECONDS = 1;
export const RETRY_AFTER_MAX_SECONDS = 3600;
/**
 * A read is retried automatically only when the wait is this short. A longer
 * wait would hold the surface in a loading state for minutes; the banner's
 * manual retry covers it instead.
 */
export const AUTO_RETRY_MAX_SECONDS = 60;
const JITTER_MS = 1000;

export const RATE_LIMITED_STATUS = 429;
const RATE_LIMITED_CODE = "rate_limited";

/** `Retry-After` as integer seconds; missing or not an integer → 30 s; clamped to [1, 3600]. */
export function parseRetryAfter(value: string | null | undefined): number {
  const trimmed = value?.trim() ?? "";
  if (!/^\d+$/.test(trimmed)) return RETRY_AFTER_FALLBACK_SECONDS;
  const seconds = Number.parseInt(trimmed, 10);
  return Math.min(RETRY_AFTER_MAX_SECONDS, Math.max(RETRY_AFTER_MIN_SECONDS, seconds));
}

/** `rate_limited` / `RATE_LIMITED` / any casing. Informational only: status decides. */
export function isRateLimitedCode(code: unknown): boolean {
  return typeof code === "string" && code.toLowerCase() === RATE_LIMITED_CODE;
}

export interface RateLimitInfo {
  retryAfterSeconds: number;
  /** The envelope's code, lowercased, when it is the rate-limit code. */
  code?: typeof RATE_LIMITED_CODE;
}

/** Classify one response. Only status 429 is a rate limit, whatever the body says. */
export function classifyRateLimit(input: {
  status: number;
  retryAfter?: string | null;
  code?: unknown;
}): RateLimitInfo | null {
  if (input.status !== RATE_LIMITED_STATUS) return null;
  return {
    retryAfterSeconds: parseRetryAfter(input.retryAfter),
    ...(isRateLimitedCode(input.code) ? { code: RATE_LIMITED_CODE } : {}),
  };
}

/** Thrown by a read that hit a 429, so the retry policy can tell it apart. */
export class RateLimitError extends Error {
  readonly status = RATE_LIMITED_STATUS;
  constructor(readonly retryAfterSeconds: number) {
    super("Too many requests.");
    this.name = "RateLimitError";
  }
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

// --- Shared "limited until" clock --------------------------------------------

export interface RateLimitState {
  /** Epoch ms when the longest running Retry-After ends; 0 when none ran yet. */
  until: number;
  /** Epoch ms of the first 429 of the current window (for the manual retry). */
  since: number;
  /** Bumps on every 429, so a dismissed banner re-opens on the next one. */
  seq: number;
}

let state: RateLimitState = { until: 0, since: 0, seq: 0 };
const listeners = new Set<() => void>();

export function getRateLimitState(): RateLimitState {
  return state;
}

export function subscribeRateLimit(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Record a 429. The window only ever extends; a shorter Retry-After never shortens it. */
export function reportRateLimited(retryAfterSeconds: number, now: number = Date.now()): void {
  const until = Math.max(state.until, now + retryAfterSeconds * 1000);
  const since = state.until > now ? state.since : now;
  state = { until, since, seq: state.seq + 1 };
  for (const listener of listeners) listener();
}

/** Milliseconds left in the current window, 0 when none is running. */
export function rateLimitRemainingMs(now: number = Date.now()): number {
  return Math.max(0, state.until - now);
}

/** Test seam: forget every recorded 429. */
export function resetRateLimit(): void {
  state = { until: 0, since: 0, seq: 0 };
  for (const listener of listeners) listener();
}

// --- openapi-fetch middleware --------------------------------------------------

async function envelopeCode(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.clone().json();
    return (body as { error?: { code?: unknown } } | null)?.error?.code;
  } catch {
    return undefined;
  }
}

const rateLimitMiddleware: Middleware = {
  async onResponse({ response }) {
    const info = classifyRateLimit({
      status: response.status,
      retryAfter: response.headers.get("retry-after"),
      code: response.status === RATE_LIMITED_STATUS ? await envelopeCode(response) : undefined,
    });
    if (info) reportRateLimited(info.retryAfterSeconds);
    return response;
  },
};

/** Installed once at boot (src/main.tsx), beside the X-Request-Id middleware. */
// biome-ignore lint/suspicious/noExplicitAny: any generated `paths` type.
export function installRateLimitTracking(client: Client<any>): void {
  client.use(rateLimitMiddleware);
}

// --- Read retry policy -----------------------------------------------------------

/**
 * A read failed while a Retry-After is running (or threw RateLimitError). Every
 * failed read in the window waits for it: retrying any read into an active
 * window would only spend more of the same budget.
 */
function inRateLimitWindow(error: unknown, now: number): boolean {
  return isRateLimitError(error) || rateLimitRemainingMs(now) > 0;
}

/** TanStack `retry` for queries: one retry at most; on a 429 only when the wait is short. */
export function queryRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (!inRateLimitWindow(error, Date.now())) return true;
  return rateLimitRemainingMs() <= AUTO_RETRY_MAX_SECONDS * 1000;
}

/** TanStack `retryDelay`: on a 429, the remaining Retry-After plus 0-1 s jitter. */
export function queryRetryDelay(
  failureCount: number,
  error: unknown,
  random: () => number = Math.random,
): number {
  if (inRateLimitWindow(error, Date.now())) {
    return rateLimitRemainingMs() + Math.floor(random() * JITTER_MS);
  }
  // TanStack's own default backoff for a non-429 failure.
  return Math.min(1000 * 2 ** failureCount, 30_000);
}

/** For a query that must not retry anything but a 429 (e.g. the context read). */
export function retryRateLimitedOnly(failureCount: number, error: unknown): boolean {
  return isRateLimitError(error) && queryRetry(failureCount, error);
}
