/**
 * RT-781 (RT-777 S2): the support-session bar, under the top bar of the
 * `/platform` shell and of the tenant shell. It is the ONLY place that shows the
 * purpose, ticket reference, remaining time, renew and end (design frames 21-24
 * and 46). It offers no break-glass and no write control on tenant data: the two
 * buttons act on the session itself, and the UI safeguard for the rest is that
 * nothing else is rendered here (RT-777 section 1.2 item 6, not a security control).
 *
 * States: active, expiring, cap reached, expired. When the cap is reached the
 * renew button stays rendered but `aria-disabled` with its reason (DS-R17). When
 * expired there is nothing to renew (the contract refuses it): only end remains.
 *
 * One polite live region announces state changes only, never the countdown.
 */
import { GatedButton } from "@/components/GatedButton";
import { type MessageKey, type T, formatDateTime, formatDuration, useT } from "@/i18n";
import { Link, useLocation } from "react-router";
import { remainingMinutes } from "./supportSessionLogic";
import { PLATFORM_HOME, type SupportSessionController } from "./useSupportSession";
import "./support-session.css";

const NOTICE_ID = "support-session-notice";

function Notice({
  state,
  title,
  body,
}: Readonly<{ state: string; title: string; body: React.ReactNode }>) {
  return (
    <div
      id={NOTICE_ID}
      className={`support-session-bar__notice support-session-bar__notice--${state}`}
    >
      <strong className="support-session-bar__notice-title">{title}</strong>
      <span className="support-session-bar__notice-body">{body}</span>
    </div>
  );
}

/**
 * RT-782 (comment 13591): where to open a new session. On the directory itself
 * the notice points at the list on the page; elsewhere it links there by the
 * page's real name. Opening a new session replaces this one (contract
 * `end_reason: replaced`), so ending it first is not required.
 */
function expiredBody(t: T, onDirectory: boolean): React.ReactNode {
  if (onDirectory) return t("platform.session.notice.expired.bodyHere");
  return t.rich("platform.session.notice.expired.body", {
    directory: <Link to={PLATFORM_HOME}>{t("platform.session.notice.expired.directory")}</Link>,
  });
}

function noticeFor(t: T, controller: SupportSessionController, onDirectory: boolean) {
  const { session, state, remainingMs } = controller;
  if (state === "expiring") {
    const under = remainingMs < 60_000;
    return {
      title: under
        ? t("platform.session.notice.expiringSoon.title")
        : t("platform.session.notice.expiring.title", {
            duration: formatDuration(remainingMinutes(remainingMs) * 60),
          }),
      body: t("platform.session.notice.expiring.body", {
        cap: formatDateTime(session.renewal_cap_at),
      }),
    };
  }
  if (state === "cap_reached") {
    return {
      title: t("platform.session.notice.cap.title"),
      body: t("platform.session.notice.cap.body"),
    };
  }
  if (state === "expired") {
    return {
      title: t("platform.session.notice.expired.title"),
      body: expiredBody(t, onDirectory),
    };
  }
  return null;
}

function timeTextFor(t: T, { state, remainingMs, session }: SupportSessionController): string {
  const until = formatDateTime(session.expires_at);
  if (state === "expired") return t("platform.session.expiredAt", { time: until });
  if (remainingMs < 60_000) return t("platform.session.remainingUnderMinute", { time: until });
  return t("platform.session.remaining", {
    duration: formatDuration(remainingMinutes(remainingMs) * 60),
    time: until,
  });
}

function liveTextFor(t: T, controller: SupportSessionController): string {
  const { state, renewedTo, session } = controller;
  if (state === "active" && renewedTo) {
    return t("platform.session.live.renewed", { time: formatDateTime(session.expires_at) });
  }
  return t(`platform.session.live.${state}` as MessageKey);
}

/** Renew: absent once expired, `aria-disabled` with its reason at the cap, else a gated action. */
function RenewButton({ controller }: Readonly<{ controller: SupportSessionController }>) {
  const t = useT();
  if (controller.state === "expired") return null;
  if (controller.state === "cap_reached") {
    return (
      <button
        type="button"
        className="btn-secondary"
        aria-disabled="true"
        aria-describedby={NOTICE_ID}
      >
        {t("platform.session.renew")}
      </button>
    );
  }
  return (
    <GatedButton
      className="btn-primary"
      aria-busy={controller.pending === "renew" || undefined}
      disabled={controller.pending !== null}
      onClick={() => void controller.renew()}
    >
      {t("platform.session.renew")}
    </GatedButton>
  );
}

function Identity({ controller }: Readonly<{ controller: SupportSessionController }>) {
  const t = useT();
  const { session, tenantName, state } = controller;
  // RT-782 (comment 13591): an expired session is not one the operator works in.
  const tenantKey =
    state === "expired" ? "platform.session.tenantExpired" : "platform.session.tenant";
  return (
    <>
      <span className="support-session-bar__badge">{t("platform.session.badge")}</span>
      {tenantName ? <span>{t(tenantKey, { name: tenantName })}</span> : null}
      <span>
        {t("platform.session.purpose", {
          purpose: t(`platform.session.purpose.${session.purpose}` as MessageKey),
        })}
      </span>
      {session.ticket_ref ? (
        <span>
          {t("platform.session.ticket")}:{" "}
          <bdi dir="ltr" className="support-session-bar__mono">
            {session.ticket_ref}
          </bdi>
        </span>
      ) : null}
      <span className="support-session-bar__badge support-session-bar__badge--quiet">
        {t("platform.session.readOnly")}
      </span>
    </>
  );
}

function ErrorLine({ error }: Readonly<{ error: NonNullable<SupportSessionController["error"]> }>) {
  const t = useT();
  return (
    <p className="support-session-bar__error" role="alert">
      {t(error.messageKey)}
      {error.requestId ? (
        <>
          {" "}
          <bdi dir="ltr" className="support-session-bar__mono">
            {error.requestId}
          </bdi>
        </>
      ) : null}
    </p>
  );
}

export function SupportSessionBar({
  controller,
}: Readonly<{ controller: SupportSessionController }>): React.JSX.Element {
  const t = useT();
  const onDirectory = useLocation().pathname === PLATFORM_HOME;
  const notice = noticeFor(t, controller, onDirectory);

  return (
    <section
      className={`support-session-bar support-session-bar--${controller.state}`}
      aria-label={t("platform.session.region")}
      data-state={controller.state}
    >
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {liveTextFor(t, controller)}
      </output>
      <div className="support-session-bar__main">
        <Identity controller={controller} />
        <span className="support-session-bar__time">{timeTextFor(t, controller)}</span>
        <span className="support-session-bar__actions">
          <RenewButton controller={controller} />
          <GatedButton
            className="btn-ghost"
            aria-busy={controller.pending === "end" || undefined}
            disabled={controller.pending !== null}
            onClick={() => void controller.end()}
          >
            {t("platform.session.end")}
          </GatedButton>
        </span>
      </div>
      {notice ? <Notice state={controller.state} title={notice.title} body={notice.body} /> : null}
      {controller.error ? <ErrorLine error={controller.error} /> : null}
    </section>
  );
}
