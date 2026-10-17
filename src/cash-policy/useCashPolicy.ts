/**
 * RT-389 hooks: TanStack Query bindings over the six policy wrappers.
 *
 * Reads carry a refusal in the RESULT (`{ kind: "error", status }`), so a
 * component branches on data, not on a thrown error. A publish answers `201`
 * with the updated read, which is written straight into the read cache (no
 * second GET); the revision list is invalidated. A tenant publish can change
 * every store's resolved policy, so the cached store reads are invalidated too.
 * Nothing here computes inheritance (K-9).
 */
import {
  type CashVariancePolicyRevision,
  type PublishStoreBody,
  type PublishTenantBody,
  type StoreCashVariancePolicy,
  type TenantCashVariancePolicy,
  consoleGetStoreCashVariancePolicy,
  consoleGetTenantCashVariancePolicy,
  consoleListStoreCashVariancePolicyRevisions,
  consoleListTenantCashVariancePolicyRevisions,
  consolePublishStoreCashVariancePolicyOverride,
  consolePublishTenantCashVariancePolicy,
} from "@/lib/cash-variance-policy-queries";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { type KeyedAttempt, reuseOrNewKey } from "./policyIdempotency";
import { type PublishOutcome, type PublishResult, classifyPublishOutcome } from "./policyLogic";

export const policyKeys = {
  tenant: (tenantId: string) => ["cash-policy", "tenant", tenantId] as const,
  tenantRevisions: (tenantId: string) => ["cash-policy", "tenant-revisions", tenantId] as const,
  store: (storeId: string) => ["cash-policy", "store", storeId] as const,
  storeRevisions: (storeId: string) => ["cash-policy", "store-revisions", storeId] as const,
  /** Every cached store read (a tenant publish can change any of them). */
  allStores: ["cash-policy", "store"] as const,
};

export type ReadResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "error"; status: number; requestId?: string };

interface Raw<T> {
  status: number;
  data?: T;
  error?: unknown;
}

function requestIdOf(error: unknown): string | undefined {
  const inner = (error as { error?: unknown } | undefined)?.error;
  if (typeof inner !== "object" || inner === null) return undefined;
  const id = (inner as { request_id?: unknown }).request_id;
  return typeof id === "string" ? id : undefined;
}

/**
 * A refusal, a body that is not the contract's shape (never trust external
 * data: it is a load failure, not a crash) or a request that threw (offline,
 * aborted) before any status.
 */
async function toResult<T>(
  call: () => Promise<Raw<T>>,
  isShape: (data: T) => boolean,
): Promise<ReadResult<T>> {
  try {
    const res = await call();
    if (res.status >= 400) {
      return { kind: "error", status: res.status, requestId: requestIdOf(res.error) };
    }
    if (res.data === undefined || !isShape(res.data)) return { kind: "error", status: 0 };
    return { kind: "ok", data: res.data };
  } catch {
    return { kind: "error", status: 0 };
  }
}

const isObject = (value: unknown): boolean => typeof value === "object" && value !== null;

export interface PolicyRead<T> {
  result: ReadResult<T> | undefined;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
}

export function useTenantPolicy(tenantId: string): PolicyRead<TenantCashVariancePolicy> {
  const query = useQuery<ReadResult<TenantCashVariancePolicy>>({
    queryKey: policyKeys.tenant(tenantId),
    queryFn: () =>
      toResult(
        () => consoleGetTenantCashVariancePolicy(tenantId),
        (data) => isObject(data.tenantDefault) && isObject(data.tenantDefault.policyValue),
      ),
    retry: false,
  });
  return { result: query.data, isLoading: query.isLoading, refetch: () => query.refetch() };
}

export function useStorePolicy(storeId: string): PolicyRead<StoreCashVariancePolicy> {
  const query = useQuery<ReadResult<StoreCashVariancePolicy>>({
    queryKey: policyKeys.store(storeId),
    queryFn: () =>
      toResult(
        () => consoleGetStoreCashVariancePolicy(storeId),
        (data) =>
          isObject(data.effective) &&
          isObject(data.effective.policyValue) &&
          isObject(data.tenantDefault) &&
          isObject(data.tenantDefault.policyValue),
      ),
    retry: false,
  });
  return { result: query.data, isLoading: query.isLoading, refetch: () => query.refetch() };
}

// --- Revision history -----------------------------------------------------------

