import {
  AUTO_RETRY_MAX_SECONDS,
  RateLimitError,
  classifyRateLimit,
  getRateLimitState,
  installRateLimitTracking,
  isRateLimitedCode,
  parseRetryAfter,
  queryRetry,
  queryRetryDelay,
  rateLimitRemainingMs,
  reportRateLimited,
  resetRateLimit,
  retryRateLimitedOnly,
} from "@/lib/rate-limit";
import createClient from "openapi-fetch";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * RT-621 (RT-574 §5 issue 3): the shared 429 classification, the Retry-After
 * clock, the middleware that feeds it, and the read retry policy.
 */
beforeEach(() => {
  resetRateLimit();
});
afterEach(() => {
  vi.useRealTimers();
  resetRateLimit();
});

describe("parseRetryAfter", () => {
  test.each([
    ["12", 12],
    [" 7 ", 7],
    ["1", 1],
    ["3600", 3600],
  ])("integer seconds %j -> %d", (header, seconds) => {
    expect(parseRetryAfter(header)).toBe(seconds);
  });

  test.each([
    [null],
    [undefined],
    [""],
    ["abc"],
    ["12abc"],
    ["-5"],
    ["1.5"],
    ["Wed, 21 Oct 2026 07:28:00 GMT"],
  ])("missing or invalid %j falls back to 30 s", (header) => {
    expect(parseRetryAfter(header)).toBe(30);
  });

  test("clamps to [1, 3600]", () => {
    expect(parseRetryAfter("0")).toBe(1);
    expect(parseRetryAfter("3601")).toBe(3600);
    expect(parseRetryAfter("999999")).toBe(3600);
  });
});

describe("classifyRateLimit", () => {
  test("keys on status 429 only", () => {
    expect(classifyRateLimit({ status: 429, retryAfter: "5" })).toEqual({ retryAfterSeconds: 5 });
    expect(classifyRateLimit({ status: 401, retryAfter: "5", code: "rate_limited" })).toBeNull();
    expect(classifyRateLimit({ status: 503, retryAfter: "5" })).toBeNull();
  });

  test.each(["rate_limited", "RATE_LIMITED", "Rate_Limited"])(
    "matches the error code %j case-insensitively",
    (code) => {
      expect(isRateLimitedCode(code)).toBe(true);
      expect(classifyRateLimit({ status: 429, retryAfter: "9", code })).toEqual({
        retryAfterSeconds: 9,
        code: "rate_limited",
      });
    },
  );

  test("a 429 with another or no code is still a rate limit", () => {
    expect(isRateLimitedCode("too_many")).toBe(false);
    expect(isRateLimitedCode(undefined)).toBe(false);
    expect(classifyRateLimit({ status: 429, code: "too_many" })).toEqual({ retryAfterSeconds: 30 });
  });
});

describe("shared Retry-After clock", () => {
  test("records the window and only ever extends it", () => {
    reportRateLimited(10, 1_000);
    expect(getRateLimitState()).toEqual({ until: 11_000, since: 1_000, seq: 1 });
    reportRateLimited(2, 2_000);
    expect(getRateLimitState()).toEqual({ until: 11_000, since: 1_000, seq: 2 });
    reportRateLimited(20, 3_000);
    expect(getRateLimitState().until).toBe(23_000);
    expect(rateLimitRemainingMs(20_000)).toBe(3_000);
    expect(rateLimitRemainingMs(30_000)).toBe(0);
  });

  test("a 429 after the window ended starts a new one", () => {
    reportRateLimited(1, 1_000);
    reportRateLimited(5, 10_000);
    expect(getRateLimitState().since).toBe(10_000);
  });
});

describe("middleware", () => {
  function clientReturning(response: () => Response) {
    const client = createClient<Record<string, never>>({
      baseUrl: "http://console.test",
      fetch: async () => response(),
    });
    installRateLimitTracking(client);
    return client;
  }

  test("a 429 with Retry-After feeds the clock and still reaches the caller", async () => {
    vi.useFakeTimers({ now: 50_000 });
    const client = clientReturning(
      () =>
        new Response(
          JSON.stringify({ error: { code: "RATE_LIMITED", message: "Too many requests." } }),
          { status: 429, headers: { "content-type": "application/json", "retry-after": "12" } },
        ),
    );
    // biome-ignore lint/suspicious/noExplicitAny: untyped test client, any path.
    const res = await (client as any).GET("/api/v1/sales");
    expect(res.response.status).toBe(429);
    // The body was cloned, not consumed: the wrapper still reads the envelope.
    expect(res.error).toEqual({ error: { code: "RATE_LIMITED", message: "Too many requests." } });
    expect(getRateLimitState()).toMatchObject({ until: 62_000, seq: 1 });
  });

  test("a 429 without Retry-After uses the 30 s fallback", async () => {
    vi.useFakeTimers({ now: 0 });
    const client = clientReturning(() => new Response("", { status: 429 }));
    // biome-ignore lint/suspicious/noExplicitAny: untyped test client, any path.
    await (client as any).GET("/api/v1/sales");
    expect(getRateLimitState().until).toBe(30_000);
  });

  test("other statuses leave the clock alone", async () => {
    const client = clientReturning(() => new Response("{}", { status: 401 }));
    // biome-ignore lint/suspicious/noExplicitAny: untyped test client, any path.
    await (client as any).GET("/api/v1/context/me");
    expect(getRateLimitState().seq).toBe(0);
  });
});

describe("read retry policy", () => {
  test("never more than one retry", () => {
    expect(queryRetry(1, new Error("x"))).toBe(false);
    expect(queryRetry(1, new RateLimitError(5))).toBe(false);
  });

  test("a non-429 failure keeps the single retry with the default backoff", () => {
    expect(queryRetry(0, new Error("x"))).toBe(true);
    expect(queryRetryDelay(0, new Error("x"))).toBe(1000);
  });

  test("a 429 retries once after Retry-After plus 0-1 s jitter, never after 1 s", () => {
    vi.useFakeTimers({ now: 0 });
    reportRateLimited(20);
    const error = new RateLimitError(20);
    expect(queryRetry(0, error)).toBe(true);
    expect(queryRetryDelay(0, error, () => 0)).toBe(20_000);
    expect(queryRetryDelay(0, error, () => 0.999)).toBe(20_999);
  });

  test("any read failing inside a running window waits for it", () => {
    vi.useFakeTimers({ now: 0 });
    reportRateLimited(10);
    expect(queryRetryDelay(0, new Error("feature error"), () => 0)).toBe(10_000);
  });

  test("a long Retry-After is not auto-retried (manual retry from the banner)", () => {
    vi.useFakeTimers({ now: 0 });
    reportRateLimited(AUTO_RETRY_MAX_SECONDS + 1);
    expect(queryRetry(0, new RateLimitError(AUTO_RETRY_MAX_SECONDS + 1))).toBe(false);
  });

  test("retryRateLimitedOnly retries nothing but a 429", () => {
    vi.useFakeTimers({ now: 0 });
    reportRateLimited(5);
    expect(retryRateLimitedOnly(0, new Error("x"))).toBe(false);
    expect(retryRateLimitedOnly(0, new RateLimitError(5))).toBe(true);
    expect(retryRateLimitedOnly(1, new RateLimitError(5))).toBe(false);
  });
});
