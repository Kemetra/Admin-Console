/**
 * RT-587 data layer: typed wrappers over the generated `apiClient` for the two
 * read operations of the Backend-Core console sales read (RT-561 / RT-562):
 *
 *   - `consoleListSales`: one store's received sales over an inclusive
 *     business-date range, newest first, keyset paged.
 *   - `consoleGetSale`: the full recorded detail of one sale.
 *
 * Boundary: only these TWO ops are wrapped and nothing here writes (spec 012
 * FR-010). No POS route and no ERP call (FR-002 / FR-003). Same
 * `{ status, data?, error? }` shape as `src/lib/device-queries.ts`; cookie
 * transport is on the generated client. No hand-rolled fetch.
 */
import { apiClient } from "@/generated/client";
import type { ConsoleSalesSchema } from "@/generated/schema";

type Schemas = ConsoleSalesSchema.components["schemas"];

// --- Generated projections (no hand-typed shapes) -----------------------------

export type SaleItem = Schemas["ConsoleSaleItem"];
export type SalePage = Schemas["ConsoleSalePage"];
export type SaleDetail = Schemas["ConsoleSaleDetail"];
export type SaleLine = Schemas["SaleHistoryLine"];
export type SaleTender = Schemas["SaleTenderView"];
export type SaleReturn = Schemas["ReturnSummary"];
export type SaleVoid = Schemas["VoidSummary"];
export type ErpPostingView = Schemas["ErpPostingView"];
export type SyncStatus = Schemas["SyncStatus"];
export type ReturnState = Schemas["ReturnState"];
export type ErpPostingState = Schemas["ErpPostingState"];
export type NameSource = Schemas["NameSource"];
export type SaleListQuery =
  ConsoleSalesSchema.operations["consoleListSales"]["parameters"]["query"];

// --- Typed operation wrappers -------------------------------------------------

/** GET /api/v1/sales */
export async function consoleListSales(query: SaleListQuery) {
  const { data, error, response } = await apiClient.GET("/api/v1/sales", {
    params: { query },
  });
  return { status: response.status, data, error };
}

/** GET /api/v1/sales/{saleRef}: a refusal is the same non-disclosing 404. */
export async function consoleGetSale(saleRef: string) {
  const { data, error, response } = await apiClient.GET("/api/v1/sales/{saleRef}", {
    params: { path: { saleRef } },
  });
  return { status: response.status, data, error };
}
