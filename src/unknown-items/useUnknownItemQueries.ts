import {
  type BulkDismissOutcome,
  type CreateProductFromUnknownItemRequest,
  type ListUnknownItemsParams,
  type ReviewQueueItem,
  type UnknownItemErrorRender,
  bulkDismissUnknownItems,
  createProductFromUnknownItem,
  dismissUnknownItem,
  inspectUnknownItem,
  linkUnknownItem,
  listUnknownItems,
  mapUnknownItemError,
  reopenUnknownItem,
  unknownItemsQueryKeys,
} from "@/lib/unknown-items-queries";
/**
 * RF-4a query/mutation hooks (T004). Thin TanStack Query bindings over the
 * wrappers in `src/lib/unknown-items-queries.ts`, reusing RF-1's query client.
 * Each surface (list / inspect / dismiss) consumes one of these so the data
 * wiring lives in one place and the components stay presentational.
 *
 * The query RESULT carries the typed-error render decision (mapUnknownItemError)
 * when a call fails, so components branch on data, not on thrown errors —
 * mirroring RF-2's `useTenantQueries` pattern.
 *
 * RT-724 adds the RF-4b writes (create product, reopen, bulk dismiss). Like
 * dismiss, none is retried automatically (the query client sets
 * `mutations.retry: false`); the operator decides whether to try again.
 */
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { type KeyedAttempt, keepsKey, reuseOrNewKey } from "./unknownItemIdempotency";

export type UnknownItemListResult =
  | { kind: "page"; items: ReviewQueueItem[]; nextCursor: string | null }
  | { kind: "error"; render: UnknownItemErrorRender };

export type UnknownItemInspectResult =
  | { kind: "item"; item: ReviewQueueItem }
  | { kind: "error"; render: UnknownItemErrorRender };

/** SF-4a-1 — the backend-scoped review queue. No client-side authz filter. */
export function useUnknownItemList(activeTenantId: string | null, params: ListUnknownItemsParams) {
  const query = useQuery<UnknownItemListResult>({
    queryKey: unknownItemsQueryKeys.list(activeTenantId, params),
    queryFn: async () => {
      const res = await listUnknownItems(params);
      if (res.status >= 400) {
        return { kind: "error", render: mapUnknownItemError({ ...res, op: "list" }) };
      }
      const data = res.data as
        | { items?: ReviewQueueItem[]; next_cursor?: string | null }
        | undefined;
      return { kind: "page", items: data?.items ?? [], nextCursor: data?.next_cursor ?? null };
    },
  });
  return { result: query.data, isLoading: query.isLoading, refetch: () => void query.refetch() };
}

/** SF-4a-2 — inspect one item. 404 renders uniformly (SI-004). */
export function useUnknownItemInspect(id: string | undefined) {
  const query = useQuery<UnknownItemInspectResult>({
    queryKey: id ? unknownItemsQueryKeys.item(id) : ["rf4a", "unknown-item", "none"],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await inspectUnknownItem(id as string);
      if (res.status >= 400) {
        return { kind: "error", render: mapUnknownItemError({ ...res, op: "inspect" }) };
      }
      return { kind: "item", item: res.data as ReviewQueueItem };
    },
  });
  return { result: query.data, isLoading: query.isLoading };
}

/**
 * SF-4a-3 — dismiss behind a confirm. Invalidates the queue on success so the
 * terminal row drops from the pending page (S8 parity). The mutation result
 * carries the mapped error (including the dismiss-only 409 already_reconciled)
 * so the surface can render it inline.
 */
export function useUnknownItemDismiss(activeTenantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await dismissUnknownItem(id);
      if (res.status >= 400) {
        return {
          ok: false as const,
          render: mapUnknownItemError({ ...res, op: "dismiss" }),
        };
      }
      return { ok: true as const, item: res.data as ReviewQueueItem };
    },
    onSuccess: (result) => {
      if (result.ok) {
        // Re-scope the active tenant's queue (any filter/sort/group variant).
        void qc.invalidateQueries({
          queryKey: ["rf4a", "unknown-items", activeTenantId],
        });
      }
    },
  });
}

/** A write's result: the returned row (or outcomes), or the mapped error. */
export type UnknownItemWriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; render: UnknownItemErrorRender };

/** After a write: refresh the tenant's queue (every variant) and the item views. */
function invalidateAfterWrite(qc: QueryClient, activeTenantId: string | null): void {
  void qc.invalidateQueries({ queryKey: ["rf4a", "unknown-items", activeTenantId] });
  void qc.invalidateQueries({ queryKey: ["rf4a", "unknown-item"] });
}

