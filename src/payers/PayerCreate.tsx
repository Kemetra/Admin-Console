import { Banner } from "@/components/Banner";
import { Drawer } from "@/components/Drawer";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import { type PayerAccountCreateBody, consoleCreatePayerAccount } from "@/lib/client";
/**
 * 017 SF2 — Create-payer drawer. Uncontrolled native form (category /
 * displayName / externalRef / store scope). Client-validates via
 * validatePayerDraft (fail-fast UX guard; server stays authoritative), then
 * calls consoleCreatePayerAccount with a per-submit Idempotency-Key and routes
 * the result through classifyPayerCreateOutcome:
 *
 *   201 / replayed   → onCreated (close + refetch list)
 *   400 validation   → inline field error
 *   400 key issue    → regenerate key + resubmit once (not user-facing)
 *   401              → session banner (interceptor owns the redirect)
 *   403              → permission banner
 *   409 key-conflict → regenerate key + "please retry" banner
 *   409 (other)      → non-disclosing conflict banner (no cross-tenant leak)
 *
 * No status/version field — v1 is create-only (OQ-CON-EDIT deferred). Mirrors
 * the InviteMember drawer, minus the 425/auth-disambiguation (payer create has none).
 *
 * RT-399: state keeps message KEYS (from the classifier / validator), never
 * translated strings; copy is resolved with `t()` at render.
 */
import { useState } from "react";
import {
  type PayerCategory,
  type PayerCreateDraft,
  type PayerFieldError,
  validatePayerDraft,
} from "./payerCreateForm";
import {
  type PayerCreateOutcome,
  classifyPayerCreateOutcome,
  newIdempotencyKey,
} from "./payerIdempotency";
import { payerCategoryKey } from "./payerListLogic";

export interface PayerCreateProps {
  activeTenant: { id: string; name: string };
  onClose: () => void;
  onCreated: () => void;
}

type BannerState = { variant: "danger" | "warning"; messageKey: MessageKey; requestId?: string };

export function PayerCreate({
  activeTenant,
  onClose,
  onCreated,
}: PayerCreateProps): React.JSX.Element {
  const t = useT();
  const [nameError, setNameError] = useState<PayerFieldError | undefined>();
  const [banner, setBanner] = useState<BannerState | undefined>();
  const [pending, setPending] = useState(false);

  async function submitWithKey(body: PayerAccountCreateBody, key: string): Promise<void> {
    const res = await consoleCreatePayerAccount(body, key);
    const classified: PayerCreateOutcome = classifyPayerCreateOutcome({
      status: res.status,
      headers: res.headers,
      error: res.error as { error?: { code?: string; request_id?: string } } | undefined,
    });

    switch (classified.kind) {
      case "created":
      case "replayed":
        onCreated();
        return;
      case "validation":
        setNameError({ messageKey: classified.messageKey });
        return;
      case "regenerate-key":
        await submitWithKey(body, newIdempotencyKey());
        return;
      case "unauthenticated":
        setBanner({ variant: "warning", messageKey: classified.messageKey });
        return;
      default:
        // forbidden / key-conflict / conflict / error: each carries its own copy.
        setBanner({
          variant: "danger",
          messageKey: classified.messageKey,
          requestId: classified.requestId,
        });
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setNameError(undefined);
    setBanner(undefined);

    const form = new FormData(e.currentTarget);
    const draft: PayerCreateDraft = {
      category: String(form.get("category") ?? "credit_customer") as PayerCategory,
      displayName: String(form.get("displayName") ?? ""),
      externalRef: (String(form.get("externalRef") ?? "").trim() || null) as string | null,
    };

    const errors = validatePayerDraft(draft);
    if (errors.displayName || errors.category) {
      setNameError(errors.displayName ?? errors.category);
      return; // client guard: wrapper NOT called on an invalid draft
    }

    const body: PayerAccountCreateBody = {
      category: draft.category,
      displayName: draft.displayName.trim(),
      externalRef: draft.externalRef,
    };
    setPending(true);
    try {
      await submitWithKey(body, newIdempotencyKey());
    } finally {
      setPending(false);
    }
  }

  return (
    <Drawer title={t("payers.create.title")} onClose={onClose}>
      {banner ? (
        <Banner
          variant={banner.variant}
          message={t(banner.messageKey)}
          requestId={banner.requestId}
        />
      ) : null}

      <form className="surface__form" onSubmit={onSubmit} noValidate>
        <p className="surface__scope-line">
          {t.rich("payers.create.scopeLine", {
            tenant: (
              <strong>
                <bdi>{activeTenant.name}</bdi>
              </strong>
            ),
          })}
        </p>

        <div className="field">
          <label htmlFor="payer-category">{t("payers.create.category")}</label>
          <select
            id="payer-category"
            name="category"
            className="input"
            defaultValue="credit_customer"
          >
            <option value="credit_customer">{t(payerCategoryKey("credit_customer"))}</option>
            <option value="corporate">{t(payerCategoryKey("corporate"))}</option>
            <option value="insurer">{t(payerCategoryKey("insurer"))}</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="payer-name">{t("payers.create.displayName")}</label>
          <input
            id="payer-name"
            name="displayName"
            className="input"
            aria-invalid={nameError ? "true" : undefined}
            aria-describedby={nameError ? "payer-name-error" : undefined}
            autoComplete="off"
          />
          <span id="payer-name-error">
            <InlineError
              message={nameError ? t(nameError.messageKey, nameError.params) : undefined}
            />
          </span>
        </div>

        <div className="field">
          <label htmlFor="payer-external-ref">{t("payers.create.externalRef")}</label>
          <input
            id="payer-external-ref"
            name="externalRef"
            className="input"
            placeholder={t("payers.create.externalRefPlaceholder")}
            autoComplete="off"
          />
        </div>

        <div className="surface__actions">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {t("payers.create.submit")}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
