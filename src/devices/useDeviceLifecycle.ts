/**
 * RT-372 hooks for the lifecycle flows: the impact preview, the revoke and
 * retire mutations, and the live codes that replace a device.
 *
 * The impact is a snapshot, never a reservation: it is not cached across
 * openings (`gcTime: 0`, `staleTime: 0`) and the key carries a `nonce` so the
 * confirm step can ask again. Every successful mutation invalidates the device
 * queries, so the detail and the fleet show what the server now says.
 *
 * Nothing here keeps operator text (the revoke note, the retire reason) beyond
 * the mutation call, and no key or log carries it.
 */
import {
  type DeviceImpactPreview,
  type DeviceLifecycleAction,
  type RevokeReason,
  consoleGetDeviceImpact,
  consoleListPairingCodes,
  consoleRetireDevice,
  consoleRevokeDevice,
} from "@/lib/device-queries";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type MutationFailure, type RevokeBody, classifyMutationFailure } from "./lifecycleLogic";
import type { DeviceScope } from "./useDevices";

type ScopeKey = Pick<DeviceScope, "tenantId" | "activeStoreId">;

export interface ImpactState {
  preview?: DeviceImpactPreview;
  isLoading: boolean;
  error?: MutationFailure;
  retry: () => void;
}

class ImpactFetchError extends Error {
  constructor(readonly failure: MutationFailure) {
    super("impact");
  }
}

export function useImpact(
  scope: ScopeKey,
  deviceId: string,
  action: DeviceLifecycleAction,
  reason: RevokeReason | undefined,
  enabled: boolean,
  nonce: number,
): ImpactState {
  const result = useQuery<DeviceImpactPreview>({
    queryKey: [
      "devices",
      "impact",
      scope.tenantId,
      scope.activeStoreId,
      deviceId,
      action,
      reason ?? null,
      nonce,
    ],
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      const res = await consoleGetDeviceImpact(deviceId, action, reason);
      if (res.status !== 200 || !res.data) throw new ImpactFetchError(classifyMutationFailure(res));
      return res.data;
    },
  });
  const failure = result.error;
  return {
    preview: result.data,
    isLoading: enabled && result.isLoading,
    error: failure
      ? failure instanceof ImpactFetchError
        ? failure.failure
        : { kind: "generic" }
      : undefined,
    retry: () => void result.refetch(),
  };
}

/** The wrapper's answer (not thrown): the flow classifies it, so a 409 keeps its payload. */
export function useRevokeDevice(deviceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: RevokeBody) => consoleRevokeDevice(deviceId, body),
    onSuccess: (res) => {
      if (res.status === 200) void client.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}

export function useRetireDevice(deviceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (retireReason: string) => consoleRetireDevice(deviceId, retireReason),
    onSuccess: (res) => {
      if (res.status === 200) void client.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}

const CODES_PAGE_SIZE = 200;
/** A tenant cannot hold more live codes than this in practice; a runaway cursor stops here. */
const MAX_CODE_PAGES = 10;

export interface ReplacementCodesState {
  /** Live codes whose `replacesDeviceId` is this device; `undefined` until checked. */
  count?: number;
  isLoading: boolean;
  failed: boolean;
  retry: () => void;
}

/**
 * Before retiring a REVOKED device the contract tells the client to look for a
 * live code that replaces or moves it (the retire cancels it, and the preview's
 * cascade is null there so it cannot say so). Reads every page of the pending
 * list and counts the matches.
 */
export function useReplacementCodes(
  scope: ScopeKey,
  deviceId: string,
  enabled: boolean,
): ReplacementCodesState {
  const result = useQuery<number>({
    queryKey: ["devices", "replacement-codes", scope.tenantId, scope.activeStoreId, deviceId],
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      let cursor: string | undefined;
      let count = 0;
      for (let page = 0; page < MAX_CODE_PAGES; page += 1) {
        const res = await consoleListPairingCodes({ cursor, page_size: CODES_PAGE_SIZE });
        if (res.status !== 200 || !res.data) throw new Error("pairing-codes");
        count += res.data.items.filter((c) => c.replacesDeviceId === deviceId).length;
        if (!res.data.nextCursor) return count;
        cursor = res.data.nextCursor;
      }
      throw new Error("pairing-codes: too many pages to check");
    },
  });
  return {
    count: result.data,
    isLoading: enabled && result.isLoading,
    failed: result.isError,
    retry: () => void result.refetch(),
  };
}
