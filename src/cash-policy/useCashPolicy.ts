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
  type RevisionQuery,
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

/** The tenant a policy belongs to, or the store whose override it is (an object, not a bare id). */
export interface TenantScope {
  tenantId: string;
}
export interface StoreScope {
  storeId: string;
}

export const policyKeys = {
  tenant: ({ tenantId }: TenantScope) => ["cash-policy", "tenant", tenantId] as const,
  tenantRevisions: ({ tenantId }: TenantScope) =>
    ["cash-policy", "tenant-revisions", tenantId] as const,
  store: ({ storeId }: StoreScope) => ["cash-policy", "store", storeId] as const,
  storeRevisions: ({ storeId }: StoreScope) => ["cash-policy", "store-revisions", storeId] as const,
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

function usePolicyRead<T>(
  queryKey: readonly unknown[],
  fetcher: () => Promise<Raw<T>>,
  isShape: (data: T) => boolean,
): PolicyRead<T> {
  const query = useQuery<ReadResult<T>>({
    queryKey,
    queryFn: () => toResult(fetcher, isShape),
    retry: false,
  });
  return { result: query.data, isLoading: query.isLoading, refetch: () => query.refetch() };
}

const hasValue = (policy: { policyValue: unknown } | undefined): boolean =>
  isObject(policy) && isObject(policy?.policyValue);

export function useTenantPolicy(scope: TenantScope): PolicyRead<TenantCashVariancePolicy> {
  return usePolicyRead(
    policyKeys.tenant(scope),
    () => consoleGetTenantCashVariancePolicy(scope.tenantId),
    (data) => hasValue(data.tenantDefault),
  );
}

export function useStorePolicy(scope: StoreScope): PolicyRead<StoreCashVariancePolicy> {
  return usePolicyRead(
    policyKeys.store(scope),
    () => consoleGetStoreCashVariancePolicy(scope.storeId),
    (data) => hasValue(data.effective) && hasValue(data.tenantDefault),
  );
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
  fetchPage: (page: RevisionQuery) => Promise<Raw<RevisionPage>>,
): RevisionList {
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await fetchPage({ cursor: pageParam });
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

export function useTenantRevisions(scope: TenantScope): RevisionList {
  return useRevisions(policyKeys.tenantRevisions(scope), (page) =>
    consoleListTenantCashVariancePolicyRevisions(scope.tenantId, page),
  );
}

/** A store's revisions are owner / tenant_admin only: pass `enabled` false for anyone else. */
export function useStoreRevisions(scope: StoreScope): RevisionList {
  return useRevisions(policyKeys.storeRevisions(scope), (page) =>
    consoleListStoreCashVariancePolicyRevisions(scope.storeId, page),
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
function keepsKey(res: PublishResult, outcome: PublishOutcome): boolean {
  return outcome.kind === "in-progress" || res.status >= 500;
}

const NETWORK_FAILURE: PublishOutcome = { kind: "failed", messageKey: "cashPolicy.error.generic" };

function usePublisher<B, T>(
  run: (body: B, attempt: KeyedAttempt) => Promise<Published<T>>,
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
        const res = await run(body, attempt.current);
        const outcome = classifyPublishOutcome(res);
        if (outcome.kind === "regenerate-key") {
          attempt.current = undefined;
          continue;
        }
        if (outcome.kind === "saved" && res.data !== undefined) onSaved(res.data);
        if (outcome.kind === "saved" || !keepsKey(res, outcome)) attempt.current = undefined;
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

interface PublishInto<B, T> {
  run: (body: B, attempt: KeyedAttempt) => Promise<Published<T>>;
  readKey: readonly unknown[];
  revisionsKey: readonly unknown[];
  /** Other cached reads this publish can change. */
  alsoInvalidate?: readonly unknown[];
}

/** A publish whose `201` body replaces the cached read, and refreshes the lists it touches. */
function usePublishInto<B, T>({
  run,
  readKey,
  revisionsKey,
  alsoInvalidate,
}: PublishInto<B, T>): Publisher<B> {
  const qc = useQueryClient();
  return usePublisher<B, T>(run, (data) => {
    const next: ReadResult<T> = { kind: "ok", data };
    qc.setQueryData(readKey, next);
    void qc.invalidateQueries({ queryKey: revisionsKey });
    if (alsoInvalidate) void qc.invalidateQueries({ queryKey: alsoInvalidate });
  });
}

export function usePublishTenant(scope: TenantScope): Publisher<PublishTenantBody> {
  return usePublishInto<PublishTenantBody, TenantCashVariancePolicy>({
    run: (body, { key }) => consolePublishTenantCashVariancePolicy(scope.tenantId, body, key),
    readKey: policyKeys.tenant(scope),
    revisionsKey: policyKeys.tenantRevisions(scope),
    // A tenant publish can change every store's resolved policy.
    alsoInvalidate: policyKeys.allStores,
  });
}

export function usePublishStoreOverride(scope: StoreScope): Publisher<PublishStoreBody> {
  return usePublishInto<PublishStoreBody, StoreCashVariancePolicy>({
    run: (body, { key }) => consolePublishStoreCashVariancePolicyOverride(scope.storeId, body, key),
    readKey: policyKeys.store(scope),
    revisionsKey: policyKeys.storeRevisions(scope),
  });
}
