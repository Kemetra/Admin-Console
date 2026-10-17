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
  type PairingCodeIssueRequest,
  type RevokeReason,
  consoleGetDeviceImpact,
  consoleIssuePairingCode,
  consoleListPairingCodes,
  consoleRetireDevice,
  consoleRevokeDevice,
} from "@/lib/device-queries";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type MutationFailure, classifyMutationFailure } from "./lifecycleFailure";
import type { RevokeBody } from "./lifecycleLogic";
import { newIdempotencyKey } from "./pairingLogic";
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

const GENERIC: MutationFailure = { kind: "generic" };

function failureOf(error: unknown): MutationFailure | undefined {
  if (!error) return undefined;
  return error instanceof ImpactFetchError ? error.failure : GENERIC;
}

export interface ImpactRequest {
  scope: ScopeKey;
  deviceId: string;
  action: DeviceLifecycleAction;
  /** Only a revoke sends a reason (any other action with one is a 400). */
  reason?: RevokeReason;
  enabled: boolean;
  /** Bumped to ask again: the impact is a snapshot, never a reservation. */
  nonce: number;
}

export function useImpact({
  scope,
  deviceId,
  action,
  reason,
  enabled,
  nonce,
}: ImpactRequest): ImpactState {
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
  return {
    preview: result.data,
    isLoading: enabled && result.isLoading,
    error: failureOf(result.error),
    retry: () => void result.refetch(),
  };
}

/** The wrapper's answer (not thrown): the flow classifies it, so a 409 keeps its payload. */
/** The device read models, and the live pairing codes a revoke or retire cancels. */
const DEVICE_AND_CODES: readonly (readonly string[])[] = [
  ["devices", "list"],
  ["devices", "detail"],
  ["devices", "pairing-codes"],
];

function invalidateAll(client: QueryClient, keys: readonly (readonly string[])[]): void {
  for (const queryKey of keys) void client.invalidateQueries({ queryKey });
}

export function useRevokeDevice(deviceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: RevokeBody) => consoleRevokeDevice(deviceId, body),
    onSuccess: (res) => {
      if (res.status === 200) invalidateAll(client, DEVICE_AND_CODES);
    },
  });
}

export function useRetireDevice(deviceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (retireReason: string) => consoleRetireDevice(deviceId, retireReason),
    onSuccess: (res) => {
      if (res.status === 200) invalidateAll(client, DEVICE_AND_CODES);
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
    // Also true on a refetch (Back, then Review again): the earlier answer is not the current one.
    isLoading: enabled && result.isFetching,
    failed: result.isError,
    retry: () => void result.refetch(),
  };
}

/**
 * Issues one pairing code. The Idempotency-Key is non-replayable, so a NEW key is
 * made for every call (never reused, never kept), and a failed or unanswered
 * call is never retried automatically. The result carries the secret code: the
 * mutation is not kept in the cache (`gcTime: 0`) and the caller resets it as
 * soon as it has moved the code into its own state.
 */
export function useIssuePairingCode() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (body: PairingCodeIssueRequest) =>
      consoleIssuePairingCode(body, newIdempotencyKey()),
    onSuccess: (res) => {
      if (res.status === 201) invalidateAll(client, [["devices", "pairing-codes"]]);
    },
  });
}
