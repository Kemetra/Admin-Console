/**
 * RT-725 query and mutation hooks for the ERPNext mapping screens, over the
 * wrappers in `src/lib/erp-mapping-queries.ts`, keyed by the active tenant.
 *
 * Reads are not retried: a refusal is shown as it is. Mutations run only from
 * an explicit, confirmed click, are sent once (never retried, never re-sent on
 * a failure), and carry the version the operator saw. After a success, and
 * after a refusal that means the list on screen may be wrong (409, 404, an
 * unknown outcome), the lists are read again; the mutation is not.
 */
import {
  type ErpnextItemMapping,
  type ErpnextWarehouseMapping,
  type ItemMappingState,
  type MappingResult,
  tenantAdminConfirmErpnextItemMapping,
  tenantAdminListErpnextItemMappings,
  tenantAdminListErpnextWarehouseMappings,
  tenantAdminRetireErpnextItemMapping,
  tenantAdminRetireErpnextWarehouseMapping,
  tenantAdminSetErpnextWarehouseMapping,
  tenantAdminSuggestErpnextItemMapping,
} from "@/lib/erp-mapping-queries";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type MappingFailure,
  type MappingOp,
  classifyFailure,
  shouldRefreshAfter,
} from "./mappingLogic";

export const mappingQueryKeys = {
  all: (tenantId: string | null) => ["erp-mappings", tenantId] as const,
  items: (tenantId: string | null, state: ItemMappingState | "") =>
    ["erp-mappings", tenantId, "items", state] as const,
  warehouses: (tenantId: string | null) => ["erp-mappings", tenantId, "warehouses"] as const,
};

class MappingFetchError extends Error {
  constructor(readonly failure: MappingFailure) {
    super("erp-mappings");
  }
}

/**
 * One call: the payload, or the typed failure. No answer at all classifies per
 * `op` (a failed read, an unknown mutation outcome). Never retried.
 */
async function callOnce<P>(
  op: MappingOp,
  call: () => Promise<MappingResult<P>>,
): Promise<MutationOutcome<P>> {
  let res: MappingResult<P>;
  try {
    res = await call();
  } catch {
    return { ok: false, failure: classifyFailure(op, undefined) };
  }
  if (res.status >= 400 || res.data === undefined) {
    return { ok: false, failure: classifyFailure(op, res) };
  }
  return { ok: true, data: res.data };
}

/** One read's payload; its failure is thrown for the query to hold. */
async function read<P>(op: MappingOp, call: () => Promise<MappingResult<P>>): Promise<P> {
  const outcome = await callOnce(op, call);
  if (!outcome.ok) throw new MappingFetchError(outcome.failure);
  return outcome.data;
}

export interface ListView<T> {
  rows: T[];
  isLoading: boolean;
  /** A failure with nothing loaded. */
  failure?: MappingFailure;
  /** A re-read failed while earlier rows stay on screen. */
  staleFailure?: MappingFailure;
  asOf?: number;
  retry: () => void;
}

function failureOf(error: unknown): MappingFailure | undefined {
  if (!error) return undefined;
  return error instanceof MappingFetchError ? error.failure : { kind: "failed" };
}

function listView<T>(
  result: {
    data?: { items: T[] };
    error: unknown;
    isLoading: boolean;
    dataUpdatedAt: number;
    refetch: () => Promise<unknown>;
  },
  enabled: boolean,
): ListView<T> {
  const failure = failureOf(result.error);
  const hasData = result.data !== undefined;
  return {
    rows: result.data?.items ?? [],
    isLoading: enabled && result.isLoading,
    failure: hasData ? undefined : failure,
    staleFailure: hasData ? failure : undefined,
    asOf: hasData ? result.dataUpdatedAt : undefined,
    retry: () => void result.refetch(),
  };
}

export function useItemMappings(
  tenantId: string | null,
  state: ItemMappingState | "",
  enabled: boolean,
): ListView<ErpnextItemMapping> {
  const active = enabled && Boolean(tenantId);
  const result = useQuery({
    queryKey: mappingQueryKeys.items(tenantId, state),
    enabled: active,
    queryFn: () =>
      read("listItems", () => tenantAdminListErpnextItemMappings(state === "" ? undefined : state)),
    retry: false,
  });
  return listView(result, active);
}

export function useWarehouseMappings(
  tenantId: string | null,
  enabled: boolean,
): ListView<ErpnextWarehouseMapping> {
  const active = enabled && Boolean(tenantId);
  const result = useQuery({
    queryKey: mappingQueryKeys.warehouses(tenantId),
    enabled: active,
    queryFn: () => read("listWarehouses", tenantAdminListErpnextWarehouseMappings),
    retry: false,
  });
  return listView(result, active);
}

// --- Mutations ---------------------------------------------------------------------------

export type MutationOutcome<P> = { ok: true; data: P } | { ok: false; failure: MappingFailure };

export interface MappingMutation<V, P> {
  /** Sends the change once. Ignored while one is already in flight. */
  run: (vars: V, onDone?: (outcome: MutationOutcome<P>) => void) => void;
  pending: boolean;
  failure?: MappingFailure;
  reset: () => void;
}

function useMappingMutation<V, P>(
  tenantId: string | null,
  op: MappingOp,
  call: (vars: V) => Promise<MappingResult<P>>,
): MappingMutation<V, P> {
  const qc = useQueryClient();
  const mutation = useMutation({
    retry: false,
    mutationFn: (vars: V) => callOnce(op, () => call(vars)),
    onSuccess: (outcome) => {
      if (outcome.ok || shouldRefreshAfter(outcome.failure)) {
        void qc.invalidateQueries({ queryKey: mappingQueryKeys.all(tenantId) });
      }
    },
  });
  const outcome = mutation.data;
  return {
    run: (vars, onDone) => {
      if (mutation.isPending) return;
      mutation.mutate(vars, { onSuccess: (result) => onDone?.(result) });
    },
    pending: mutation.isPending,
    failure: outcome && !outcome.ok ? outcome.failure : undefined,
    reset: mutation.reset,
  };
}

export interface VersionedTarget {
  id: string;
  version: number;
}

export function useConfirmItemMapping(tenantId: string | null) {
  return useMappingMutation(tenantId, "confirm", (target: VersionedTarget) =>
    tenantAdminConfirmErpnextItemMapping(target.id, target.version),
  );
}

export function useRetireItemMapping(tenantId: string | null) {
  return useMappingMutation(tenantId, "retireItem", (target: VersionedTarget) =>
    tenantAdminRetireErpnextItemMapping(target.id, target.version),
  );
}

export function useSuggestItemMapping(tenantId: string | null) {
  return useMappingMutation(
    tenantId,
    "suggest",
    (body: { tenant_product_id: string; erpnext_item_ref: string }) =>
      tenantAdminSuggestErpnextItemMapping(body),
  );
}

export function useSetWarehouseMapping(tenantId: string | null) {
  return useMappingMutation(
    tenantId,
    "setWarehouse",
    (body: { store_id: string; erpnext_warehouse_ref: string }) =>
      tenantAdminSetErpnextWarehouseMapping(body),
  );
}

export function useRetireWarehouseMapping(tenantId: string | null) {
  return useMappingMutation(tenantId, "retireWarehouse", (target: VersionedTarget) =>
    tenantAdminRetireErpnextWarehouseMapping(target.id, target.version),
  );
}
