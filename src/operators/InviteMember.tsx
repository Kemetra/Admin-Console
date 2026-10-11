import { Banner } from "@/components/Banner";
import { Drawer } from "@/components/Drawer";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import { type InvitationCreateBody, createInvitation, refreshSession } from "@/lib/client";
import { useSignOut } from "@/shell/useSignOut";
/**
 * SF5-2 — Invite member drawer (T020/T021). Uncontrolled native form (email /
 * role / store-access). One `.btn-primary` "Send invitation". Calls
 * `createInvitation` through the idempotency + 401-disambiguation machinery:
 *
 *   - key generated once per submit; a retry (425) replays the SAME key
 *   - 201 / replay      → close, refresh the list
 *   - 400 validation    → inline on the field
 *   - 400 key issue      → regenerate key + resubmit (not user-facing)
 *   - 403               → permission banner
 *   - 409 pending        → "already pending" warning banner
 *   - 409 key-conflict   → regenerate key + "please retry" banner (terminal for this key)
 *   - 425               → disabled submit + countdown, auto-retry with same key (≤ a bound)
 *   - precondition-401   → route to the scope chooser (handled by useInviteAuth)
 *   - session-expiry-401 → sign out (handled by useInviteAuth)
 */
import { useState } from "react";
import { classifyInviteOutcome, newIdempotencyKey } from "./inviteIdempotency";
import { runInviteWithAuth } from "./useInviteAuth";

export interface InviteMemberProps {
  activeTenant: { id: string; name: string };
  onClose: () => void;
  onInvited: () => void;
}

/** Banner copy is kept as a message key and translated at render (RT-399). */
type BannerState = { variant: "danger" | "warning"; messageKey: MessageKey; requestId?: string };

const MAX_TOO_EARLY_RETRIES = 3;

export function InviteMember({
  activeTenant,
  onClose,
  onInvited,
}: InviteMemberProps): React.JSX.Element {
  const t = useT();
  const signOut = useSignOut();
  const [emailError, setEmailError] = useState<MessageKey | undefined>();
  const [banner, setBanner] = useState<BannerState | undefined>();
  const [pending, setPending] = useState(false);
  const [tooEarly, setTooEarly] = useState<number | null>(null);
  const [specific, setSpecific] = useState(false);

  async function submitWithKey(
    body: InvitationCreateBody,
    key: string,
    tooEarlyRetries: number,
  ): Promise<void> {
    const outcome = await runInviteWithAuth(
      () => createInvitation(body, key),
      async () => {
        const r = await refreshSession();
        return { ok: r.status >= 200 && r.status < 300 };
      },
    );

    if (outcome.kind === "session-expired") {
      void signOut();
      return;
    }
    if (outcome.kind === "precondition") {
      // No active tenant: route to the RF-1 scope chooser (clear the store-less
      // scope so ProtectedArea renders the gate). Never a sign-out.
      setBanner({ variant: "warning", messageKey: "operators.invite.errors.selectTenant" });
      return;
    }

    const result = outcome.result;
    const classified = classifyInviteOutcome({
      status: result.status,
      headers: result.headers,
      error: result.error as { error?: { code?: string; request_id?: string } } | undefined,
    });

    switch (classified.kind) {
      case "created":
      case "replayed":
        onInvited();
        return;
      case "validation":
        setEmailError("operators.invite.errors.validation");
        return;
      case "regenerate-key":
        // Client-internal key fault: regenerate and resubmit once, silently.
        await submitWithKey(body, newIdempotencyKey(), tooEarlyRetries);
        return;
      case "forbidden":
        setBanner({
          variant: "danger",
          messageKey: "operators.invite.errors.forbidden",
          requestId: classified.requestId,
        });
        return;
      case "pending-exists":
        setBanner({
          variant: "warning",
          messageKey: "operators.invite.errors.pendingExists",
          requestId: classified.requestId,
        });
        return;
      case "key-conflict":
        setBanner({
          variant: "danger",
          messageKey: "operators.invite.errors.keyConflict",
          requestId: classified.requestId,
        });
        return;
      case "too-early": {
        if (tooEarlyRetries >= MAX_TOO_EARLY_RETRIES) {
          setBanner({
            variant: "danger",
            messageKey: "operators.invite.errors.tooLong",
          });
          return;
        }
        // Retry with the SAME key after Retry-After (bounded; visible countdown).
        setTooEarly(classified.retryAfterSeconds);
        await new Promise((r) => setTimeout(r, classified.retryAfterSeconds * 1000));
        setTooEarly(null);
        await submitWithKey(body, key, tooEarlyRetries + 1);
        return;
      }
      default:
        setBanner({
          variant: "danger",
          messageKey: "operators.invite.errors.generic",
          requestId: classified.requestId,
        });
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setEmailError(undefined);
    setBanner(undefined);
    const form = new FormData(e.currentTarget);
    const body: InvitationCreateBody = {
      email: String(form.get("email") ?? ""),
      role_code: String(form.get("role_code") ?? ""),
      store_access_kind: specific ? "specific" : "all",
      store_ids: specific
        ? String(form.get("store_ids") ?? "")
            .split(/[\s,]+/)
            .filter(Boolean)
        : undefined,
    };
    setPending(true);
    try {
      await submitWithKey(body, newIdempotencyKey(), 0);
    } finally {
      setPending(false);
    }
  }

  return (
    <Drawer title={t("operators.invite.title")} onClose={onClose}>
      {banner ? (
        <Banner
          variant={banner.variant}
          message={t(banner.messageKey)}
          requestId={banner.requestId}
        />
      ) : null}

      <form className="surface__form" onSubmit={onSubmit} noValidate>
        <p className="surface__scope-line">
          {t.rich("operators.invite.scopeLine", {
            tenant: (
              <strong>
                <bdi>{activeTenant.name}</bdi>
              </strong>
            ),
          })}
        </p>

        <div className="field">
          <label htmlFor="invite-email">{t("operators.form.email")}</label>
          <input
            id="invite-email"
            name="email"
            type="email"
            className="input"
            aria-invalid={emailError ? "true" : undefined}
            aria-describedby={emailError ? "invite-email-error" : undefined}
            autoComplete="off"
          />
          <span id="invite-email-error">
            <InlineError message={emailError ? t(emailError) : undefined} />
          </span>
        </div>

        <div className="field">
          <label htmlFor="invite-role">{t("operators.form.role")}</label>
          <input id="invite-role" name="role_code" className="input" autoComplete="off" />
        </div>

        <div className="field">
          <span className="field-row__label">{t("operators.form.storeAccess")}</span>
          <div className="drawer__radio-group">
            <label className="drawer__radio">
              <input
                type="radio"
                name="store_access"
                checked={!specific}
                onChange={() => setSpecific(false)}
              />
              {t("operators.storeAccess.all")}
            </label>
            <label className="drawer__radio">
              <input
                type="radio"
                name="store_access"
                checked={specific}
                onChange={() => setSpecific(true)}
              />
              {t("operators.storeAccess.specific")}
            </label>
          </div>
          {specific ? (
            <input
              name="store_ids"
              className="input"
              placeholder={t("operators.form.storeIdsPlaceholder")}
              autoComplete="off"
            />
          ) : null}
        </div>

        <div className="surface__actions">
          <button type="submit" className="btn-primary" disabled={pending || tooEarly !== null}>
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {tooEarly !== null
              ? t("operators.invite.retrying", { count: tooEarly })
              : t("operators.invite.submit")}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
