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

interface RefFormProps {
  input: string;
  locked: boolean;
  onInput: (value: string) => void;
  onReview: (ref: string) => void;
  onCancel: () => void;
}

/** Step 1: the ERPNext item reference, checked against the contract bound before review. */
function RefForm({ input, locked, onInput, onReview, onCancel }: Readonly<RefFormProps>) {
  const t = useT();
  const inputId = useId();
  const hintId = useId();
  const [touched, setTouched] = useState(false);
  const invalid = touched && itemRefOf(input) === null;
  return (
    <form
      className="recon-repair__form"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        const ref = itemRefOf(input);
        if (ref !== null) onReview(ref);
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
          disabled={locked}
          onChange={(e) => onInput(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        <p id={hintId} className={invalid ? "recon-repair__error" : "recon-repair__hint"}>
          {t(invalid ? "productRecon.repair.refInvalid" : "productRecon.repair.refHint")}
        </p>
      </div>
      {locked ? null : (
        <div className="recon-actions">
          <button type="submit" className="btn-primary">
            {t("productRecon.repair.review")}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      )}
    </form>
  );
}

interface ConfirmStepProps {
  productId: string;
  itemRef: string;
  pending: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

/** Step 2: names the product and the reference; only this sends the request. */
function ConfirmStep({
  productId,
  itemRef,
  pending,
  onConfirm,
  onBack,
}: Readonly<ConfirmStepProps>) {
  const t = useT();
  return (
    <section className="recon-confirm" aria-label={t("productRecon.repair.confirmLabel")}>
      <p>
        {t.rich("productRecon.repair.confirmPrompt", {
          product: <Raw value={productId} />,
          ref: <Raw value={itemRef} />,
        })}
      </p>
      <div className="recon-actions">
        <button type="button" className="btn-primary" disabled={pending} onClick={onConfirm}>
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {t("productRecon.repair.confirm")}
        </button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={onBack}>
          {t("productRecon.repair.back")}
        </button>
      </div>
    </section>
  );
}

/** The server's answer: a recorded outcome, or a refusal. */
function Outcome({ outcome }: Readonly<{ outcome: RepairOutcome | null }>) {
  if (outcome?.kind === "recorded") return <RecordedOutcome outcome={outcome} />;
  if (outcome?.kind === "refused") return <RefusalBanner outcome={outcome} />;
  return null;
}

function CloseButton({ onClose }: Readonly<{ onClose: () => void }>): React.JSX.Element {
  const t = useT();
  return (
    <div className="recon-actions">
      <button type="button" className="btn-secondary" onClick={onClose}>
        {t("productRecon.repair.close")}
      </button>
    </div>
  );
}

export function RepairPanel({
  scope,
  target,
  onClose,
}: Readonly<RepairPanelProps>): React.JSX.Element {
  const t = useT();
  const repair = useRepair(scope);
  const [input, setInput] = useState("");
  /** The reference under review; set only between Review and the server's answer. */
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<RepairOutcome | null>(null);

  async function confirm(ref: string): Promise<void> {
    setOutcome(null);
    const result = await repair.mutateAsync({
      request: suggestConfirmRequest(target, ref),
      idempotencyKey: newIdempotencyKey(),
    });
    setReviewing(null);
    setOutcome(result);
  }

  const recorded = outcome?.kind === "recorded";

  return (
    <section className="recon-repair" aria-label={t("productRecon.repair.label")}>
      <h3 className="recon-repair__title">{t("productRecon.repair.title")}</h3>
      <p className="content__sub">
        {t.rich("productRecon.repair.product", { product: <Raw value={target.tenantProductId} /> })}
      </p>
      <Outcome outcome={outcome} />
      {recorded ? (
        <CloseButton onClose={onClose} />
      ) : (
        <RefForm
          input={input}
          locked={reviewing !== null}
          onInput={setInput}
          onReview={setReviewing}
          onCancel={onClose}
        />
      )}
      {reviewing === null ? null : (
        <ConfirmStep
          productId={target.tenantProductId}
          itemRef={reviewing}
          pending={repair.isPending}
          onConfirm={() => void confirm(reviewing)}
          onBack={() => setReviewing(null)}
        />
      )}
    </section>
  );
}
