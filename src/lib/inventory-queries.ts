/**
 * RT-728 data layer: typed wrappers over the generated `apiClient` for the four
 * READ operations of the Backend-Core inventory contract
 * (`inventory/inventory.yaml`):
 *
 *   - `listStockMovements`: a store's movement ledger, newest first, keyset
 *     paged. Always sent with `scope=all` (RT-731: every movement of the store,
 *     across every product and ad-hoc) and never with `productId`, which the
 *     API refuses together with `scope`.
 *   - `listStockLocations`: a store's stock locations, primary first.
 *   - `getOnHand`: the derived on-hand of one (store, product).
 *   - `listTrackingIdentities`: a product's batches / serials (owner /
 *     tenant_admin; any other role is a non-disclosing 404).
 *
 * Boundary: reads only. `createStockMovement`, `createStockTransfer`,
 * `recordStockCount` and the sale-linked backfill are NOT wrapped and NOT
 * called (RT-728 non-goals). Same `{ status, data?, error?, retryAfter? }`
 * shape as `src/lib/sale-sync-ops-queries.ts`. Cookie transport is on the
 * generated client.
 */
import { apiClient } from "@/generated/client";
import type { InventorySchema } from "@/generated/schema";
import { classifyRateLimit } from "@/lib/rate-limit";

type Schemas = InventorySchema.components["schemas"];

// --- Generated projections (no hand-typed shapes) -----------------------------

export type StockMovement = Schemas["StockMovement"];
export type StockMovementList = Schemas["StockMovementList"];
export type StockLocation = Schemas["StockLocation"];
export type StockLocationList = Schemas["StockLocationList"];
export type OnHand = Schemas["OnHand"];
export type InventoryStatus = Schemas["InventoryStatus"];
export type TrackingIdentity = Schemas["TrackingIdentity"];
export type TrackingIdentityList = Schemas["TrackingIdentityList"];

export interface PageQuery {
  cursor?: string;
  limit?: number;
}

/** A 429's wait in seconds via the shared RT-621 classifier (30 s fallback, [1, 3600]). */
function retryAfterOf(response: Response): number | undefined {
  return classifyRateLimit({
    status: response.status,
    retryAfter: response.headers.get("Retry-After"),
  })?.retryAfterSeconds;
}

function resultOf<D, E>(res: { data?: D; error?: E; response: Response }) {
  return {
    status: res.response.status,
    data: res.data,
    error: res.error,
    retryAfter: retryAfterOf(res.response),
  };
}

// --- Typed operation wrappers -------------------------------------------------

/** GET /api/inventory/v1/stores/{storeId}/movements?scope=all */
export async function listStoreMovements(storeId: string, query: PageQuery = {}) {
  return resultOf(
    await apiClient.GET("/api/inventory/v1/stores/{storeId}/movements", {
      params: { path: { storeId }, query: { ...query, scope: "all" } },
    }),
  );
}

/** GET /api/inventory/v1/stores/{storeId}/locations */
export async function listStockLocations(storeId: string) {
  return resultOf(
    await apiClient.GET("/api/inventory/v1/stores/{storeId}/locations", {
      params: { path: { storeId } },
    }),
  );
}

/** GET /api/inventory/v1/on-hand/{storeId}/{productId} */
export async function getOnHand(storeId: string, productId: string) {
  return resultOf(
    await apiClient.GET("/api/inventory/v1/on-hand/{storeId}/{productId}", {
      params: { path: { storeId, productId } },
    }),
  );
}

/** GET /api/inventory/v1/products/{productId}/tracking-identities */
export async function listTrackingIdentities(productId: string, query: PageQuery = {}) {
  return resultOf(
    await apiClient.GET("/api/inventory/v1/products/{productId}/tracking-identities", {
      params: { path: { productId }, query },
    }),
  );
}
