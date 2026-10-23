/**
 * RT-782 (RT-777 S3, screen 20): the drawer that opens a support session for
 * one tenant. It asks for the contract's `purpose` (closed enum) and the
 * optional `ticket_ref` only. The free-text «سبب الوصول» field of the frame is
 * dropped (DEC-1): `OpenSupportSessionRequest` is `additionalProperties: false`.
 *
 * The scope text says only what is true at this pin: the session is read-only
 * in the Console, lasts 60 minutes, renews explicitly up to 8 hours, and a
 * suspended tenant is read-only at the API too. It makes no claim about hidden
 * amounts (D4 is not backed server-side yet, RT-777 OQ-4) and offers no
 * break-glass (P0-b has no contract).
 *
 * Its other two views replace the form: 404 (the one non-disclosing «not
 * available» state, screen 25) and 409 `already_member` (the normal switch).
 */
import { Banner } from "@/components/Banner";
import { Drawer } from "@/components/Drawer";
import { GatedButton } from "@/components/GatedButton";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import { textField } from "@/lib/form-field";
import { SUPPORT_PURPOSES } from "./startSessionLogic";
import { type StartView, useStartSession } from "./useStartSession";
import "@/shell/surface.css";

export interface StartTenant {
  id: string;
  name: string;
  slug?: string;
}

export interface StartSessionDrawerProps {
  tenant: StartTenant;
  /** A support session exists now; opening this one replaces it (`end_reason: replaced`). */
  replacesSession: boolean;
  onClose: () => void;
  /** 404: back to the directory, which reads the list again. */
  onNotAvailable: () => void;
  /** 409 `already_member`: the normal tenant switch. */
  onSwitch: (tenantId: string) => void;
}

function NotAvailable({
  view,
  onBack,
}: Readonly<{ view: Extract<StartView, { kind: "not-found" }>; onBack: () => void }>) {
  const t = useT();
  return (
    <div className="start-session__state">
      <Banner
        variant="info"
        title={t("platform.start.notFound.title")}
        message={t("platform.start.notFound.body")}
        requestId={view.requestId}
      />
      <button type="button" className="btn-secondary" onClick={onBack}>
        {t("platform.start.notFound.back")}
      </button>
    </div>
  );
}

function Member({ onSwitch }: Readonly<{ onSwitch: () => void }>) {
  const t = useT();
  return (
    <div className="start-session__state">
      <Banner
        variant="info"
        title={t("platform.start.member.title")}
        message={t("platform.start.member.body")}
      />
      <GatedButton className="btn-primary" onClick={onSwitch}>
        {t("platform.start.member.switch")}
      </GatedButton>
    </div>
  );
}

function ScopeFacts({ replacesSession }: Readonly<{ replacesSession: boolean }>) {
  const t = useT();
  const rows: [MessageKey, MessageKey][] = [
    ["platform.start.scope.label", "platform.start.scope.body"],
    ["platform.start.duration.label", "platform.start.duration.body"],
    ["platform.start.suspended.label", "platform.start.suspended.body"],
  ];
  return (
    <>
      <dl className="start-session__facts">
        {rows.map(([label, body]) => (
          <div key={label} className="field-row">
            <dt className="field-row__label">{t(label)}</dt>
            <dd className="field-row__value">{t(body)}</dd>
          </div>
        ))}
      </dl>
      {replacesSession ? <Banner variant="warning" message={t("platform.start.replaces")} /> : null}
    </>
  );
}

export function StartSessionDrawer({
  tenant,
  replacesSession,
  onClose,
  onNotAvailable,
  onSwitch,
}: Readonly<StartSessionDrawerProps>): React.JSX.Element {
  const t = useT();
  const start = useStartSession(tenant.id, onClose);
  const { errors, notice, pending, view } = start;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void start.submit({
      purpose: textField(form, "purpose"),
      ticketRef: textField(form, "ticketRef"),
    });
  };

  return (
    <Drawer
      title={t("platform.start.title", { name: tenant.name })}
      onClose={onClose}
      dismissible={!pending}
    >
      {tenant.slug ? (
        <p className="start-session__slug">
          <bdi dir="ltr">{tenant.slug}</bdi>
        </p>
      ) : null}
      {view.kind === "not-found" ? <NotAvailable view={view} onBack={onNotAvailable} /> : null}
      {view.kind === "member" ? <Member onSwitch={() => onSwitch(tenant.id)} /> : null}
      {view.kind === "form" ? (
        <form className="surface__form" onSubmit={onSubmit} noValidate>
          {notice ? (
            <Banner
              variant={notice.variant}
              message={t(notice.messageKey)}
              requestId={notice.requestId}
            />
          ) : null}

          <div className="field">
            <label htmlFor="start-purpose">
              {t("platform.start.purpose.label")}{" "}
              <span className="start-session__marker">{t("platform.start.required")}</span>
            </label>
            <select
              id="start-purpose"
              name="purpose"
              className="input"
              defaultValue=""
              aria-required="true"
              aria-invalid={errors.purpose ? "true" : undefined}
              aria-describedby={errors.purpose ? "start-purpose-error" : undefined}
            >
              <option value="" disabled>
                {t("platform.start.purpose.placeholder")}
              </option>
              {SUPPORT_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {t(`platform.session.purpose.${p}` as MessageKey)}
                </option>
              ))}
            </select>
            <span id="start-purpose-error">
              <InlineError message={errors.purpose ? t(errors.purpose) : undefined} />
            </span>
          </div>

          <div className="field">
            <label htmlFor="start-ticket">
              {t("platform.start.ticket.label")}{" "}
              <span className="start-session__marker">{t("platform.start.optional")}</span>
            </label>
            <input
              id="start-ticket"
              name="ticketRef"
              className="input input--mono"
              dir="ltr"
              maxLength={64}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={errors.ticketRef ? "true" : undefined}
              aria-describedby={
                errors.ticketRef ? "start-ticket-error start-ticket-hint" : "start-ticket-hint"
              }
            />
            <span id="start-ticket-hint" className="field__hint">
              {t("platform.start.ticket.hint")}
            </span>
            <span id="start-ticket-error">
              <InlineError message={errors.ticketRef ? t(errors.ticketRef) : undefined} />
            </span>
          </div>

          <ScopeFacts replacesSession={replacesSession} />

          <div className="surface__actions">
            <GatedButton
              type="submit"
              className="btn-primary"
              disabled={pending}
              aria-busy={pending || undefined}
            >
              {pending ? <span className="spinner" aria-hidden="true" /> : null}
              {t("platform.start.submit")}
            </GatedButton>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      ) : null}
    </Drawer>
  );
}
