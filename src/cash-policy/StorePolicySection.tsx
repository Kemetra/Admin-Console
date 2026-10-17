import { InlineError } from "@/components/InlineError";
/**
 * RT-389 store page section (AD-CASH-001 F6): the store's effective (resolved)
 * policy and its source exactly as Backend-Core returns them, the tenant
 * default it inherits, the active override, an override form (required reason,
 * optional expiry), a Clear action and the store's revision history.
 *
 * Roles mirror the API: owner / tenant_admin edit and see the history;
 * store_manager reads the policy and sees no edit control and no history (the
 * revision list is not open to them); anyone else gets nothing and nothing is
 * requested. No expiry (or one beyond the horizon) makes an override permanent
 * and owner-only (DR-4): the rule is always explained, a tenant_admin is told
 * to ask an owner when no expiry is set, and the server's 403 is still shown if
 * it refuses. Inheritance and stricter-only are the server's (K-9).
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { DateTime, useT } from "@/i18n";
import type {
  ActiveStoreOverride,
  StoreCashVariancePolicy,
} from "@/lib/cash-variance-policy-queries";
import { useState } from "react";
import { PolicyForm, type PolicyFormProps } from "./PolicyForm";
import { PolicyHistory } from "./PolicyHistory";
import { type Notice, PolicyNotice, noticeFor } from "./PolicyNotice";
import { Field, MachineId, PolicyValue, SourceBadge } from "./PolicyParts";
import { PolicyReadState } from "./PolicyReadState";
import { canApprovePermanent, canConfigurePolicy, canReadStorePolicy } from "./policyAccess";
import {
  amountForInput,
  buildStoreClearBody,
  buildStoreSetBody,
  validateDraft,
} from "./policyLogic";
import { usePublishStoreOverride, useStorePolicy, useStoreRevisions } from "./useCashPolicy";
import "./cash-policy.css";

function StoreHistory({
  storeId,
  timeZone,
}: Readonly<{ storeId: string; timeZone: string }>): React.JSX.Element {
  return <PolicyHistory list={useStoreRevisions({ storeId })} timeZone={timeZone} />;
}

function OverrideFacts({
  override,
  timeZone,
}: Readonly<{ override: ActiveStoreOverride; timeZone: string }>): React.JSX.Element {
  const t = useT();
  return (
    <>
      <PolicyValue value={override.policyValue} />
      {override.permanent ? (
        <>
          {" "}
          <span className="badge">{t("cashPolicy.override.permanent")}</span>
        </>
      ) : null}
      <span className="cash-policy__line">
        {t("cashPolicy.field.reason")}: <bdi dir="auto">{override.reason}</bdi>
      </span>
      <span className="cash-policy__line">
        {t("cashPolicy.field.until")}:{" "}
        {override.effectiveUntil ? (
          <DateTime value={override.effectiveUntil} timeZone={timeZone} />
        ) : (
          t("cashPolicy.override.noExpiry")
        )}
      </span>
      {override.approvedByUserId ? (
        <span className="cash-policy__line">
          {t("cashPolicy.field.approvedBy")}: <MachineId value={override.approvedByUserId} />
        </span>
      ) : null}
    </>
  );
}

function ClearOverrideForm({
  pending,
  onSubmit,
}: Readonly<{ pending: boolean; onSubmit: (reason: string) => void }>): React.JSX.Element {
  const t = useT();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<ReturnType<typeof validateDraft>["reason"]>();

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const found = validateDraft(
      { mode: "none", limitAmount: "", reason, expiry: "" },
      { requireExpiry: false },
    );
    setError(found.reason);
    if (!found.reason) onSubmit(reason);
  }

  return (
    <form className="surface__form cash-policy__form" onSubmit={submit} noValidate>
      <h3 className="surface__section-title">{t("cashPolicy.form.clearTitle")}</h3>
      <div className="field">
        <label htmlFor="cash-policy-clear-reason">{t("cashPolicy.form.clearReason")}</label>
        <input
          id="cash-policy-clear-reason"
          className="input"
          autoComplete="off"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={error ? "true" : undefined}
          aria-describedby="cash-policy-clear-error"
        />
        <span id="cash-policy-clear-error">
          <InlineError message={error ? t(error) : undefined} />
        </span>
      </div>
      <div className="surface__actions">
        <button type="submit" className="btn-secondary" disabled={pending}>
          {t("cashPolicy.form.clear")}
        </button>
      </div>
    </form>
  );
}

/**
 * The value the override form starts from: the active override when there is
 * one (so editing only its reason or expiry cannot silently reset its limit),
 * else the tenant default. Both are server values; nothing is resolved here.
 */
