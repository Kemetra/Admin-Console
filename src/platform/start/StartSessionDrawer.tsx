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
  /** Why the last switch did not land (refused, or no answer): said in the member view. */
  switchFailure?: MessageKey | null;
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

function Member({
  onSwitch,
  failure,
}: Readonly<{ onSwitch: () => void; failure: MessageKey | null }>) {
  const t = useT();
  return (
    <div className="start-session__state">
      <Banner
        variant="info"
        title={t("platform.start.member.title")}
        message={t("platform.start.member.body")}
      />
      {failure ? <Banner variant="danger" message={t(failure)} /> : null}
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

function PurposeField({ error }: Readonly<{ error?: MessageKey }>) {
  const t = useT();
  return (
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
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? "start-purpose-error" : undefined}
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
        <InlineError message={error ? t(error) : undefined} />
      </span>
    </div>
  );
}

function TicketField({ error }: Readonly<{ error?: MessageKey }>) {
  const t = useT();
  return (
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
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? "start-ticket-error start-ticket-hint" : "start-ticket-hint"}
      />
      <span id="start-ticket-hint" className="field__hint">
        {t("platform.start.ticket.hint")}
      </span>
      <span id="start-ticket-error">
        <InlineError message={error ? t(error) : undefined} />
      </span>
    </div>
  );
}

function StartForm({
  start,
  replacesSession,
  onCancel,
}: Readonly<{
  start: ReturnType<typeof useStartSession>;
  replacesSession: boolean;
  onCancel: () => void;
}>) {
  const t = useT();
  const { errors, notice, pending } = start;
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void start.submit({
      purpose: textField(form, "purpose"),
      ticketRef: textField(form, "ticketRef"),
    });
  };
  return (
    <form className="surface__form" onSubmit={onSubmit} noValidate>
      {notice ? (
        <Banner
          variant={notice.variant}
          message={t(notice.messageKey)}
          requestId={notice.requestId}
        />
      ) : null}
      <PurposeField error={errors.purpose} />
      <TicketField error={errors.ticketRef} />
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
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

function DrawerView({
  start,
  props,
}: Readonly<{ start: ReturnType<typeof useStartSession>; props: StartSessionDrawerProps }>) {
  const { view } = start;
  if (view.kind === "not-found") return <NotAvailable view={view} onBack={props.onNotAvailable} />;
  if (view.kind === "member") {
    return (
      <Member
        onSwitch={() => props.onSwitch(props.tenant.id)}
        failure={props.switchFailure ?? null}
      />
    );
  }
  return (
    <StartForm start={start} replacesSession={props.replacesSession} onCancel={props.onClose} />
  );
}

export function StartSessionDrawer(props: Readonly<StartSessionDrawerProps>): React.JSX.Element {
  const t = useT();
  const { tenant, onClose } = props;
  const start = useStartSession(tenant.id, onClose);

  return (
    <Drawer
      title={t("platform.start.title", { name: tenant.name })}
      onClose={onClose}
      dismissible={!start.pending}
    >
      {tenant.slug ? (
        <p className="start-session__slug">
          <bdi dir="ltr">{tenant.slug}</bdi>
        </p>
      ) : null}
      <DrawerView start={start} props={props} />
    </Drawer>
  );
}
