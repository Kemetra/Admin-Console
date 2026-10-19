import { beforeEach, describe, expect, test, vi } from "vitest";

const GET = vi.fn();
const POST = vi.fn();
vi.mock("@/generated/client", () => ({
  apiClient: { GET: (...a: unknown[]) => GET(...a), POST: (...a: unknown[]) => POST(...a) },
}));

import {
  consoleGetSaleAuditTimeline,
  consoleGetSaleSyncStatus,
  consoleListNeedsRepair,
  consoleRepairSaleSync,
} from "@/lib/sale-sync-ops-queries";

const SALE = "0190f000-0000-7000-8000-0000000007b1";
const STORE = "0190f000-0000-7000-8000-0000000007a1";
const KEY = "0f8fad5b-d9cb-469f-a165-70867728950e";

function response(status: number, headers: Record<string, string> = {}) {
  return { status, headers: new Headers(headers) };
}

/**
 * RT-726 wrappers: each calls exactly its generated path with the contract's
 * params and returns `{ status, data, error, retryAfter }`.
 */
describe("sale sync-ops wrappers", () => {
  beforeEach(() => {
    GET.mockReset();
    POST.mockReset();
  });

  test("consoleGetSaleSyncStatus reads one sale by its path ref", async () => {
    GET.mockResolvedValue({ data: { saleRef: SALE }, response: response(200) });
    const res = await consoleGetSaleSyncStatus(SALE);
    expect(GET).toHaveBeenCalledWith("/api/v1/catalog/sale-sync-ops/sales/{saleRef}/status", {
      params: { path: { saleRef: SALE } },
    });
    expect(res).toEqual({
      status: 200,
      data: { saleRef: SALE },
      error: undefined,
      retryAfter: undefined,
    });
  });

  test("consoleGetSaleAuditTimeline reads the timeline path", async () => {
    const error = { error: { code: "not_found", message: "Not found." } };
    GET.mockResolvedValue({ error, response: response(404) });
    const res = await consoleGetSaleAuditTimeline(SALE);
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/catalog/sale-sync-ops/sales/{saleRef}/audit-timeline",
      { params: { path: { saleRef: SALE } } },
    );
    expect(res.status).toBe(404);
    expect(res.error).toEqual(error);
  });

  test("consoleListNeedsRepair passes store_id and cursor as query", async () => {
    GET.mockResolvedValue({ data: { items: [], nextCursor: null }, response: response(200) });
    await consoleListNeedsRepair({ store_id: STORE, cursor: SALE });
    expect(GET).toHaveBeenCalledWith("/api/v1/catalog/sale-sync-ops/needs-repair", {
      params: { query: { store_id: STORE, cursor: SALE } },
    });
  });

  test("consoleRepairSaleSync POSTs with the caller's Idempotency-Key and no body", async () => {
    POST.mockResolvedValue({ data: { saleRef: SALE }, response: response(200) });
    const res = await consoleRepairSaleSync(SALE, KEY);
    expect(POST).toHaveBeenCalledTimes(1);
    expect(POST).toHaveBeenCalledWith("/api/v1/catalog/sale-sync-ops/sales/{saleRef}/repair", {
      params: { path: { saleRef: SALE }, header: { "Idempotency-Key": KEY } },
    });
    expect(res.status).toBe(200);
  });

  test("a 429 surfaces its Retry-After seconds", async () => {
    const error = { error: { code: "rate_limited", message: "Too many requests." } };
    GET.mockResolvedValue({ error, response: response(429, { "Retry-After": "12" }) });
    expect((await consoleListNeedsRepair({})).retryAfter).toBe(12);
  });

  test("an unusable Retry-After falls back to 30 s; one on another status is ignored", async () => {
    GET.mockResolvedValue({ response: response(429, { "Retry-After": "soon" }) });
    expect((await consoleGetSaleSyncStatus(SALE)).retryAfter).toBe(30);
    GET.mockResolvedValue({ response: response(429, { "Retry-After": "0" }) });
    expect((await consoleGetSaleSyncStatus(SALE)).retryAfter).toBe(1);
    POST.mockResolvedValue({ response: response(503, { "Retry-After": "5" }) });
    expect((await consoleRepairSaleSync(SALE, KEY)).retryAfter).toBeUndefined();
  });
});
