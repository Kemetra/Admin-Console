/**
 * RT-18 data layer: typed wrappers over the generated `apiClient` for the two
 * read-only shift-close operations of the Backend-Core admin read (RT-383):
 *
 *   - `consoleListShiftCloses`: recorded closes, newest first, keyset paged.
 *   - `consoleGetShiftClose`: one close with its cash movements.
 *
 * Boundary: only these TWO ops are wrapped. There is no write, no policy field
 * and no `approverCheck` (RT-384 / RT-385 are not in the contract). Same
 * `{ status, data?, error? }` shape as `src/lib/stock-discrepancy-queries.ts`;
 * cookie transport is on the generated client. No hand-rolled fetch.
 */
import { apiClient } from "@/generated/client";
import type { ShiftClosesSchema } from "@/generated/schema";

type Schemas = ShiftClosesSchema.components["schemas"];

// --- Generated projections (no hand-typed shapes) -----------------------------

export type ShiftCloseSummary = Schemas["ShiftCloseSummary"];
export type ShiftClosePage = Schemas["ShiftClosePage"];
export type ShiftCloseDetail = Schemas["ShiftCloseDetail"];
export type ShiftCashMovement = Schemas["ShiftCashMovement"];
export type CloseKind = Schemas["CloseKind"];
export type ApprovalFilter = ShiftClosesSchema.components["parameters"]["ApprovalQuery"];
export type ShiftCloseListQuery = NonNullable<
  ShiftClosesSchema.operations["consoleListShiftCloses"]["parameters"]["query"]
>;

// --- Typed operation wrappers -------------------------------------------------

/** GET /api/v1/shift-closes */
export async function consoleListShiftCloses(query: ShiftCloseListQuery = {}) {
  const { data, error, response } = await apiClient.GET("/api/v1/shift-closes", {
    params: { query },
  });
  return { status: response.status, data, error };
}

/** GET /api/v1/shift-closes/{shiftId}: a refusal is the same non-disclosing 404. */
export async function consoleGetShiftClose(shiftId: string) {
  const { data, error, response } = await apiClient.GET("/api/v1/shift-closes/{shiftId}", {
    params: { path: { shiftId } },
  });
  return { status: response.status, data, error };
}
