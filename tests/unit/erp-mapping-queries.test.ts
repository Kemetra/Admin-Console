import { beforeEach, describe, expect, test, vi } from "vitest";

const GET = vi.fn();
const POST = vi.fn();
vi.mock("@/generated/client", () => ({
  apiClient: { GET: (...a: unknown[]) => GET(...a), POST: (...a: unknown[]) => POST(...a) },
}));

import {
  tenantAdminConfirmErpnextItemMapping,
  tenantAdminListErpnextItemMappings,
  tenantAdminListErpnextWarehouseMappings,
  tenantAdminRetireErpnextItemMapping,
  tenantAdminRetireErpnextWarehouseMapping,
  tenantAdminSetErpnextWarehouseMapping,
  tenantAdminSuggestErpnextItemMapping,
} from "@/lib/erp-mapping-queries";

/** RT-725 wrappers: one generated-client call each, the contract path, no retry. */
const ID = "0190f000-0000-7000-8000-0000000000b1";
const STORE = "0190f000-0000-7000-8000-0000000000a1";
const PRODUCT = "0190f000-0000-7000-8000-0000000000c1";

function answer(status: number, data?: unknown, headers: Record<string, string> = {}) {
  return {
    data,
    error: status >= 400 ? { error: { code: "x", message: "x" } } : undefined,
    response: new Response(null, { status, headers }),
  };
}

beforeEach(() => {
  GET.mockReset();
  POST.mockReset();
});

describe("ERPNext mapping wrappers (RT-725)", () => {
  test("list items: no filter sends an empty query; a state filter is passed through", async () => {
    GET.mockResolvedValue(answer(200, { items: [] }));
    await expect(tenantAdminListErpnextItemMappings()).resolves.toMatchObject({
      status: 200,
      data: { items: [] },
    });
    expect(GET).toHaveBeenCalledWith("/api/v1/catalog/erpnext-item-mappings", {
      params: { query: {} },
    });
    await tenantAdminListErpnextItemMappings("suggested");
    expect(GET).toHaveBeenLastCalledWith("/api/v1/catalog/erpnext-item-mappings", {
      params: { query: { state: "suggested" } },
    });
  });

  test("suggest posts the product id and the reference only", async () => {
    POST.mockResolvedValue(answer(201, { id: ID }));
    const body = { tenant_product_id: PRODUCT, erpnext_item_ref: "ITEM-1" };
    await expect(tenantAdminSuggestErpnextItemMapping(body)).resolves.toMatchObject({
      status: 201,
    });
    expect(POST).toHaveBeenCalledWith("/api/v1/catalog/erpnext-item-mappings", { body });
  });

  test("confirm and retire carry the id in the path and the version in the body", async () => {
    POST.mockResolvedValue(answer(200, { id: ID }));
    await tenantAdminConfirmErpnextItemMapping(ID, 3);
    expect(POST).toHaveBeenLastCalledWith("/api/v1/catalog/erpnext-item-mappings/{id}/confirm", {
      params: { path: { id: ID } },
      body: { version: 3 },
    });
    await tenantAdminRetireErpnextItemMapping(ID, 4);
    expect(POST).toHaveBeenLastCalledWith("/api/v1/catalog/erpnext-item-mappings/{id}/retire", {
      params: { path: { id: ID } },
      body: { version: 4 },
    });
    await tenantAdminRetireErpnextWarehouseMapping(ID, 5);
    expect(POST).toHaveBeenLastCalledWith(
      "/api/v1/catalog/erpnext-warehouse-mappings/{id}/retire",
      { params: { path: { id: ID } }, body: { version: 5 } },
    );
    expect(POST).toHaveBeenCalledTimes(3);
  });

  test("warehouse list and set", async () => {
    GET.mockResolvedValue(answer(200, { items: [] }));
    await tenantAdminListErpnextWarehouseMappings();
    expect(GET).toHaveBeenCalledWith("/api/v1/catalog/erpnext-warehouse-mappings", {});
    POST.mockResolvedValue(answer(201, { id: ID }));
    const body = { store_id: STORE, erpnext_warehouse_ref: "Stores - NS" };
    await tenantAdminSetErpnextWarehouseMapping(body);
    expect(POST).toHaveBeenCalledWith("/api/v1/catalog/erpnext-warehouse-mappings", { body });
  });

  test("a 429 reports its Retry-After seconds (shared classifier); another status does not", async () => {
    POST.mockResolvedValueOnce(answer(429, undefined, { "Retry-After": "30" }));
    await expect(tenantAdminConfirmErpnextItemMapping(ID, 1)).resolves.toMatchObject({
      status: 429,
      retryAfter: 30,
    });
    POST.mockResolvedValueOnce(answer(429, undefined, { "Retry-After": "soon" }));
    expect((await tenantAdminConfirmErpnextItemMapping(ID, 1)).retryAfter).toBe(30);
    POST.mockResolvedValueOnce(answer(429, undefined, { "Retry-After": "99999" }));
    expect((await tenantAdminConfirmErpnextItemMapping(ID, 1)).retryAfter).toBe(3600);
    POST.mockResolvedValueOnce(answer(409, undefined, { "Retry-After": "30" }));
    expect((await tenantAdminConfirmErpnextItemMapping(ID, 1)).retryAfter).toBeUndefined();
  });

  test("a request with no answer rejects once; nothing is retried", async () => {
    POST.mockRejectedValue(new TypeError("network"));
    await expect(tenantAdminRetireErpnextItemMapping(ID, 1)).rejects.toThrow("network");
    expect(POST).toHaveBeenCalledTimes(1);
  });
});
