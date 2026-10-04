import { beforeEach, describe, expect, test, vi } from "vitest";

const GET = vi.fn();
const POST = vi.fn();
vi.mock("@/generated/client", () => ({
  apiClient: { GET: (...a: unknown[]) => GET(...a), POST: (...a: unknown[]) => POST(...a) },
}));

import {
  listErpnextNegativeOnHand,
  listErpnextNegativeOnHandStores,
  triggerReconciliationRun,
} from "@/lib/stock-discrepancy-queries";

const STORE = "0190f000-0000-7000-8000-0000000000a1";

function response(status: number, headers: Record<string, string> = {}) {
  return { status, headers: new Headers(headers) };
}

/**
 * RT-178 wrappers: each calls exactly its generated path with the contract's
 * params, and returns the uniform `{ status, data, error }` shape.
 */
describe("stock discrepancy wrappers", () => {
  beforeEach(() => {
    GET.mockReset();
    POST.mockReset();
  });

  test("listErpnextNegativeOnHandStores passes cursor/limit as query", async () => {
    GET.mockResolvedValue({ data: { items: [], nextCursor: null }, response: response(200) });
    const res = await listErpnextNegativeOnHandStores({ cursor: "abc", limit: 50 });
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/catalog/erpnext-reconciliation/negative-on-hand/stores",
      { params: { query: { cursor: "abc", limit: 50 } } },
    );
    expect(res).toEqual({ status: 200, data: { items: [], nextCursor: null }, error: undefined });
  });

  test("listErpnextNegativeOnHand passes storeId as a path param", async () => {
    const error = { error: { code: "not_found", message: "Not found" } };
    GET.mockResolvedValue({ error, response: response(404) });
    const res = await listErpnextNegativeOnHand(STORE);
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/catalog/erpnext-reconciliation/stores/{storeId}/negative-on-hand",
      { params: { path: { storeId: STORE }, query: {} } },
    );
    expect(res.status).toBe(404);
    expect(res.error).toEqual(error);
  });

  test("triggerReconciliationRun sends the Idempotency-Key header and { storeId } body", async () => {
    POST.mockResolvedValue({ data: { id: "r1" }, response: response(201) });
    const key = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const res = await triggerReconciliationRun(STORE, key);
    expect(POST).toHaveBeenCalledWith("/api/v1/catalog/erpnext-reconciliation/runs", {
      params: { header: { "Idempotency-Key": key } },
      body: { storeId: STORE },
    });
    expect(res.status).toBe(201);
    expect(res.headers).toBeInstanceOf(Headers);
  });
});
