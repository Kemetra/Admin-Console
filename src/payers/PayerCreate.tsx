import { Banner } from "@/components/Banner";
import { Drawer } from "@/components/Drawer";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import { type PayerAccountCreateBody, consoleCreatePayerAccount } from "@/lib/client";
import { textField } from "@/lib/form-field";
/**
 * 017 SF2 — Create-payer drawer (owner / tenant_admin, gated by the list that
 * mounts it). Uncontrolled native form: category / displayName / scope (the
 * whole tenant, or one of the caller's stores) / ERPNext Customer link.
 * Client-validates via validatePayerDraft (fail-fast UX guard; server stays
 * authoritative), then calls consoleCreatePayerAccount with an Idempotency-Key
 * and routes the result through classifyPayerCreateOutcome:
 *
 *   201 / replayed   → onCreated (close + refetch list)
 *   400 / 422        → form-level banner with the request id (never the server's
 *                      words; field errors are the client-side checks only)
 *   400 key issue    → fresh key + resubmit ONCE (not user-facing)
 *   401              → session banner (interceptor owns the redirect)
 *   403              → permission banner
 *   404              → non-disclosing "store unavailable" (out-of-scope storeId)
 *   409 key-conflict → fresh key next time + "please retry" banner
 *   409 (other)      → non-disclosing conflict banner (no cross-tenant leak)
 *   5xx / network    → generic banner; a retry of the SAME payer reuses its key
 *
 * The Idempotency-Key belongs to the payer being created, not to the click: a
 * retry of the same body after a dropped response or a 5xx replays the first
 * attempt instead of creating a second payer. A different body, or a key
 * conflict, mints a new key.
 *
 * No credit terms (ERPNext owns them, RT-417) and no status/version: v1 is
 * create-only (OQ-CON-EDIT deferred). `externalRef` is the payer's ERPNext
 * Customer link, optional (blank → null).
 *
 * RT-399: state keeps message KEYS (from the classifier / validator), never
 * translated strings; copy is resolved with `t()` at render.
 */
import { useRef, useState } from "react";
import {
  type PayerCategory,
  type PayerCreateDraft,
  type PayerFieldError,
  validatePayerDraft,
} from "./payerCreateForm";
import {
  type KeyedAttempt,
  type PayerCreateOutcome,
  classifyPayerCreateOutcome,
  newIdempotencyKey,
  reuseOrNewKey,
} from "./payerIdempotency";
import { payerCategoryKey } from "./payerListLogic";

export interface PayerCreateProps {
  activeTenant: { id: string; name: string };
  /** The stores the caller may scope a payer to; empty offers only the whole tenant. */
  stores: readonly { id: string; name?: string }[];
  onClose: () => void;
  onCreated: () => void;
}

type BannerState = { variant: "danger" | "warning"; messageKey: MessageKey; requestId?: string };

const NETWORK_FAILURE: BannerState = {
  variant: "danger",
  messageKey: "payers.create.errors.generic",
};

export function PayerCreate({
  activeTenant,
  stores,
  onClose,
  onCreated,
}: Readonly<PayerCreateProps>): React.JSX.Element {
  const t = useT();
  const [nameError, setNameError] = useState<PayerFieldError | undefined>();
  const [banner, setBanner] = useState<BannerState | undefined>();
  const [pending, setPending] = useState(false);
  const attempt = useRef<KeyedAttempt | undefined>(undefined);

  async function submit(body: PayerAccountCreateBody, retriedKey = false): Promise<void> {
    attempt.current = reuseOrNewKey(attempt.current, JSON.stringify(body));
    const res = await consoleCreatePayerAccount(body, attempt.current.key);
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
        // A server refusal is form-level: it may concern any field (or none the
        // operator can see), so it is never pinned on the name. Field errors are
        // the client-side checks only.
        setBanner({
          variant: "danger",
          messageKey: classified.messageKey,
          requestId: classified.requestId,
        });
        return;
      case "regenerate-key":
        // A malformed/missing key is ours to fix, once; a second refusal is an error.
        if (retriedKey) {
          setBanner({ variant: "danger", messageKey: "payers.create.errors.generic" });
          return;
        }
        attempt.current = { fingerprint: JSON.stringify(body), key: newIdempotencyKey() };
        await submit(body, true);
        return;
      case "unauthenticated":
        setBanner({ variant: "warning", messageKey: classified.messageKey });
        return;
      case "key-conflict":
        attempt.current = undefined; // terminal for that key: the next attempt mints a new one
        setBanner({
          variant: "danger",
          messageKey: classified.messageKey,
          requestId: classified.requestId,
        });
        return;
      default:
        // forbidden / not-found / conflict / error: each carries its own copy.
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
      category: textField(form, "category", "credit_customer") as PayerCategory,
      displayName: textField(form, "displayName"),
      externalRef: textField(form, "externalRef").trim() || null,
      storeId: textField(form, "storeId") || null,
    };

    const errors = validatePayerDraft(draft);
    if (errors.displayName || errors.category) {
      setNameError(errors.displayName ?? errors.category);
      return; // client guard: wrapper NOT called on an invalid draft
    }

    const body: PayerAccountCreateBody = {
      category: draft.category,
      displayName: draft.displayName.trim(),
      externalRef: draft.externalRef ?? null,
      storeId: draft.storeId ?? null,
    };
    setPending(true);
    try {
      await submit(body);
    } catch {
      // The request itself failed (network): nothing to disclose, nothing sent twice
      // (a retry of this body reuses its key).
      setBanner(NETWORK_FAILURE);
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
          <label htmlFor="payer-scope">{t("payers.create.scope")}</label>
          <select id="payer-scope" name="storeId" className="input" defaultValue="">
            <option value="">{t("payers.create.scopeTenant")}</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name ?? store.id}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="payer-external-ref">{t("payers.create.externalRef")}</label>
          <input
            id="payer-external-ref"
            name="externalRef"
            className="input"
            placeholder={t("payers.create.externalRefPlaceholder")}
            aria-describedby="payer-external-ref-hint"
            autoComplete="off"
          />
          <span id="payer-external-ref-hint" className="field__hint">
            {t("payers.create.externalRefHint")}
          </span>
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
