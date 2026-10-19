/**
 * RT-665 hook: a TanStack Query binding over the one AI entitlements read.
 *
 * A refusal travels in the RESULT (`{ kind: "error", status }`), so a component
 * branches on data, not on a thrown error. A body that is not the contract's
 * shape, or a request that threw (offline, aborted) before any status, is a load
 * failure (status 0), never a crash. The server's view is projected for the
 * caller's role by `toPanelModel`; nothing here decides entitlement.
 */
import { consoleGetTenantAiEntitlements } from "@/lib/ai-entitlements-queries";
import { useQuery } from "@tanstack/react-query";
import type { AiPlanView } from "./aiAccess";
import { type PanelModel, toPanelModel } from "./aiLogic";

export const aiPlanKeys = {
  tenant: (tenantId: string, view: AiPlanView) => ["ai-entitlements", tenantId, view] as const,
};

export type AiPlanResult =
  | { kind: "ok"; model: PanelModel }
  | { kind: "error"; status: number; requestId?: string };

function requestIdOf(error: unknown): string | undefined {
  const inner = (error as { error?: unknown } | undefined)?.error;
  if (typeof inner !== "object" || inner === null) return undefined;
  const id = (inner as { request_id?: unknown }).request_id;
  return typeof id === "string" ? id : undefined;
}

async function fetchAiPlan(tenantId: string, view: AiPlanView): Promise<AiPlanResult> {
  try {
    const res = await consoleGetTenantAiEntitlements(tenantId);
    if (res.status >= 400) {
      return { kind: "error", status: res.status, requestId: requestIdOf(res.error) };
    }
    const model = toPanelModel(res.data, view);
    return model ? { kind: "ok", model } : { kind: "error", status: 0 };
  } catch {
    return { kind: "error", status: 0 };
  }
}

export interface AiPlanRead {
  result: AiPlanResult | undefined;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
}

export function useAiPlan({
  tenantId,
  view,
}: Readonly<{ tenantId: string; view: AiPlanView }>): AiPlanRead {
  const query = useQuery<AiPlanResult>({
    queryKey: aiPlanKeys.tenant(tenantId, view),
    queryFn: () => fetchAiPlan(tenantId, view),
    retry: false,
  });
  return { result: query.data, isLoading: query.isLoading, refetch: () => query.refetch() };
}
