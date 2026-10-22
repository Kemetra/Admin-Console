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
import { type MessageKey, formatDateTime, formatDuration, useT } from "@/i18n";
import { remainingMinutes } from "./supportSessionLogic";
import type { SupportSessionController } from "./useSupportSession";
import "./support-session.css";

const NOTICE_ID = "support-session-notice";

function Notice({
  controller,
  title,
  body,
}: Readonly<{ controller: SupportSessionController; title: string; body: string }>) {
  return (
    <div
      id={NOTICE_ID}
      className={`support-session-bar__notice support-session-bar__notice--${controller.state}`}
    >
      <strong className="support-session-bar__notice-title">{title}</strong>
      <span className="support-session-bar__notice-body">{body}</span>
    </div>
  );
}

function useNotice(controller: SupportSessionController) {
  const t = useT();
  const { session, state, remainingMs } = controller;
  if (state === "expiring") {
    const minutes = remainingMinutes(remainingMs);
    const under = minutes <= 1 && remainingMs < 60_000;
    return {
      title: under
        ? t("platform.session.notice.expiringSoon.title")
        : t("platform.session.notice.expiring.title", {
            duration: formatDuration(minutes * 60),
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
      body: t("platform.session.notice.expired.body"),
    };
  }
  return null;
}

export function SupportSessionBar({
  controller,
}: Readonly<{ controller: SupportSessionController }>): React.JSX.Element {
  const t = useT();
  const { session, state, remainingMs, pending, error } = controller;
  const notice = useNotice(controller);
  const until = formatDateTime(session.expires_at);
  const minutes = remainingMinutes(remainingMs);

  let timeText: string;
  if (state === "expired") {
    timeText = t("platform.session.expiredAt", { time: until });
  } else if (remainingMs < 60_000) {
    timeText = t("platform.session.remainingUnderMinute", { time: until });
  } else {
    timeText = t("platform.session.remaining", {
      duration: formatDuration(minutes * 60),
      time: until,
    });
  }

  const live =
    state === "active" && controller.renewedTo
      ? t("platform.session.live.renewed", { time: until })
      : t(`platform.session.live.${state}` as MessageKey);

  const busy = pending !== null;
  const capReached = state === "cap_reached";

  return (
    <section
      className={`support-session-bar support-session-bar--${state}`}
      aria-label={t("platform.session.region")}
      data-state={state}
    >
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {live}
      </output>
      <div className="support-session-bar__main">
        <span className="support-session-bar__badge">{t("platform.session.badge")}</span>
        {controller.tenantName ? (
          <span>{t("platform.session.tenant", { name: controller.tenantName })}</span>
        ) : null}
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
        <span className="support-session-bar__time">{timeText}</span>
        <span className="support-session-bar__actions">
          {state === "expired" ? null : capReached ? (
            <button
              type="button"
              className="btn-secondary"
              aria-disabled="true"
              aria-describedby={NOTICE_ID}
            >
              {t("platform.session.renew")}
            </button>
          ) : (
            <GatedButton
              className="btn-primary"
              aria-busy={pending === "renew" || undefined}
              disabled={busy}
              onClick={() => void controller.renew()}
            >
              {t("platform.session.renew")}
            </GatedButton>
          )}
          <GatedButton
            className="btn-ghost"
            aria-busy={pending === "end" || undefined}
            disabled={busy}
            onClick={() => void controller.end()}
          >
            {t("platform.session.end")}
          </GatedButton>
        </span>
      </div>
      {notice ? <Notice controller={controller} title={notice.title} body={notice.body} /> : null}
      {error ? (
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
      ) : null}
    </section>
  );
}
