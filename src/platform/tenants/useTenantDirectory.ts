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

function requestIdOf(error: unknown): string | undefined {
  return (error as { error?: { request_id?: string } } | undefined)?.error?.request_id;
}

async function readDirectory(): Promise<TenantSummary[]> {
  const res = await listTenants();
  if (res.status === 429) throw new DirectoryReadError({ kind: "rate-limited" });
  if (res.status >= 400) {
    throw new DirectoryReadError({ kind: "failed", requestId: requestIdOf(res.error) });
  }
  // Never trust the shape: anything but an array is no rows, not a crash.
  return Array.isArray(res.data) ? res.data : [];
}

function directoryErrorOf(error: Error | null): DirectoryError | undefined {
  if (!error) return undefined;
  return error instanceof DirectoryReadError ? error.detail : { kind: "failed" };
}

export function useTenantDirectory() {
  const query = useQuery<TenantSummary[]>({
    queryKey: tenantDirectoryKey,
    queryFn: readDirectory,
    retry: false,
  });
  const error = directoryErrorOf(query.error);
  return {
    tenants: query.data,
    isLoading: query.isLoading,
    error,
    refetch: () => void query.refetch(),
  };
}
