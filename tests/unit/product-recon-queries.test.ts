import { beforeEach, describe, expect, test, vi } from "vitest";

const GET = vi.fn();
const POST = vi.fn();
vi.mock("@/generated/client", () => ({
  apiClient: { GET: (...a: unknown[]) => GET(...a), POST: (...a: unknown[]) => POST(...a) },
}));

import {
  getProductReconciliationRunResults,
  listProductReconciliationBacklog,
  listProductReconciliationRuns,
  repairProductMapping,
  triggerProductReconciliationRun,
} from "@/lib/product-reconciliation-queries";
import { PRODUCT_A, RUN_A } from "./product-recon-fixtures";

const KEY = "0f8fad5b-d9cb-469f-a165-70867728950e";
const BASE = "/api/v1/catalog/erpnext-product-reconciliation";

function response(status: number, headers: Record<string, string> = {}) {
  return { status, headers: new Headers(headers) };
}

/**
 * RT-727 wrappers: each calls exactly its generated path with the contract's
 * params and returns `{ status, data, error, retryAfterSeconds }`.
 */
describe("product reconciliation wrappers", () => {
  beforeEach(() => {
    GET.mockReset();
    POST.mockReset();
  });

  test("listProductReconciliationBacklog passes cursor, limit and class as query", async () => {
    GET.mockResolvedValue({ data: { items: [], nextCursor: null }, response: response(200) });
    const res = await listProductReconciliationBacklog({
      cursor: RUN_A,
      limit: 50,
      class: "unmapped_dp2_product",
    });
    expect(GET).toHaveBeenCalledWith(`${BASE}/backlog`, {
      params: { query: { cursor: RUN_A, limit: 50, class: "unmapped_dp2_product" } },
    });
    expect(res).toEqual({
      status: 200,
      data: { items: [], nextCursor: null },
      error: undefined,
      retryAfterSeconds: undefined,
    });
  });

  test("listProductReconciliationRuns is a GET on the runs path", async () => {
    GET.mockResolvedValue({ data: { items: [], nextCursor: null }, response: response(200) });
    await listProductReconciliationRuns();
    expect(GET).toHaveBeenCalledWith(`${BASE}/runs`, { params: { query: {} } });
  });

  test("triggerProductReconciliationRun sends the Idempotency-Key and the empty v1 body", async () => {
    POST.mockResolvedValue({ data: { id: RUN_A }, response: response(201) });
    const res = await triggerProductReconciliationRun(KEY);
    expect(POST).toHaveBeenCalledWith(`${BASE}/runs`, {
      params: { header: { "Idempotency-Key": KEY } },
      body: {},
    });
    expect(res.status).toBe(201);
  });

  test("getProductReconciliationRunResults passes runId as a path param", async () => {
    const error = { error: { code: "not_found", message: "Run not found." } };
    GET.mockResolvedValue({ error, response: response(404) });
    const res = await getProductReconciliationRunResults(RUN_A, { class: "attribute_drift" });
    expect(GET).toHaveBeenCalledWith(`${BASE}/runs/{runId}/results`, {
      params: { path: { runId: RUN_A }, query: { class: "attribute_drift" } },
    });
    expect(res.status).toBe(404);
    expect(res.error).toEqual(error);
  });

  test("repairProductMapping sends the Idempotency-Key and the strict body", async () => {
    POST.mockResolvedValue({ data: { outcome: "mapped" }, response: response(201) });
    const body = {
      repairKind: "suggest_confirm" as const,
      tenantProductId: PRODUCT_A,
      erpnextItemRef: "ITEM-1",
    };
    await repairProductMapping(body, KEY);
    expect(POST).toHaveBeenCalledWith(`${BASE}/repairs`, {
      params: { header: { "Idempotency-Key": KEY } },
      body,
    });
  });

  test("a 429 carries the parsed Retry-After; other statuses never do", async () => {
    POST.mockResolvedValue({ error: {}, response: response(429, { "Retry-After": "17" }) });
    expect((await triggerProductReconciliationRun(KEY)).retryAfterSeconds).toBe(17);
    GET.mockResolvedValue({ error: {}, response: response(429, { "Retry-After": "soon" }) });
    expect((await listProductReconciliationRuns()).retryAfterSeconds).toBeUndefined();
    GET.mockResolvedValue({ error: {}, response: response(503, { "Retry-After": "5" }) });
    expect((await listProductReconciliationBacklog()).retryAfterSeconds).toBeUndefined();
  });
});
