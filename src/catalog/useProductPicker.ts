/**
 * RT-767 query for the shared product picker: one page of ACTIVE products from
 * `consoleListCatalogProducts`, keyed by tenant and by the search text. The key
 * carries the tenant, so a tenant change never shows another tenant's products.
 *
 * Reads are not retried, a 429 included: the operator tries again (the shell's
 * rate-limit banner owns the countdown, RT-621). The list is not the catalog
 * list: it keeps no pages, no cursor and no dedupe, because the picker never
 * walks past its first page; a longer list is narrowed by searching.
 */
import { type CatalogProduct, consoleListCatalogProducts } from "@/lib/catalog-queries";
import { requestIdOf } from "@/shift-closes/shiftCloseLogic";
import { useQuery } from "@tanstack/react-query";
import { PICKER_STATUS_KINDS, type PickerErrorKind, buildPickerQuery } from "./productPickerLogic";

export interface PickerError {
  kind: PickerErrorKind;
  requestId?: string;
}

export const pickerQueryKeys = {
  all: (tenantId: string | null) => ["catalog", "picker", tenantId] as const,
  search: (tenantId: string | null, q: string) => ["catalog", "picker", tenantId, q] as const,
};

class PickerFetchError extends Error {
  constructor(readonly detail: PickerError) {
    super("catalog-picker");
  }
}

interface PickerPage {
  products: CatalogProduct[];
  /** A cursor came back: more products exist than this page shows. */
  hasMore: boolean;
}

async function readPage(q: string): Promise<PickerPage> {
  const res = await consoleListCatalogProducts(buildPickerQuery(q));
  if (res.status >= 400 || !res.data) {
    throw new PickerFetchError({
      kind: PICKER_STATUS_KINDS[res.status] ?? "generic",
      requestId: requestIdOf(res.error),
    });
  }
  return { products: res.data.items ?? [], hasMore: res.data.nextCursor != null };
}

export interface ProductPickerState {
  products: readonly CatalogProduct[];
  hasMore: boolean;
  isLoading: boolean;
  error?: PickerError;
  retry: () => void;
}

function errorOf(error: unknown): PickerError | undefined {
  if (!error) return undefined;
  return error instanceof PickerFetchError ? error.detail : { kind: "generic" };
}

/** The picker's page for a tenant and a search; no tenant reads nothing. */
export function useProductPicker(tenantId: string | null, q: string): ProductPickerState {
  const active = Boolean(tenantId);
  const result = useQuery({
    queryKey: pickerQueryKeys.search(tenantId, q),
    enabled: active,
    queryFn: () => readPage(q),
    retry: false,
  });
  // A retry after a failure is a read in flight: TanStack keeps the old error until it
  // answers, so show it as loading and hide the stale error meanwhile (RT-767 review).
  const refetchingAfterError = result.isError && result.isFetching;
  return {
    products: result.data?.products ?? [],
    hasMore: result.data?.hasMore ?? false,
    isLoading: active && (result.isLoading || refetchingAfterError),
    error: refetchingAfterError ? undefined : errorOf(result.error),
    retry: () => void result.refetch(),
  };
}
