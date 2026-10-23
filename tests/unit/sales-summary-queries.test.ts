import { beforeEach, describe, expect, test, vi } from "vitest";

const GET = vi.fn();
vi.mock("@/generated/client", () => ({
  apiClient: { GET: (...a: unknown[]) => GET(...a) },
}));

import {
  SALES_SUMMARY_MAX_SPAN_DAYS,
  consoleGetSalesSummary,
  mapSalesSummaryError,
  salesSummaryRangeProblem,
} from "@/lib/sales-summary-queries";

const STORE = "0190f000-0000-7000-8000-0000000000a1";
const REQUEST_ID = "0190f000-0000-7000-8000-0000000000b2";
const RANGE = { from: "2026-10-01", to: "2026-10-07" };

function envelope(code: string, requestId = REQUEST_ID) {
  return { error: { code, message: "x", request_id: requestId } };
}

describe("consoleGetSalesSummary wrapper", () => {
  beforeEach(() => GET.mockReset());

  test("calls GET /api/v1/sales-summary with the query and returns the uniform shape", async () => {
    const data = { scope: "store" };
    GET.mockResolvedValue({ data, response: { status: 200 } });
    const query = { store_id: STORE, ...RANGE, page_size: 10 };
    const res = await consoleGetSalesSummary(query);
    expect(GET).toHaveBeenCalledWith("/api/v1/sales-summary", { params: { query } });
    expect(res).toEqual({ status: 200, data, error: undefined });
  });

  test("passes a refusal through as status + error", async () => {
    const error = envelope("not_found");
    GET.mockResolvedValue({ error, response: { status: 404 } });
    const res = await consoleGetSalesSummary(RANGE);
    expect(res).toEqual({ status: 404, data: undefined, error });
  });
});

describe("salesSummaryRangeProblem", () => {
  test("accepts a same-day and a 31-day inclusive range", () => {
    expect(salesSummaryRangeProblem({ from: "2026-10-01", to: "2026-10-01" })).toBeNull();
    expect(SALES_SUMMARY_MAX_SPAN_DAYS).toBe(30);
    expect(salesSummaryRangeProblem({ from: "2026-10-01", to: "2026-10-31" })).toBeNull();
  });

  test("flags to before from", () => {
    expect(salesSummaryRangeProblem({ from: "2026-10-02", to: "2026-10-01" })).toBe(
      "to-before-from",
    );
  });

  test("flags a range wider than 31 business days", () => {
    expect(salesSummaryRangeProblem({ from: "2026-10-01", to: "2026-11-01" })).toBe(
      "range-too-wide",
    );
  });

  test("does not guess on a value it cannot parse", () => {
    expect(salesSummaryRangeProblem({ from: "nope", to: "2026-10-01" })).toBeNull();
  });
});

describe("mapSalesSummaryError", () => {
  test("400 with a bad range is a range error carrying the problem and request id", () => {
    const render = mapSalesSummaryError({
      status: 400,
      error: envelope("validation_error"),
      query: { from: "2026-10-05", to: "2026-10-01" },
    });
    expect(render).toEqual({
      kind: "range",
      problem: "to-before-from",
      requestId: REQUEST_ID,
    });
  });

  test("400 with a too-wide range is a range error", () => {
    const render = mapSalesSummaryError({
      status: 400,
      error: envelope("validation_error"),
      query: { from: "2026-01-01", to: "2026-03-01" },
    });
    expect(render).toMatchObject({ kind: "range", problem: "range-too-wide" });
  });

  test("400 with a valid range is a field error (cursor, page_size, store_id, date)", () => {
    const render = mapSalesSummaryError({
      status: 400,
      error: envelope("validation_error"),
      query: { ...RANGE, cursor: "stale" },
    });
    expect(render).toEqual({ kind: "field", requestId: REQUEST_ID });
  });

  test("400 without the request is a field error", () => {
    expect(mapSalesSummaryError({ status: 400 })).toEqual({
      kind: "field",
      requestId: undefined,
    });
  });

  test("404 is one non-disclosing answer: no request id, no cause", () => {
    const render = mapSalesSummaryError({ status: 404, error: envelope("not_found") });
    expect(render).toEqual({ kind: "not-found" });
  });

  test("429 defers to the RateLimitBanner and carries no copy of its own", () => {
    const render = mapSalesSummaryError({ status: 429, error: envelope("RATE_LIMITED") });
    expect(render).toEqual({ kind: "rate-limited" });
  });

  test("500 is a retryable banner with the request id and the shared server copy", () => {
    const render = mapSalesSummaryError({ status: 500, error: envelope("system_failure") });
    expect(render).toEqual({
      kind: "server",
      messageKey: "errors.server",
      requestId: REQUEST_ID,
      retryable: true,
    });
  });

  test("any other 5xx is the same server decision", () => {
    expect(mapSalesSummaryError({ status: 503 })).toMatchObject({ kind: "server" });
  });

  test("401 and undocumented statuses are generic (the auth interceptor owns the session)", () => {
    expect(mapSalesSummaryError({ status: 401, error: envelope("unauthenticated") })).toEqual({
      kind: "generic",
      messageKey: "errors.generic",
      requestId: REQUEST_ID,
    });
    expect(mapSalesSummaryError({ status: 418 })).toMatchObject({ kind: "generic" });
  });
});
