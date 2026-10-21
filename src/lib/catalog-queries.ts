/**
 * RT-765 data layer: typed wrappers over the generated `apiClient` for the two
 * read operations the catalog list needs from Backend-Core's console catalog
 * contract (`catalog/console-catalog.yaml`, RT-729 / RT-730):
 *
 *   - `consoleListCatalogProducts`: the tenant's products, keyset paged, with a
 *     store's resolved values when `store_id` is given.
 *   - `consoleListCatalogCategories`: the flat category list for the filter.
 *
 * Boundary: only these TWO reads are wrapped and nothing here writes. The
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
