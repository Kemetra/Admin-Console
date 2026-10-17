/**
 * RT-389 tenant page section (AD-CASH-001 F6): the tenant's default shift
 * variance policy (`none`, or `limit` with amount and currency) and Apply Now.
 * Owner / tenant_admin only, and only for the tenant the session is in (the API
 * answers a non-disclosing 404 for any other), so for anyone else nothing is
 * rendered and nothing is requested. The read carries the concurrency token
 * for the publish; the server resolves and refuses, the UI renders.
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { useT } from "@/i18n";
import { useState } from "react";
import { PolicyForm } from "./PolicyForm";
import { PolicyHistory } from "./PolicyHistory";
import { type Notice, PolicyNotice, noticeFor } from "./PolicyNotice";
import { Field, PolicyValue, RevisionFacts, SourceBadge } from "./PolicyParts";
import { PolicyReadState } from "./PolicyReadState";
import { canConfigurePolicy } from "./policyAccess";
import { amountForInput, buildTenantBody } from "./policyLogic";
import { usePublishTenant, useTenantPolicy, useTenantRevisions } from "./useCashPolicy";
import "./cash-policy.css";

function TenantHistory({ tenantId }: Readonly<{ tenantId: string }>): React.JSX.Element {
  return <PolicyHistory list={useTenantRevisions({ tenantId })} />;
}

function TenantPolicyBody({ tenantId }: Readonly<{ tenantId: string }>): React.JSX.Element {
  const t = useT();
  const read = useTenantPolicy({ tenantId });
  const publisher = usePublishTenant({ tenantId });
  const [notice, setNotice] = useState<Notice | undefined>();
  // A new key remounts the form (a clean draft) after a successful publish only.
  const [formKey, setFormKey] = useState(0);
  const policy = read.result?.kind === "ok" ? read.result.data : undefined;

  async function onSubmit(draft: Parameters<typeof buildTenantBody>[0]): Promise<void> {
    if (!policy) return;
    setNotice(undefined);
    const outcome = await publisher.submit(buildTenantBody(draft, policy.latestRevisionId));
    setNotice(noticeFor(outcome, "cashPolicy.form.saved"));
    if (outcome.kind === "saved") setFormKey((k) => k + 1);
  }

  const { tenantDefault, latestRevision } = policy ?? {};
  return (
    <section className="cash-policy" aria-labelledby="cash-policy-tenant-title">
      <header>
        <h2 id="cash-policy-tenant-title" className="surface__section-title">
          {t("cashPolicy.tenant.title")}
        </h2>
        <p className="content__sub">{t("cashPolicy.tenant.sub")}</p>
      </header>

      <PolicyReadState
        isLoading={read.isLoading}
        result={read.result}
        onRetry={() => void read.refetch()}
      />

      {policy && tenantDefault ? (
        <>
          <dl className="surface__detail">
            <Field label={t("cashPolicy.field.default")}>
              <PolicyValue value={tenantDefault.policyValue} />
            </Field>
            <Field label={t("cashPolicy.field.source")}>
              <SourceBadge source={tenantDefault.policySource} />
            </Field>
            {latestRevision ? (
              <RevisionFacts
                reason={latestRevision.reason}
                effectiveFrom={latestRevision.effectiveFrom}
                createdByUserId={latestRevision.createdByUserId}
              />
            ) : null}
          </dl>

          <PolicyNotice
            notice={notice}
            onRefresh={() => {
              setNotice(undefined);
              void read.refetch();
            }}
          />

          <PolicyForm
            key={formKey}
            idPrefix="cash-policy-tenant"
            titleKey="cashPolicy.form.tenantTitle"
            initial={{
              mode: tenantDefault.policyValue.mode,
              limitAmount: amountForInput(tenantDefault.policyValue.limitAmount),
            }}
            pending={publisher.pending}
            onSubmit={(draft) => void onSubmit(draft)}
          />

          <TenantHistory tenantId={tenantId} />
        </>
      ) : null}
    </section>
  );
}

export function TenantPolicySection({
  tenantId,
}: Readonly<{ tenantId: string }>): React.JSX.Element | null {
  const { context } = useActiveContextValue();
  const allowed =
    canConfigurePolicy(context?.active_role_code) && context?.active_tenant?.id === tenantId;
  return allowed ? <TenantPolicyBody tenantId={tenantId} /> : null;
}
