/**
 * RT-371 query hooks: a read-only infinite query over `consoleListDevices` and a
 * detail query over `consoleGetDevice`. Scope-keyed by the active tenant AND
 * active store (a store_manager's readable devices follow the active store
 * server-side), and the list key carries the whole query: a keyset cursor is
 * only valid with the filters that issued it, so a filter change restarts at
 * page 1. Store names and zones come from the shared store roster
 * (`useStoreDirectory` / `useStoreOf`).
 *
 * Errors are typed, never raw: a 404 is the API's uniform non-disclosing
 * refusal, a 401 an expired session, a 400 a rejected filter.
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import {
  type DeviceDetail,
  type DeviceListQuery,
  type DevicePage,
  consoleGetDevice,
  consoleListDevices,
} from "@/lib/device-queries";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { flattenDevicePages, isUuid, nextDeviceCursor, requestIdOf } from "./deviceLogic";

export type DeviceError = {
  kind: "not-found" | "session" | "rejected" | "generic";
  requestId?: string;
};

export interface DeviceScope {
  tenantId: string | null;
  activeStoreId: string | null;
  tenantName: string | null;
  role: string | null;
}

/** Active tenant, store and role (the query scope) from RF-1's provider. */
export function useDeviceScope(): DeviceScope {
  const { context } = useActiveContextValue();
  return {
    tenantId: context?.active_tenant?.id ?? null,
    tenantName: context?.active_tenant?.name ?? null,
    activeStoreId: context?.active_store?.id ?? null,
    role: context?.active_role_code ?? null,
  };
}

type ScopeKey = Pick<DeviceScope, "tenantId" | "activeStoreId">;

export const deviceQueryKeys = {
  list: (scope: ScopeKey, query: DeviceListQuery) =>
    ["devices", "list", scope.tenantId, scope.activeStoreId, query] as const,
  detail: (scope: ScopeKey, deviceId: string | undefined) =>
    ["devices", "detail", scope.tenantId, scope.activeStoreId, deviceId] as const,
};

class DeviceFetchError extends Error {
  constructor(readonly detail: DeviceError) {
    super("devices");
  }
}

const STATUS_KINDS: Record<number, DeviceError["kind"]> = {
  400: "rejected",
  401: "session",
  404: "not-found",
};

function errorOf(error: unknown): DeviceError | undefined {
  if (!error) return undefined;
  return error instanceof DeviceFetchError ? error.detail : { kind: "generic" };
}

/** Unwrap one wrapper result: its payload, or the typed error. */
function dataOrThrow<P>(res: { status: number; data?: P; error?: unknown }): P {
  if (res.status >= 400 || !res.data) {
    throw new DeviceFetchError({
      kind: STATUS_KINDS[res.status] ?? "generic",
      requestId: requestIdOf(res.error),
    });
  }
  return res.data;
}

const FIRST_PAGE: string | undefined = undefined;

export interface DeviceListState {
  rows: DevicePage["items"];
  /** Waiting on the first page. */
  isLoading: boolean;
  /** A failure with nothing loaded yet: the surface shows its error view. */
  error?: DeviceError;
  /** A failure after rows were loaded: they stay, and the pager offers a Retry. */
  inlineError?: DeviceError;
  retry: () => void;
  hasMore: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => void;
}

export function useDeviceList(scope: ScopeKey, query: DeviceListQuery): DeviceListState {
  const active = Boolean(scope.tenantId);
  const result = useInfiniteQuery({
    queryKey: deviceQueryKeys.list(scope, query),
    enabled: active,
    initialPageParam: FIRST_PAGE,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      consoleListDevices({ ...query, cursor: pageParam }).then(dataOrThrow),
    getNextPageParam: nextDeviceCursor,
    retry: false,
  });

  const rows = flattenDevicePages(result.data?.pages ?? []);
  const failure = errorOf(result.error);
  const loadMore = () => {
    if (result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage();
  };
  return {
    rows,
    isLoading: active && result.isLoading,
    // With rows on screen a failure is inline (they stay); with none it is the error view.
    ...(rows.length > 0 ? { inlineError: failure } : { error: failure }),
    retry: () => (result.isFetchNextPageError ? loadMore() : void result.refetch()),
    hasMore: result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    loadMore,
  };
}

export interface DeviceDetailState {
  device?: DeviceDetail;
  isLoading: boolean;
  error?: DeviceError;
  retry: () => void;
}

const INVALID_ID: DeviceError = { kind: "not-found" };

export function useDeviceDetail(scope: ScopeKey, deviceId: string | undefined): DeviceDetailState {
  const validId = isUuid(deviceId);
  const enabled = Boolean(scope.tenantId) && validId;
  const result = useQuery<DeviceDetail>({
    queryKey: deviceQueryKeys.detail(scope, deviceId),
    enabled,
    queryFn: () => consoleGetDevice(String(deviceId)).then(dataOrThrow),
    retry: false,
  });
  return {
    device: result.data,
    isLoading: result.isLoading && enabled,
    // A malformed route id would be a contract 400: it renders as not-found.
    error: validId ? errorOf(result.error) : INVALID_ID,
    retry: () => void result.refetch(),
  };
}