export interface RevisionList {
  rows: CashVariancePolicyRevision[];
  hasMore: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  failed: boolean;
  loadMore: () => void;
  refetch: () => void;
}

interface RevisionPage {
  items: CashVariancePolicyRevision[];
  nextCursor: string | null;
}

function useRevisions(
  queryKey: readonly unknown[],
  fetchPage: (cursor: string | undefined) => Promise<Raw<RevisionPage>>,
): RevisionList {
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await fetchPage(pageParam);
      if (res.status >= 400 || !res.data) throw new Error("cash-policy-revisions");
      return res.data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: false,
  });
  return {
    rows: (query.data?.pages ?? []).flatMap((page) => page.items),
    hasMore: Boolean(query.hasNextPage),
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    failed: query.isError,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    refetch: () => {
      void query.refetch();
    },
  };
}

export function useTenantRevisions(tenantId: string): RevisionList {
  return useRevisions(policyKeys.tenantRevisions(tenantId), (cursor) =>
    consoleListTenantCashVariancePolicyRevisions(tenantId, { cursor }),
  );
}

/** A store's revisions are owner / tenant_admin only: pass `enabled` false for anyone else. */
export function useStoreRevisions(storeId: string): RevisionList {
  return useRevisions(policyKeys.storeRevisions(storeId), (cursor) =>
    consoleListStoreCashVariancePolicyRevisions(storeId, { cursor }),
  );
}

// --- Publishing -----------------------------------------------------------------

interface Published<T> extends PublishResult {
  data?: T;
}

export interface Publisher<B> {
  submit: (body: B) => Promise<PublishOutcome>;
  pending: boolean;
}

/** The key survives only what a retry of the same body could still need. */
function keepsKey(status: number, outcome: PublishOutcome): boolean {
  return outcome.kind === "in-progress" || status >= 500;
}

const NETWORK_FAILURE: PublishOutcome = { kind: "failed", messageKey: "cashPolicy.error.generic" };

function usePublisher<B, T>(
  run: (body: B, key: string) => Promise<Published<T>>,
  onSaved: (data: T) => void,
): Publisher<B> {
  const attempt = useRef<KeyedAttempt | undefined>(undefined);
  const [pending, setPending] = useState(false);

  async function submit(body: B): Promise<PublishOutcome> {
    setPending(true);
    try {
      const fingerprint = JSON.stringify(body);
      // One silent retry when the server says the key itself was malformed.
      for (let tries = 0; tries < 2; tries++) {
        attempt.current = reuseOrNewKey(attempt.current, fingerprint);
        const res = await run(body, attempt.current.key);
        const outcome = classifyPublishOutcome(res);
        if (outcome.kind === "regenerate-key") {
          attempt.current = undefined;
          continue;
        }
        if (outcome.kind === "saved" && res.data !== undefined) onSaved(res.data);
        if (outcome.kind === "saved" || !keepsKey(res.status, outcome)) attempt.current = undefined;
        return outcome;
      }
      attempt.current = undefined;
      return NETWORK_FAILURE;
    } catch {
      // Nothing reached the server's verdict: a retry of this body reuses its key.
      return NETWORK_FAILURE;
    } finally {
      setPending(false);
    }
  }

  return { submit, pending };
}

export function usePublishTenant(tenantId: string): Publisher<PublishTenantBody> {
  const qc = useQueryClient();
  return usePublisher<PublishTenantBody, TenantCashVariancePolicy>(
    (body, key) => consolePublishTenantCashVariancePolicy(tenantId, body, key),
    (data) => {
      const next: ReadResult<TenantCashVariancePolicy> = { kind: "ok", data };
      qc.setQueryData(policyKeys.tenant(tenantId), next);
      void qc.invalidateQueries({ queryKey: policyKeys.tenantRevisions(tenantId) });
      void qc.invalidateQueries({ queryKey: policyKeys.allStores });
    },
  );
}

export function usePublishStoreOverride(storeId: string): Publisher<PublishStoreBody> {
  const qc = useQueryClient();
  return usePublisher<PublishStoreBody, StoreCashVariancePolicy>(
    (body, key) => consolePublishStoreCashVariancePolicyOverride(storeId, body, key),
    (data) => {
      const next: ReadResult<StoreCashVariancePolicy> = { kind: "ok", data };
      qc.setQueryData(policyKeys.store(storeId), next);
      void qc.invalidateQueries({ queryKey: policyKeys.storeRevisions(storeId) });
    },
  );
}
