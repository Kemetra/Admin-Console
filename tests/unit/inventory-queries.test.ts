import { beforeEach, describe, expect, test, vi } from "vitest";

const GET = vi.fn();
vi.mock("@/generated/client", () => ({
  apiClient: { GET: (...a: unknown[]) => GET(...a) },
}));

import {
  getOnHand,
  listStockLocations,
  listStoreMovements,
  listTrackingIdentities,
} from "@/lib/inventory-queries";

const STORE = "0190f000-0000-7000-8000-0000000007a1";
const PRODUCT = "0190f000-0000-7000-8000-0000000007c1";

function response(status: number, headers: Record<string, string> = {}) {
  return { status, headers: new Headers(headers) };
}

/**
 * RT-728 wrappers: each calls exactly its generated path with the contract's
 * params and returns `{ status, data, error, retryAfter }`.
 */
describe("inventory read wrappers", () => {
  beforeEach(() => GET.mockReset());

  test("the store ledger always asks for scope=all and never sends productId", async () => {
    GET.mockResolvedValue({ data: { items: [], nextCursor: null }, response: response(200) });
    const res = await listStoreMovements(STORE, { cursor: "c1" });
    expect(GET).toHaveBeenCalledWith("/api/inventory/v1/stores/{storeId}/movements", {
      params: { path: { storeId: STORE }, query: { cursor: "c1", scope: "all" } },
    });
    expect(res).toEqual({
      status: 200,
      data: { items: [], nextCursor: null },
      error: undefined,
      retryAfter: undefined,
    });
  });

  test("a 429 carries the server's Retry-After through the shared classifier", async () => {
    GET.mockResolvedValue({
      error: { error: { code: "rate_limited", message: "x" } },
      response: response(429, { "Retry-After": "12" }),
    });
    expect((await listStoreMovements(STORE)).retryAfter).toBe(12);
    GET.mockResolvedValue({ error: {}, response: response(429) });
    expect((await listStockLocations(STORE)).retryAfter).toBe(30);
  });

  test("listStockLocations reads the store's locations", async () => {
    GET.mockResolvedValue({ data: { items: [] }, response: response(200) });
    await listStockLocations(STORE);
    expect(GET).toHaveBeenCalledWith("/api/inventory/v1/stores/{storeId}/locations", {
      params: { path: { storeId: STORE } },
    });
  });

  test("getOnHand reads one (store, product)", async () => {
    GET.mockResolvedValue({ data: {}, response: response(200) });
    await getOnHand(STORE, PRODUCT);
    expect(GET).toHaveBeenCalledWith("/api/inventory/v1/on-hand/{storeId}/{productId}", {
      params: { path: { storeId: STORE, productId: PRODUCT } },
    });
  });

  test("listTrackingIdentities pages one product's identities", async () => {
    GET.mockResolvedValue({ data: { items: [], nextCursor: null }, response: response(200) });
    await listTrackingIdentities(PRODUCT, { cursor: "n2" });
    expect(GET).toHaveBeenCalledWith("/api/inventory/v1/products/{productId}/tracking-identities", {
      params: { path: { productId: PRODUCT }, query: { cursor: "n2" } },
    });
  });
});
