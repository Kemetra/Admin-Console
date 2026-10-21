/**
 * RT-665 tenant page section (AD-AI-ENT-001 D-6; RT-644 ENT-AC1): a read-only
 * panel of the tenant's AI plan & usage. Owner / tenant_admin see the full view
 * (state, dates, every feature's status, opt-outs and request meters);
 * store_manager sees only which features are available in their stores, with no
 * plan, meter or commercial detail; anyone else gets nothing rendered and nothing
 * requested. Only for the tenant the session is in (the API answers a
 * non-disclosing 404 for any other). The server decides every state and figure;
 * the UI renders. There is no grant control and no opt-out control here (the
 * opt-out write is a later item), and no price, token cost or credit balance is
 * ever shown.
 *
 * Unreleased: the Backend-Core runtime (RT-664) does not exist yet, so the panel
 * follows the console's earlier gated-nav precedent (the dev-only placeholders
 * `AppShell` used to list): it is on in development builds and off in a
 * production build until the runtime ships. `enabled` lets a test, or the release that turns it on, force it.
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { useT } from "@/i18n";
import { FullView, MinimalView } from "./AiPlanParts";
import { AiPlanReadState } from "./AiPlanReadState";
import { type AiPlanView, aiPlanViewFor } from "./aiAccess";
import { useAiPlan } from "./useAiPlan";
import "./ai-plan.css";

function AiPlanBody({
  tenantId,
  view,
}: Readonly<{ tenantId: string; view: AiPlanView }>): React.JSX.Element {
  const t = useT();
  const read = useAiPlan({ tenantId, view });
  const model = read.result?.kind === "ok" ? read.result.model : undefined;
  const titleId = `ai-plan-${view}-title`;

  return (
    <section className="ai-plan" aria-labelledby={titleId}>
      <header>
        <h2 id={titleId} className="surface__section-title">
          {t(`aiPlan.${view}.title`)}
        </h2>
        <p className="content__sub">{t(`aiPlan.${view}.sub`)}</p>
      </header>

      <AiPlanReadState
        view={view}
        isLoading={read.isLoading}
        result={read.result}
        onRetry={() => void read.refetch()}
      />

      {model?.kind === "full" ? <FullView model={model} /> : null}
      {model?.kind === "minimal" ? <MinimalView model={model} /> : null}
    </section>
  );
}

export function TenantAiPlanSection({
  tenantId,
  enabled = import.meta.env.DEV,
}: Readonly<{ tenantId: string; enabled?: boolean }>): React.JSX.Element | null {
  const { context } = useActiveContextValue();
  const view = aiPlanViewFor(context?.active_role_code);
  const allowed = enabled && view !== undefined && context?.active_tenant?.id === tenantId;
  return allowed && view ? <AiPlanBody tenantId={tenantId} view={view} /> : null;
}
