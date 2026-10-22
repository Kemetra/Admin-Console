/**
 * RT-766 query hook: one product's detail through `consoleGetCatalogProduct`
 * (read-only). Keyed by the active tenant and the product id; the detail takes
 * no store, so a store change does not refetch it. Errors are typed, never raw:
 * a 404 is the API's uniform non-disclosing refusal and a 400 (a rejected id)
 * reads the same way, a 401 is an expired session, a 429 is rate limiting (the
 * shared clock behind the gated Retry owns the countdown, RT-621).
 */
import { type CatalogProductDetail, consoleGetCatalogProduct } from "@/lib/catalog-queries";
import { requestIdOf } from "@/shift-closes/shiftCloseLogic";
import { useStoreList } from "@/stores/useStoreQueries";
import { useQuery } from "@tanstack/react-query";
import { storeNameMap } from "./catalogDetailLogic";

export type CatalogProductError = {
  kind: "not-found" | "session" | "rate-limited" | "generic";
  requestId?: string;
};

export const catalogProductKey = (tenantId: string | null, productId: string) =>
  ["catalog", "product", tenantId, productId] as const;

class ProductFetchError extends Error {
  constructor(readonly detail: CatalogProductError) {
    super("catalog-product");
  }
}

const STATUS_KINDS: Record<number, CatalogProductError["kind"]> = {
  400: "not-found",
  401: "session",
  404: "not-found",
  429: "rate-limited",
};

function errorOf(error: unknown): CatalogProductError | undefined {
  if (!error) return undefined;
  return error instanceof ProductFetchError ? error.detail : { kind: "generic" };
}

/** A body without the lists is a product with none: the sections say so. */
function normalize(detail: CatalogProductDetail): CatalogProductDetail {
  return {
    ...detail,
    identifiers: detail.identifiers ?? [],
    storeOverrides: detail.storeOverrides ?? [],
  };
}

export interface CatalogProductState {
  product?: CatalogProductDetail;
  isLoading: boolean;
  error?: CatalogProductError;
  retry: () => void;
}

/** `productId: null` (an id the API would refuse) or no tenant reads nothing. */
export function useCatalogProduct(
  tenantId: string | null,
  productId: string | null,
): CatalogProductState {
  const active = Boolean(tenantId) && productId !== null;
  const result = useQuery({
    queryKey: catalogProductKey(tenantId, productId ?? ""),
    enabled: active,
    retry: false,
    queryFn: async () => {
      const res = await consoleGetCatalogProduct(productId as string);
      if (res.status >= 400 || !res.data) {
        throw new ProductFetchError({
          kind: STATUS_KINDS[res.status] ?? "generic",
          requestId: requestIdOf(res.error),
        });
      }
      return normalize(res.data);
    },
  });
  return {
    product: result.data,
    isLoading: active && result.isLoading,
    error: errorOf(result.error),
    retry: () => void result.refetch(),
  };
}

/** A store as the page labels it: its name when known, else only its id. */
export interface StoreLabel {
  id: string;
  name: string | null;
}

/**
 * Store names for the overrides and scoped identifiers. The detail carries only
 * store ids; names come from the stores read the console already has. This is
 * a convenience, never a dependency: while it loads, or when it fails or
 * answers with anything but a list, the page keeps the id. The active store's
 * name comes from the scope and needs no read.
 */
export function useStoreLabels(
  tenantId: string | null,
  active: { id: string | null; name: string | null },
  needed: boolean,
): (id: string) => StoreLabel {
  const { result } = useStoreList(needed ? tenantId : null);
  const names = storeNameMap(result?.kind === "rows" ? result.rows : [], active);
  return (id) => ({ id, name: names.get(id) ?? null });
}
