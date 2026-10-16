import {
  type Rf2ErrorRender,
  type StoreCreateBody,
  type StoreTimezoneChangePreview,
  type StoreUpdateBody,
  createStore,
  listStores,
  mapRf2Error,
  previewStoreTimezoneChange,
  readStore,
  rf2QueryKeys,
  updateStore,
} from "@/lib/rf2-queries";
/**
 * Store query/mutation hooks (Phase 4). Mirrors the tenant hooks but scopes the
 * cache by the active tenant id (S7 re-scope; OQ-5 — RF-2 holds no authoritative
 * scope, the id comes from RF-1's provider). The store list/detail queries are
 * gated by the caller on an active tenant being present (OQ-4): if there is no
 * active tenant the component routes to the scope chooser and does NOT enable
 * the query, so the scope-`401` is avoided rather than interpreted as a sign-out.
 *
 * A residual `401` (scope went stale between the gate and the call) maps to a
 * `scope-required` render, NOT a session-expiry — RF-2's calls do not run through
 * RF-1's per-call context interceptor (OQ-4/OQ-10), so no refresh/sign-out fires.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Store = {
  id: string;
  tenant_id?: string;
  code: string;
  name: string;
  /** The store's IANA time zone (RT-401); shift and sales times are shown in it. */
  timezone?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type StoreListResult =
  | { kind: "rows"; rows: Store[] }
  | { kind: "error"; render: Rf2ErrorRender };

export type StoreDetailResult =
  | { kind: "store"; store: Store }
  | { kind: "error"; render: Rf2ErrorRender };

/**
 * SF-S1 — the active tenant's stores. `activeTenantId` gates the query: when it
 * is null the caller pre-routes to the scope chooser and the query stays
 * disabled (no `listStores`, no scope-401). The key is scoped by tenant id so a
 * tenant switch re-scopes the cache (S7).
 */
export function useStoreList(activeTenantId: string | null) {
  const query = useQuery<StoreListResult>({
    queryKey: rf2QueryKeys.stores(activeTenantId),
    enabled: Boolean(activeTenantId),
    queryFn: async () => {
      const res = await listStores();
      if (res.status >= 400) {
        return { kind: "error", render: mapRf2Error({ ...res, context: "store" }) };
      }
      return { kind: "rows", rows: (res.data as Store[] | undefined) ?? [] };
    },
  });
  return { result: query.data, isLoading: query.isLoading, refetch: () => void query.refetch() };
}

/** SF-S2 — one store by id. 404 renders uniformly (FR-004-008). */
export function useStoreDetail(storeId: string | undefined) {
  const query = useQuery<StoreDetailResult>({
    queryKey: storeId ? rf2QueryKeys.store(storeId) : ["rf2", "store", "none"],
    enabled: Boolean(storeId),
    queryFn: async () => {
      const res = await readStore(storeId as string);
      if (res.status >= 400) {
        return { kind: "error", render: mapRf2Error({ ...res, context: "store" }) };
      }
      return { kind: "store", store: res.data as Store };
    },
  });
  return { result: query.data, isLoading: query.isLoading };
}

type UpdateResult = Awaited<ReturnType<typeof updateStore>>;

/**
 * After a store PATCH: a 2xx returns the updated Store, which is merged over
 * the cached detail. The generated `Store` type has every field optional, so
 * the merge keeps `id` and `code` even if a response were partial. The edit
 * screen then shows the new state as soon as the mutation settles: no stale
 * badge, no refetch that could fail and replace the form. With nothing cached
 * the detail is refetched instead. The list is refreshed and awaited.
 */
function useOnStoreUpdated(activeTenantId: string | null, storeId: string | undefined) {
  const qc = useQueryClient();
  return (res: UpdateResult) => {
    const refreshList = qc.invalidateQueries({ queryKey: rf2QueryKeys.stores(activeTenantId) });
    if (!storeId || res.status >= 400 || !res.data) return refreshList;
    const key = rf2QueryKeys.store(storeId);
    const cached = qc.getQueryData<StoreDetailResult>(key);
    if (cached?.kind !== "store") {
      return Promise.all([refreshList, qc.invalidateQueries({ queryKey: key })]);
    }
    const next: StoreDetailResult = {
      kind: "store",
      store: { ...cached.store, ...(res.data as Partial<Store>) },
    };
    qc.setQueryData(key, next);
    return refreshList;
  };
}

/** SF-S3 — create/update. Refreshes the active tenant's store list + detail. */
export function useStoreMutations(activeTenantId: string | null, storeId?: string) {
  const qc = useQueryClient();
  const onUpdated = useOnStoreUpdated(activeTenantId, storeId);

  const create = useMutation({
    mutationFn: (body: StoreCreateBody) => createStore(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: rf2QueryKeys.stores(activeTenantId) }),
  });
  const update = useMutation({
    mutationFn: (body: StoreUpdateBody) => updateStore(storeId as string, body),
    onSuccess: onUpdated,
  });
  return { create, update };
}

export type TimezonePreviewResult =
  | { kind: "preview"; preview: StoreTimezoneChangePreview }
  | { kind: "error"; render: Rf2ErrorRender };

/**
 * RT-477 — the read-only impact review of moving a store to `timezone`. Only
 * runs once a zone is proposed. A preview is advisory (the blockers are
 * re-checked when the change is applied), so it is never served from cache:
 * every proposal asks again. A thrown request is a visible failure, not a retry.
 */
export function useTimezonePreview(storeId: string | undefined, timezone: string | undefined) {
  const enabled = Boolean(storeId && timezone);
  const query = useQuery<TimezonePreviewResult>({
    queryKey: enabled
      ? rf2QueryKeys.timezonePreview(storeId as string, timezone as string)
      : ["rf2", "store-timezone-preview", "none"],
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      try {
        const res = await previewStoreTimezoneChange({
          storeId: storeId as string,
          timezone: timezone as string,
        });
        if (res.status >= 400 || !res.data) {
          return { kind: "error", render: mapRf2Error({ ...res, context: "store" }) };
        }
        return { kind: "preview", preview: res.data };
      } catch {
        return { kind: "error", render: STORE_REQUEST_FAILED };
      }
    },
  });
  return { result: enabled ? query.data : undefined, isLoading: enabled && query.isPending };
}

/**
 * After `timezone_changed_concurrently` the form's idea of the current zone is
 * stale: re-read the store and drop the previews computed from the old zone.
 */
export function useRefreshStoreTimezone(storeId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    if (!storeId) return Promise.resolve();
    return Promise.all([
      qc.invalidateQueries({ queryKey: rf2QueryKeys.store(storeId) }),
      qc.invalidateQueries({ queryKey: rf2QueryKeys.timezonePreviews(storeId) }),
    ]);
  };
}

/** A store request that threw (offline, aborted) before any HTTP status. */
export const STORE_REQUEST_FAILED: Rf2ErrorRender = {
  kind: "generic",
  messageKey: "errors.generic",
};

/** Mutation key of the V1 `is_active` toggle, so the name form can see it in flight. */
export const storeStatusMutationKey = (storeId: string) => ["rf2", "store-status", storeId];

/** RT-400 — the edit screen's «إيقاف / تفعيل المتجر» (`{ is_active }` only). */
export function useStoreStatusMutation(activeTenantId: string | null, storeId: string) {
  const onUpdated = useOnStoreUpdated(activeTenantId, storeId);
  return useMutation({
    mutationKey: storeStatusMutationKey(storeId),
    mutationFn: (isActive: boolean) => updateStore(storeId, { is_active: isActive }),
    onSuccess: onUpdated,
  });
}
