/**
 * RT-726 — the guarded repair request for one NEEDS_REPAIR sale
 * (`consoleRepairSaleSync`). Two explicit steps: "Request repair" opens an
 * inline confirmation that names the sale and says what the repair does and
 * does not do; only "Confirm repair" sends the one POST. It is never sent on
 * its own, never retried by the client, and there is no "repair all".
 *
 * The outcome shown is the server's: a 200 shows the status it returned; a
 * 5xx or a lost response is "not confirmed" (the server may have acted), and
 * the next confirmation replays the same Idempotency-Key.
 *
 * "Confirm repair" is the one write, so it sits behind the shared 429 gate
 * (RT-621 `GatedButton`): while a Retry-After runs it is held and sends nothing.
 */
import { Banner, type BannerVariant } from "@/components/Banner";
import { GatedButton } from "@/components/GatedButton";
import { type T, useT } from "@/i18n";
import { useEffect, useRef, useState } from "react";
import { Machine } from "./parts";
import { type RepairOutcome, syncStatusView } from "./saleSyncLogic";
import type { RepairState } from "./useSaleSync";

const VARIANTS: Record<RepairOutcome["kind"], BannerVariant> = {
  repaired: "success",
  conflict: "warning",
  "key-conflict": "warning",
  "rate-limited": "warning",
  unconfirmed: "warning",
  "not-found": "danger",
  forbidden: "danger",
  session: "danger",
  rejected: "danger",
};

function outcomeMessage(t: T, outcome: RepairOutcome): string {
  if (outcome.kind === "repaired") {
    return t("saleSync.repair.success", {
      status: t(syncStatusView(outcome.status.syncStatus).labelKey),
    });
  }
  if (outcome.kind === "rate-limited" && outcome.retryAfter) {
    return t("saleSync.repair.error.rateLimitedFor", { count: outcome.retryAfter });
  }
  return t(outcome.messageKey);
}

/** Nothing holds focus: the element that had it was removed. */
function focusIsLost(): boolean {
  const active = document.activeElement;
  return active === null || active === document.body;
}

/**
 * The server's answer to the last repair request, until the next one starts.
 * When the answer removed the control that had focus (a repaired sale is no
 * longer repairable), focus moves here instead of falling to the page.
 */
export function RepairOutcomeBanner({
  outcome,
}: Readonly<{ outcome: RepairOutcome | undefined }>): React.JSX.Element | null {
  const t = useT();
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (outcome && focusIsLost()) holder.current?.focus();
  }, [outcome]);
  if (!outcome) return null;
  return (
    <div ref={holder} tabIndex={-1}>
      <Banner
        variant={VARIANTS[outcome.kind]}
        message={outcomeMessage(t, outcome)}
        requestId={outcome.kind === "repaired" ? undefined : outcome.requestId}
      />
    </div>
  );
}

export function RepairControl({
  reference,
  repair,
}: Readonly<{ reference: string; repair: RepairState }>): React.JSX.Element {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  // Focus follows the step: into the confirmation, and back to its invoker.
  useEffect(() => {
    if (confirming) confirmButton.current?.focus();
    else if (wasConfirming.current) opener.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const confirm = async () => {
    await repair.repair();
    setConfirming(false);
  };

  return (
    <div className="sale-sync__repair">
      <h3 className="sale-sync__subtitle">{t("saleSync.repair.title")}</h3>
      <p className="content__sub">{t("saleSync.repair.explain")}</p>
      {confirming ? (
        <section className="surface__confirm" aria-label={t("saleSync.repair.confirmLabel")}>
          <p className="surface__confirm-msg">
            {t.rich("saleSync.repair.confirmPrompt", { ref: <Machine value={reference} /> })}
          </p>
          <div className="surface__confirm-actions">
            <GatedButton
              ref={confirmButton}
              className="btn-primary"
              disabled={repair.pending}
              onClick={() => void confirm()}
            >
              {repair.pending ? <span className="spinner" aria-hidden="true" /> : null}
              {t("saleSync.repair.confirm")}
            </GatedButton>
            <button
              type="button"
              className="btn-secondary"
              disabled={repair.pending}
              onClick={() => setConfirming(false)}
            >
              {t("common.cancel")}
            </button>
          </div>
          {repair.pending ? (
            <output className="content__sub" aria-live="polite">
              {t("saleSync.repair.sending")}
            </output>
          ) : null}
        </section>
      ) : (
        <div>
          <button
            ref={opener}
            type="button"
            className="btn-secondary"
            onClick={() => {
              repair.reset();
              setConfirming(true);
            }}
          >
            {t("saleSync.repair.action")}
          </button>
        </div>
      )}
    </div>
  );
}
