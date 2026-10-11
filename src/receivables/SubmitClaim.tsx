import { Banner } from "@/components/Banner";
import { Drawer } from "@/components/Drawer";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, formatNumber, useT } from "@/i18n";
import { type ClaimCreateBody, consoleSubmitClaim } from "@/lib/client";
/**
 * 018 SubmitClaim drawer. Submits the selected receivables as a claim for a payer
 * (ClaimCreate: payerRef + receivableRefs 1..500). Client-validates first
 * (validateClaimDraft — wrapper NOT called on invalid), sends a per-submit
 * Idempotency-Key, routes the outcome via classifyWriteOutcome. Mirrors 017's
 * PayerCreate.
 *
 * RT-399: state keeps message KEYS (from the classifier / validator), never
 * translated strings; copy is resolved with `t()` at render.
 */
import { useState } from "react";
import { type ReceivableFieldError, validateClaimDraft } from "./receivableForms";
import { type WriteCopy, classifyWriteOutcome, newIdempotencyKey } from "./settlementWriteOutcome";

const CLAIM_COPY: WriteCopy = {
  validation: "receivables.claim.errors.validation",
  unauthenticated: "receivables.errors.sessionExpired",
  forbidden: "receivables.claim.errors.forbidden",
  conflict: "receivables.claim.errors.conflict",
  error: "receivables.claim.errors.generic",
};

export interface SubmitClaimProps {
  activeTenant: { id: string; name: string };
  payerRef: string;
  receivableRefs: string[];
  onClose: () => void;
  /** Receives the new claimRef (when the response carries one) so the caller can offer reconcile. */
  onSubmitted: (claimRef?: string) => void;
}

type BannerState = { variant: "danger" | "warning"; messageKey: MessageKey; requestId?: string };

export function SubmitClaim({
  activeTenant,
  payerRef,
  receivableRefs,
  onClose,
  onSubmitted,
}: SubmitClaimProps): React.JSX.Element {
  const t = useT();
  const [fieldError, setFieldError] = useState<ReceivableFieldError | undefined>();
  const [banner, setBanner] = useState<BannerState | undefined>();
  const [pending, setPending] = useState(false);

  async function submitWithKey(body: ClaimCreateBody, key: string): Promise<void> {
    const res = await consoleSubmitClaim(body, key);
    const outcome = classifyWriteOutcome(
      {
        status: res.status,
        headers: res.headers,
        error: res.error as { error?: { code?: string; request_id?: string } } | undefined,
      },
      CLAIM_COPY,
    );
    switch (outcome.kind) {
      case "ok":
      case "replayed": {
        const claimRef = (res.data as { claimRef?: string } | undefined)?.claimRef;
        onSubmitted(claimRef);
        return;
      }
      case "validation":
        setFieldError({ messageKey: outcome.messageKey });
        return;
      case "regenerate-key":
        await submitWithKey(body, newIdempotencyKey());
        return;
      case "unauthenticated":
        setBanner({ variant: "warning", messageKey: outcome.messageKey });
        return;
      default:
        // forbidden / key-conflict / conflict / error: each carries its own copy.
        setBanner({
          variant: "danger",
          messageKey: outcome.messageKey,
          requestId: outcome.requestId,
        });
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFieldError(undefined);
    setBanner(undefined);

    const errors = validateClaimDraft({ payerRef, receivableRefs });
    if (errors.payerRef || errors.receivableRefs) {
      setFieldError(errors.receivableRefs ?? errors.payerRef);
      return;
    }

    setPending(true);
    try {
      await submitWithKey({ payerRef, receivableRefs }, newIdempotencyKey());
    } finally {
      setPending(false);
    }
  }

  return (
    <Drawer title={t("receivables.claim.title")} onClose={onClose}>
      {banner ? (
        <Banner
          variant={banner.variant}
          message={t(banner.messageKey)}
          requestId={banner.requestId}
        />
      ) : null}

      <form className="surface__form" onSubmit={onSubmit} noValidate>
        <p className="surface__scope-line">
          {t.rich("receivables.claim.scopeLine", {
            count: receivableRefs.length,
            total: <strong>{formatNumber(receivableRefs.length, t.locale)}</strong>,
            tenant: (
              <strong>
                <bdi>{activeTenant.name}</bdi>
              </strong>
            ),
          })}
        </p>
        <span id="claim-error">
          <InlineError
            message={fieldError ? t(fieldError.messageKey, fieldError.params) : undefined}
          />
        </span>
        <div className="surface__actions">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {t("receivables.claim.submit")}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
