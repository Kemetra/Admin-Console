/**
 * RT-768 mutation hooks for the two product writes (CAT-C2a): edit (PATCH) and
 * retire (POST). Neither takes an Idempotency-Key in the contract: the
 * `expectedUpdatedAt` precondition is what makes a repeated request safe (a
 * second one is a 409 `stale_write`). The query client sets `mutations.retry:
 * false`, so nothing here retries on its own; the operator decides.
 *
 * A result carries the mapped failure (`mapProductWriteError`), so components
 * branch on data, not on thrown errors. A request that never completed throws
 * and the component shows its generic banner.
 *
 * On success the returned detail replaces the cached product and the item lists
 * are marked stale, so the next list read sees the change. Nothing else is
 * cached across a scope change: every key carries the tenant.
 */
import {
  type CatalogProductDetail,
  type CatalogProductUpdate,
  consoleRetireCatalogProduct,
  consoleUpdateCatalogProduct,
} from "@/lib/catalog-queries";
import { requestIdOf } from "@/shift-closes/shiftCloseLogic";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type ProductWriteOp,
  type ProductWriteRender,
  mapProductWriteError,
} from "./productFormLogic";
import { catalogProductKey, normalizeProduct } from "./useCatalogProduct";
import { pickerQueryKeys } from "./useProductPicker";

export type ProductWriteResult =
  | { ok: true; detail: CatalogProductDetail }
  | { ok: false; render: ProductWriteRender };

interface WriteResponse {
  status: number;
  data?: CatalogProductDetail;
  error?: unknown;
}

function codeOf(error: unknown): string | undefined {
  return (error as { error?: { code?: string } } | undefined)?.error?.code;
}

function resultOf(op: ProductWriteOp, res: WriteResponse): ProductWriteResult {
  if (res.status < 400 && res.data) return { ok: true, detail: normalizeProduct(res.data) };
  return {
    ok: false,
    render: mapProductWriteError({
      op,
      status: res.status,
      code: codeOf(res.error),
      requestId: requestIdOf(res.error),
    }),
  };
}

/** The item lists and the shared product picker (RT-767) both show names and status. */
function markListsStale(qc: QueryClient, tenantId: string | null): void {
  void qc.invalidateQueries({ queryKey: ["catalog", "products", tenantId] });
  void qc.invalidateQueries({ queryKey: pickerQueryKeys.all(tenantId) });
}

/** After a write: the cache holds the server's answer, the lists are stale. */
function settle(
  qc: QueryClient,
  tenantId: string | null,
  productId: string,
  result: ProductWriteResult,
): void {
  if (result.ok) {
    qc.setQueryData(catalogProductKey(tenantId, productId), result.detail);
    markListsStale(qc, tenantId);
  } else if (result.render.kind === "retired" || result.render.kind === "stale") {
    // The item moved under the user. Mark it stale without reading it now: the
    // form on screen keeps what was typed, and the next view of it re-reads.
    void qc.invalidateQueries({
      queryKey: catalogProductKey(tenantId, productId),
      refetchType: "none",
    });
    markListsStale(qc, tenantId);
  }
}

export function useUpdateProduct(tenantId: string | null, productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CatalogProductUpdate): Promise<ProductWriteResult> =>
      resultOf("update", await consoleUpdateCatalogProduct(productId, body)),
    onSuccess: (result) => settle(qc, tenantId, productId, result),
  });
}

export function useRetireProduct(tenantId: string | null, productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expectedUpdatedAt: string): Promise<ProductWriteResult> =>
      resultOf("retire", await consoleRetireCatalogProduct(productId, expectedUpdatedAt)),
    onSuccess: (result) => settle(qc, tenantId, productId, result),
  });
}
