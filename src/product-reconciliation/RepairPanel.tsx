/**
 * RT-727 repair of one product's ERPNext mapping (`repairProductMapping`). An
 * inline panel, not a modal (DESIGN.md).
 *
 * - `suggest_confirm`: the operator types the ERPNext item reference, reviews a
 *   confirm step that names the product and the reference, and only then is
 *   one request sent.
 * - `confirm` / `re_point` (RT-733): the confirm step names the product, the
 *   mapping and the version the server sent with the row; the request carries
 *   exactly that `mappingId` and `version`. A 409 means the version went stale
 *   (or the request was reused): the reads are re-read and the panel offers
 *   only Close, so the operator acts again from the fresh row, never with the
 *   stale version.
 *
 * Every confirm mints one Idempotency-Key and is a GatedButton (a running
 * Retry-After holds it). Nothing is retried: a refusal is shown and the
 * operator decides whether to act again. The server's recorded outcome
 * (`mapped`, `no_op_echo`, `still_unmapped`, `conflict`, or a value this build
 * does not know) is shown as received.
 */
import { GatedButton } from "@/components/GatedButton";
import { useT } from "@/i18n";
import { useId, useRef, useState } from "react";
import { OutcomeBanner, Raw, RefusalBanner } from "./parts";
import {
  ITEM_REF_MAX,
  type RefusedOutcome,
  type RepairOutcome,
  type RepairTarget,
  itemRefOf,
  mappingRepairRequest,
  newIdempotencyKey,
  refusalView,
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
      view={repairOutcomeView(outcome.repair.outcome, outcome.repair.repairKind)}
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
        <GatedButton className="btn-primary" disabled={pending} onClick={onConfirm}>
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {t("productRecon.repair.confirm")}
        </GatedButton>
        <button type="button" className="btn-secondary" disabled={pending} onClick={onBack}>
          {t("productRecon.repair.back")}
        </button>
      </div>
    </section>
  );
}

/** A 409 on a `confirm` / `re_point`: the version the row was read at is no longer current. */
function StaleVersionBanner({
  outcome,
  version,
}: Readonly<{ outcome: RefusedOutcome; version: number }>): React.JSX.Element {
  const t = useT();
  return (
    <OutcomeBanner
      view={refusalView("conflict")}
      message={t("productRecon.refusal.staleVersion", { version })}
      requestId={outcome.requestId}
    />
  );
}

/** The server's answer: a recorded outcome, or a refusal. */
function Outcome({
  outcome,
  staleVersion,
}: Readonly<{ outcome: RepairOutcome | null; staleVersion?: number }>) {
  if (outcome?.kind === "recorded") return <RecordedOutcome outcome={outcome} />;
  if (outcome?.kind === "refused" && outcome.refusal === "conflict" && staleVersion) {
    return <StaleVersionBanner outcome={outcome} version={staleVersion} />;
  }
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

/**
 * `confirm` / `re_point` of the mapping the row was read with. The confirm step
 * is shown at once (there is nothing to type); after a recorded outcome or a
 * stale-version 409 only Close remains.
 */
function MappingRepair({ scope, target, onClose }: Readonly<RepairPanelProps>): React.JSX.Element {
  const t = useT();
  const repair = useRepair(scope);
  const [outcome, setOutcome] = useState<RepairOutcome | null>(null);
  const request = mappingRepairRequest(target);
  const repoint = target.repairKind === "re_point";
  const version = target.mapping?.version;
  /** One request per confirmed click: a second click before the answer sends nothing. */
  const inFlight = useRef(false);

  async function confirm(): Promise<void> {
    if (!request || inFlight.current) return;
    inFlight.current = true;
    setOutcome(null);
    try {
      setOutcome(await repair.mutateAsync({ request, idempotencyKey: newIdempotencyKey() }));
    } finally {
      inFlight.current = false;
    }
  }

  const done =
    outcome?.kind === "recorded" || (outcome?.kind === "refused" && outcome.refusal === "conflict");
  const pending = repair.isPending;

  return (
    <section
      className="recon-repair"
      aria-label={t(
        repoint
          ? "productRecon.repair.mapping.repointLabel"
          : "productRecon.repair.mapping.confirmLabel",
      )}
    >
      <h3 className="recon-repair__title">
        {t(
          repoint
            ? "productRecon.repair.mapping.repointLabel"
            : "productRecon.repair.mapping.confirmLabel",
        )}
      </h3>
      <Outcome outcome={outcome} staleVersion={version} />
      {done || !request ? (
        <CloseButton onClose={onClose} />
      ) : (
        <div className="recon-confirm">
          <p>
            {t.rich(
              repoint
                ? "productRecon.repair.mapping.repointPrompt"
                : "productRecon.repair.mapping.confirmPrompt",
              {
                product: <Raw value={target.tenantProductId} />,
                ref: <Raw value={target.erpnextItemRef ?? t("productRecon.none")} />,
                mapping: <Raw value={request.mappingId ?? ""} />,
                version: <Raw value={String(version)} />,
              },
            )}
          </p>
          <div className="recon-actions">
            <GatedButton className="btn-primary" disabled={pending} onClick={() => void confirm()}>
              {pending ? <span className="spinner" aria-hidden="true" /> : null}
              {t(
                repoint
                  ? "productRecon.repair.mapping.repoint"
                  : "productRecon.repair.mapping.confirm",
              )}
            </GatedButton>
            <button type="button" className="btn-secondary" disabled={pending} onClick={onClose}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function RepairPanel(props: Readonly<RepairPanelProps>): React.JSX.Element {
  return props.target.repairKind === "suggest_confirm" ? (
    <SuggestConfirmRepair {...props} />
  ) : (
    <MappingRepair {...props} />
  );
}

/** `suggest_confirm`: the operator types the ERPNext item reference, then reviews. */
function SuggestConfirmRepair({
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
