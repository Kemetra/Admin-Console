/**
 * RT-782 (RT-777 S3): the one `listTenants` read behind the directory. It is a
 * platform-scope read, so it is not tenant data; a support session that ends or
 * is replaced drops it with every other cached read (useSessionSignals) and the
 * directory reads it again. A 429 is never retried here: the shared banner and
 * gate own the wait, and the list offers a manual retry.
 */
import { listTenants } from "@/lib/rf2-queries";
import { useQuery } from "@tanstack/react-query";
import type { TenantSummary } from "./directoryLogic";

export const tenantDirectoryKey = ["platform", "tenants"] as const;

export type DirectoryError = { kind: "rate-limited" } | { kind: "failed"; requestId?: string };

class DirectoryReadError extends Error {
  constructor(readonly detail: DirectoryError) {
    super("tenant-directory");
  }
}

export function useTenantDirectory() {
  const query = useQuery<TenantSummary[]>({
    queryKey: tenantDirectoryKey,
    queryFn: async () => {
      const res = await listTenants();
      if (res.status === 429) throw new DirectoryReadError({ kind: "rate-limited" });
      if (res.status >= 400) {
        const requestId = (res.error as { error?: { request_id?: string } } | undefined)?.error
          ?.request_id;
        throw new DirectoryReadError({ kind: "failed", requestId });
      }
      // Never trust the shape: anything but an array is no rows, not a crash.
      return Array.isArray(res.data) ? res.data : [];
    },
    retry: false,
  });
  const error = query.error
    ? query.error instanceof DirectoryReadError
      ? query.error.detail
      : ({ kind: "failed" } as const)
    : undefined;
  return {
    tenants: query.data,
    isLoading: query.isLoading,
    error,
    refetch: () => void query.refetch(),
  };
}
