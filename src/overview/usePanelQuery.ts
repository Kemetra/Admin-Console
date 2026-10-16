/**
 * RT-559 one panel's read (spec 009 §6.2–§6.4). Every Overview panel reads
 * through an existing typed wrapper and lands in exactly one state:
 *
 *   - `loading`: its read is in flight (or waiting on what it needs first);
 *   - `hidden`: the session may not read it (role pre-skip, or a 403/404), so
 *     it is omitted, never shown as empty or zero;
 *   - `error`: the read failed or answered something malformed; the panel shows
 *     an inline notice with its own retry, never a zero;
 *   - `ready`: backend truth, as returned.
 *
 * The owning screens' hooks are not reused here: they map 403/404 to different
 * kinds (and some to a generic error), while the Overview must omit on both.
 * Keys sit under `["overview", …]` and carry the tenant and active store, so a
 * scope change never reuses another scope's answer.
 */
import { useQuery } from "@tanstack/react-query";
import { isRefusal } from "./overviewLogic";

export type PanelState<T> =
  | { status: "loading" }
  | { status: "hidden" }
  | { status: "error"; requestId?: string; retry: () => void }
  | { status: "ready"; data: T };

/** What one read proved; `undefined` data from `select` means malformed. */
export type PanelRead<T> =
  | { kind: "ready"; data: T }
  | { kind: "hidden" }
  | { kind: "error"; requestId?: string };

export interface ApiResult {
  status: number;
  data?: unknown;
  error?: unknown;
}

export interface OverviewScope {
  tenantId: string | null;
  activeStoreId: string | null;
}

export const OVERVIEW_KEY = ["overview"] as const;

export function overviewKey(panel: string, scope: OverviewScope): readonly unknown[] {
  return [...OVERVIEW_KEY, panel, scope.tenantId, scope.activeStoreId];
}

function requestIdOf(error: unknown): string | undefined {
  return (error as { error?: { request_id?: string } } | undefined)?.error?.request_id ?? undefined;
}

/** A refusal, a failure, or the selected payload (a malformed one is a failure). */
export function readResult<T>(
  res: ApiResult,
  select: (data: unknown) => T | undefined,
): PanelRead<T> {
  if (res.status >= 400) {
    return isRefusal(res.status)
      ? { kind: "hidden" }
      : { kind: "error", requestId: requestIdOf(res.error) };
  }
  const data = select(res.data);
  return data === undefined ? { kind: "error" } : { kind: "ready", data };
}

/** A page body's item list, or undefined when the body has none. */
export function itemsOf(data: unknown): unknown[] | undefined {
  const items = (data as { items?: unknown } | undefined)?.items;
  return Array.isArray(items) ? items : undefined;
}

export type PanelGate = "run" | "wait" | "skip";

export interface PanelQuery<T> {
  key: readonly unknown[];
  /** `skip`: known refused for this role; `wait`: needs something first. */
  gate: PanelGate;
  read: () => Promise<PanelRead<T>>;
}

export function usePanelQuery<T>({ key, gate, read }: PanelQuery<T>): PanelState<T> {
  const query = useQuery<PanelRead<T>>({
    queryKey: key,
    enabled: gate === "run",
    queryFn: read,
    retry: false,
  });
  if (gate === "skip") return { status: "hidden" };
  const retry = () => void query.refetch();
  const result = query.data;
  const failed = query.isError || result?.kind === "error";
  // A retry in flight reads as loading again, not as the old failure.
  if (gate === "wait" || (failed && query.isFetching)) return { status: "loading" };
  if (query.isError) return { status: "error", retry };
  if (!result) return { status: "loading" };
  if (result.kind === "error") return { status: "error", requestId: result.requestId, retry };
  if (result.kind === "hidden") return { status: "hidden" };
  return { status: "ready", data: result.data };
}