/**
 * RT-724 — create a tenant product from a pending item. 201 returns the item,
 * now `resolved` / `created`. The form owns its input, so a refusal (400, 409
 * `alias_conflict`) leaves what the operator typed in place.
 */
export function useUnknownItemCreateProduct(activeTenantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      body: CreateProductFromUnknownItemRequest;
    }): Promise<UnknownItemWriteResult<ReviewQueueItem>> => {
      const res = await createProductFromUnknownItem(input.id, input.body);
      if (res.status >= 400) {
        return { ok: false, render: mapUnknownItemError({ ...res, op: "createProduct" }) };
      }
      return { ok: true, value: res.data as ReviewQueueItem };
    },
    onSuccess: (result) => {
      if (result.ok) invalidateAfterWrite(qc, activeTenantId);
    },
  });
}

/**
 * RT-767 — link a pending item to a product chosen in the picker. 200 returns the
 * item, now `resolved` / `linked`. Not keyed (the contract documents no key). A
 * refusal changes nothing, except `already_reconciled`: the item was resolved
 * meanwhile, so the queue and the item are read again.
 */
export function useUnknownItemLink(activeTenantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      productId: string;
    }): Promise<UnknownItemWriteResult<ReviewQueueItem>> => {
      const res = await linkUnknownItem(input.id, input.productId);
      if (res.status >= 400) {
        return { ok: false, render: mapUnknownItemError({ ...res, op: "link" }) };
      }
      return { ok: true, value: res.data as ReviewQueueItem };
    },
    onSuccess: (result) => {
      if (result.ok || result.render.kind === "already-reconciled") {
        invalidateAfterWrite(qc, activeTenantId);
      }
    },
  });
}

/**
 * Hold one keyed attempt across manual retries: reuse the key for the same
 * fingerprint while the last outcome was unsettled, drop it on a final one.
 */
function useKeyedAttempt() {
  const attempt = useRef<KeyedAttempt | undefined>(undefined);
  return {
    keyFor(fingerprint: string): string {
      attempt.current = reuseOrNewKey(attempt.current, fingerprint);
      return attempt.current.key;
    },
    settle(render?: UnknownItemErrorRender): void {
      if (!render || !keepsKey(render)) attempt.current = undefined;
    },
  };
}

/**
 * RT-724 — reopen a dismissed item (tenant-wide actors only; a store-scoped
 * actor gets 403 `forbidden`). 201 returns the fresh `pending` row.
 */
export function useUnknownItemReopen(activeTenantId: string | null) {
  const qc = useQueryClient();
  const attempt = useKeyedAttempt();
  return useMutation({
    mutationFn: async (id: string): Promise<UnknownItemWriteResult<ReviewQueueItem>> => {
      const res = await reopenUnknownItem(id, attempt.keyFor(`reopen:${id}`));
      if (res.status >= 400) {
        const render = mapUnknownItemError({ ...res, op: "reopen" });
        attempt.settle(render);
        return { ok: false, render };
      }
      attempt.settle();
      return { ok: true, value: res.data as ReviewQueueItem };
    },
    onSuccess: (result) => {
      if (result.ok) invalidateAfterWrite(qc, activeTenantId);
    },
  });
}

/**
 * RT-724 — dismiss a selection (≤ BULK_DISMISS_MAX ids; more is rejected whole
 * with a 400). 200 carries one outcome per id; a mixed batch still succeeds.
 */
export function useUnknownItemBulkDismiss(activeTenantId: string | null) {
  const qc = useQueryClient();
  const attempt = useKeyedAttempt();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<UnknownItemWriteResult<BulkDismissOutcome[]>> => {
      // One normalized body serves both the key fingerprint and the request, so
      // a retry of the same selection replays the exact body its key was minted for.
      const sorted = [...ids].sort((a, b) => a.localeCompare(b));
      const res = await bulkDismissUnknownItems(sorted, attempt.keyFor(JSON.stringify(sorted)));
      if (res.status >= 400) {
        const render = mapUnknownItemError({ ...res, op: "bulkDismiss" });
        attempt.settle(render);
        return { ok: false, render };
      }
      attempt.settle();
      const data = res.data as { outcomes?: BulkDismissOutcome[] } | undefined;
      return { ok: true, value: data?.outcomes ?? [] };
    },
    onSuccess: (result) => {
      if (result.ok) invalidateAfterWrite(qc, activeTenantId);
    },
  });
}
