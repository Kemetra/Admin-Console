/**
 * RT-765 / RT-766 data layer: typed wrappers over the generated `apiClient` for
 * the three read operations the catalog list and detail need from Backend-Core's
 * console catalog contract (`catalog/console-catalog.yaml`, RT-729 / RT-730):
 *
 *   - `consoleListCatalogProducts`: the tenant's products, keyset paged, with a
 *     store's resolved values when `store_id` is given.
 *   - `consoleListCatalogCategories`: the flat category list for the filter.
 *   - `consoleGetCatalogProduct`: one product with its active identifiers and
 *     its raw store overrides (never resolved: RT-752 D8).
 *
 * Boundary: only these THREE reads are wrapped and nothing here writes. The
 * catalog writes (RT-738) belong to the CAT-C2 slices. No POS route and no ERP
 * call. Same `{ status, data?, error? }` shape as `src/lib/sale-queries.ts`;
 * cookie transport is on the generated client. No hand-rolled fetch.
 */
import { apiClient } from "@/generated/client";
import type { ConsoleCatalogSchema } from "@/generated/schema";

type Schemas = ConsoleCatalogSchema.components["schemas"];

// --- Generated projections (no hand-typed shapes) -----------------------------

export type CatalogProduct = Schemas["ConsoleCatalogProductSummary"];
export type CatalogProductPage = Schemas["ConsoleCatalogProductPage"];
export type CatalogProductDetail = Schemas["ConsoleCatalogProductDetail"];
export type CatalogIdentifier = Schemas["ProductIdentifier"];
export type CatalogStoreOverride = Schemas["StoreOverride"];
export type CatalogMoney = Schemas["Money"];
export type CatalogCategory = Schemas["ConsoleCatalogCategory"];
export type CatalogStatusFilter = Schemas["ProductStatusFilter"];
export type CatalogListQuery =
  ConsoleCatalogSchema.operations["consoleListCatalogProducts"]["parameters"]["query"];

// --- Typed operation wrappers -------------------------------------------------

/** GET /api/v1/catalog/products */
export async function consoleListCatalogProducts(query: CatalogListQuery) {
  const { data, error, response } = await apiClient.GET("/api/v1/catalog/products", {
    params: { query },
  });
  return { status: response.status, data, error };
}

/** GET /api/v1/catalog/categories */
export async function consoleListCatalogCategories() {
  const { data, error, response } = await apiClient.GET("/api/v1/catalog/categories");
  return { status: response.status, data, error };
}

/** GET /api/v1/catalog/products/{productId} */
export async function consoleGetCatalogProduct(productId: string) {
  const { data, error, response } = await apiClient.GET("/api/v1/catalog/products/{productId}", {
    params: { path: { productId } },
  });
  return { status: response.status, data, error };
}
