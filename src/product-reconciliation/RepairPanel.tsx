/**
 * RT-727 repair of one product's ERPNext mapping (`repairProductMapping`,
 * `suggest_confirm`). An inline panel, not a modal (DESIGN.md): the operator
 * types the ERPNext item reference, reviews a confirm step that names the
 * product and the reference, and only then is one request sent, with one
 * Idempotency-Key minted for that confirmation. Nothing is retried: a refusal
 * is shown and the operator decides whether to act again. The server's
 * recorded outcome (`mapped`, `no_op_echo`, `still_unmapped`, `conflict`, or a
 * value this build does not know) is shown as received.
 */
import { useT } from "@/i18n";
import { useId, useState } from "react";
import { OutcomeBanner, Raw, RefusalBanner } from "./parts";
import {
  ITEM_REF_MAX,
  type RepairOutcome,
  type RepairTarget,
  itemRefOf,
  newIdempotencyKey,
  repairOutcomeView,
  suggestConfirmRequest,
} from "./productReconLogic";
import { type ReconScope, useRepair } from "./useProductReconciliation";

export interface RepairPanelProps {
  scope: ReconScope;
  target: RepairTarget;
  onClose: () => void;
}

function RecordedOutcome({
  outcome,
}: Readonly<{ outcome: Extract<RepairOutcome, { kind: "recorded" }> }>): React.JSX.Element {
  const t = useT();
  return (
    <OutcomeBanner
      view={repairOutcomeView(outcome.repair.outcome)}
      title={t("productRecon.repair.recordedTitle")}
    />
  );
}

export function RepairPanel({
  scope,
  target,
  onClose,
}: Readonly<RepairPanelProps>): React.JSX.Element {
  const t = useT();
  const inputId = useId();
  const hintId = useId();
  const repair = useRepair(scope);
  const [input, setInput] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [outcome, setOutcome] = useState<RepairOutcome | null>(null);
  const ref = itemRefOf(input);
  const invalid = touched && ref === null;

  async function confirm(): Promise<void> {
    if (ref === null) return;
    setOutcome(null);
    const result = await repair.mutateAsync({
      request: suggestConfirmRequest(target, ref),
      idempotencyKey: newIdempotencyKey(),
    });
    setConfirming(false);
    setOutcome(result);
  }

  const recorded = outcome?.kind === "recorded";

  return (
    <section className="recon-repair" aria-label={t("productRecon.repair.label")}>
      <h3 className="recon-repair__title">{t("productRecon.repair.title")}</h3>
      <p className="content__sub">
        {t.rich("productRecon.repair.product", { product: <Raw value={target.tenantProductId} /> })}
      </p>

      {outcome?.kind === "recorded" ? <RecordedOutcome outcome={outcome} /> : null}
      {outcome?.kind === "refused" ? <RefusalBanner outcome={outcome} /> : null}

      {recorded ? null : (
        <form
          className="recon-repair__form"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (ref !== null) setConfirming(true);
          }}
        >
          <div className="field">
            <label htmlFor={inputId}>{t("productRecon.repair.ref")}</label>
            <input
              id={inputId}
              className="input"
              dir="ltr"
              maxLength={ITEM_REF_MAX}
              value={input}
              aria-invalid={invalid}
              aria-describedby={hintId}
              disabled={confirming || repair.isPending}
              onChange={(e) => {
                setInput(e.target.value);
                setConfirming(false);
              }}
              onBlur={() => setTouched(true)}
            />
            <p id={hintId} className={invalid ? "recon-repair__error" : "recon-repair__hint"}>
              {t(invalid ? "productRecon.repair.refInvalid" : "productRecon.repair.refHint")}
            </p>
          </div>
          {confirming ? null : (
            <div className="recon-actions">
              <button type="submit" className="btn-primary">
                {t("productRecon.repair.review")}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>
                {t("common.cancel")}
              </button>
            </div>
          )}
        </form>
      )}

      {confirming && ref !== null ? (
        <section className="recon-confirm" aria-label={t("productRecon.repair.confirmLabel")}>
          <p>
            {t.rich("productRecon.repair.confirmPrompt", {
              product: <Raw value={target.tenantProductId} />,
              ref: <Raw value={ref} />,
            })}
          </p>
          <div className="recon-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={repair.isPending}
              onClick={() => void confirm()}
            >
              {repair.isPending ? <span className="spinner" aria-hidden="true" /> : null}
              {t("productRecon.repair.confirm")}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={repair.isPending}
              onClick={() => setConfirming(false)}
            >
              {t("productRecon.repair.back")}
            </button>
          </div>
        </section>
      ) : null}

      {recorded ? (
        <div className="recon-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t("productRecon.repair.close")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