function startingValue(policy: StoreCashVariancePolicy): PolicyFormProps["initial"] {
  const { mode, limitAmount } = (policy.activeOverride ?? policy.tenantDefault).policyValue;
  return { mode, limitAmount: amountForInput(limitAmount) };
}

function StorePolicyBody({
  storeId,
  timeZone,
  editable,
  isOwner,
}: Readonly<{ storeId: string; timeZone: string; editable: boolean; isOwner: boolean }>) {
  const t = useT();
  const read = useStorePolicy({ storeId });
  const publisher = usePublishStoreOverride({ storeId });
  const [notice, setNotice] = useState<Notice | undefined>();
  const [formKey, setFormKey] = useState(0);
  const policy: StoreCashVariancePolicy | undefined =
    read.result?.kind === "ok" ? read.result.data : undefined;

  async function publish(
    body: Parameters<typeof publisher.submit>[0],
    savedKey: "cashPolicy.form.saved" | "cashPolicy.form.cleared",
  ): Promise<void> {
    setNotice(undefined);
    const outcome = await publisher.submit(body);
    setNotice(noticeFor(outcome, savedKey));
    if (outcome.kind === "saved") setFormKey((k) => k + 1);
  }

  return (
    <section className="cash-policy" aria-labelledby="cash-policy-store-title">
      <header>
        <h2 id="cash-policy-store-title" className="surface__section-title">
          {t("cashPolicy.store.title")}
        </h2>
        <p className="content__sub">{t("cashPolicy.store.sub")}</p>
      </header>

      <PolicyReadState
        isLoading={read.isLoading}
        result={read.result}
        onRetry={() => void read.refetch()}
      />

      {policy ? (
        <>
          <dl className="surface__detail">
            <Field label={t("cashPolicy.field.effective")}>
              <PolicyValue value={policy.effective.policyValue} />
            </Field>
            <Field label={t("cashPolicy.field.source")}>
              <SourceBadge source={policy.effective.policySource} />
            </Field>
            <Field label={t("cashPolicy.field.tenantDefault")}>
              <PolicyValue value={policy.tenantDefault.policyValue} />
            </Field>
            <Field label={t("cashPolicy.field.override")}>
              {policy.activeOverride ? (
                <OverrideFacts override={policy.activeOverride} timeZone={timeZone} />
              ) : (
                <span>{t("cashPolicy.override.none")}</span>
              )}
            </Field>
          </dl>

          {editable ? (
            <>
              <PolicyNotice
                notice={notice}
                onRefresh={() => {
                  setNotice(undefined);
                  void read.refetch();
                }}
              />
              <PolicyForm
                key={`set-${formKey}`}
                idPrefix="cash-policy-store"
                titleKey="cashPolicy.form.overrideTitle"
                initial={startingValue(policy)}
                pending={publisher.pending}
                expiry={{
                  timeZone,
                  horizonDays: policy.permanentOverrideHorizonDays,
                  required: !isOwner,
                }}
                onSubmit={(draft) =>
                  void publish(
                    buildStoreSetBody(draft, policy.latestRevisionId, timeZone),
                    "cashPolicy.form.saved",
                  )
                }
              />
              {policy.activeOverride ? (
                <ClearOverrideForm
                  key={`clear-${formKey}`}
                  pending={publisher.pending}
                  onSubmit={(reason) =>
                    void publish(
                      buildStoreClearBody(reason, policy.latestRevisionId),
                      "cashPolicy.form.cleared",
                    )
                  }
                />
              ) : null}
              <StoreHistory storeId={storeId} timeZone={timeZone} />
            </>
          ) : (
            <p className="field__hint">{t("cashPolicy.readOnly")}</p>
          )}
        </>
      ) : null}
    </section>
  );
}

export function StorePolicySection({
  storeId,
  timeZone,
}: Readonly<{ storeId: string; timeZone?: string }>): React.JSX.Element | null {
  const { context } = useActiveContextValue();
  const role = context?.active_role_code;
  if (!canReadStorePolicy(role)) return null;
  return (
    <StorePolicyBody
      storeId={storeId}
      timeZone={timeZone ?? "UTC"}
      editable={canConfigurePolicy(role)}
      isOwner={canApprovePermanent(role)}
    />
  );
}
