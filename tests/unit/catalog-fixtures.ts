/** RT-765 shared test data: console catalog list payloads (`console-catalog.yaml`). */
import type { CatalogProduct } from "@/lib/catalog-queries";

export const CAIRO_STORE = "0190f000-0000-7000-8000-0000000007a1";
export const NEW_YORK_STORE = "0190f000-0000-7000-8000-0000000007a2";
export const PRODUCT_1 = "0190f000-0000-7000-8000-0000000007b1";
export const PRODUCT_2 = "0190f000-0000-7000-8000-0000000007b2";
export const PRODUCT_3 = "0190f000-0000-7000-8000-0000000007b3";
export const CATEGORY_1 = "0190f000-0000-7000-8000-0000000007c1";
export const CATEGORY_2 = "0190f000-0000-7000-8000-0000000007c2";

export function ctx(role = "owner", tenantId: string | null = "t1", activeStoreId?: string) {
  return {
    context: {
      active_tenant: tenantId ? { id: tenantId, name: "Northstar Retail" } : null,
      active_store: activeStoreId ? { id: activeStoreId, name: "Cairo Festival" } : null,
      active_role_code: role,
    },
  };
}

export function product(over: Record<string, unknown> = {}): CatalogProduct {
  return {
    productId: PRODUCT_1,
    name: "Mineral water 1.5L",
    status: "active",
    categoryId: CATEGORY_1,
    categoryName: "Beverages",
    primarySku: "SKU-0042",
    primaryBarcode: "0012345678905",
    defaultPrice: { amount: "10.5000", currencyCode: "EGP" },
    taxCategory: "standard",
    trackingMode: "none",
    updatedAt: "2026-10-07T10:30:00Z",
    ...over,
  } as CatalogProduct;
}

/** A product as one store resolves it (`storeView`, present only with `store_id`). */
export function storeView(over: Record<string, unknown> = {}) {
  return {
    storeId: CAIRO_STORE,
    effectivePrice: { amount: "12.0000", currencyCode: "EGP" },
    effectiveActive: true,
    effectiveTaxCategory: "standard",
    hasOverride: false,
    ...over,
  };
}

export const categories = {
  status: 200,
  data: {
    items: [
      {
        categoryId: CATEGORY_1,
        name: "Beverages",
        description: null,
        updatedAt: "2026-10-01T08:00:00Z",
      },
      {
        categoryId: CATEGORY_2,
        name: "Snacks",
        description: null,
        updatedAt: "2026-10-01T08:00:00Z",
      },
    ],
  },
};

export function page(items: unknown[], nextCursor: string | null = null) {
  return { status: 200, data: { items, nextCursor } };
}

export function failure(status: number, requestId = "req-1") {
  return { status, error: { error: { code: "x", message: "y", request_id: requestId } } };
}
