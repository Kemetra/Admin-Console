import { useT } from "@/i18n";
/**
 * RT-781 (RT-777 S2): the page body of a shell that can host a support session.
 * Once the session has expired the body is replaced by one calm state, so a
 * surface never shows its generic 403 error for what is a known, expected end.
 *
 *  - A tenant call refused with 403 `support_session_expired` always swaps the
 *    body: that page is tenant-scoped and its data is gone.
 *  - `tenantShell` (the tenant shell) never renders a tenant surface inside a
 *    support session: an active or expiring session shows a calm read-only
 *    state, an expired one the expired state. This makes "no write control in a
 *    session" true by construction (RT-777 section 1.2 item 6: a UI safeguard,
 *    not a security control, since the API still admits tenant writes until
 *    P0-b). S3/S4 replace the read-only placeholder with real session-aware,
 *    redacted read views before any tenant data is shown.
 *  - The `/platform` shell keeps its platform-scoped directory under an expired
 *    status, and swaps only on a refused tenant call.
 *
 * With no session (a member-entered tenant, a plain user) it renders its
 * children untouched.
 */
import { Link } from "react-router";
import { SupportSessionBar } from "./SupportSessionBar";
import type { SupportSessionController } from "./useSupportSession";
import { PLATFORM_HOME } from "./useSupportSession";
import "./support-session.css";

export function SupportSessionBarSlot({
  controller,
}: Readonly<{ controller: SupportSessionController | null }>): React.JSX.Element | null {
  return controller ? <SupportSessionBar controller={controller} /> : null;
}

export function SupportSessionExpiredBody(): React.JSX.Element {
  const t = useT();
  return (
    <div className="support-session-expired">
      <h1 className="content__title">{t("platform.session.expiredBody.title")}</h1>
      <p className="content__sub">{t("platform.session.expiredBody.body")}</p>
      <Link className="btn-secondary" to={PLATFORM_HOME}>
        {t("platform.session.expiredBody.action")}
      </Link>
    </div>
  );
}

export function SupportSessionReadOnlyBody(): React.JSX.Element {
  const t = useT();
  return (
    <div className="support-session-expired">
      <h1 className="content__title">{t("platform.session.readOnlyBody.title")}</h1>
      <p className="content__sub">{t("platform.session.readOnlyBody.body")}</p>
      <Link className="btn-secondary" to={PLATFORM_HOME}>
        {t("platform.session.readOnlyBody.action")}
      </Link>
    </div>
  );
}

export function SupportSessionBoundary({
  controller,
  tenantShell = false,
  children,
}: Readonly<{
  controller: SupportSessionController | null;
  tenantShell?: boolean;
  children?: React.ReactNode;
}>): React.JSX.Element {
  if (controller === null) return <>{children}</>;
  const expired = controller.refusedExpired || controller.state === "expired";
  if (tenantShell) {
    return expired ? <SupportSessionExpiredBody /> : <SupportSessionReadOnlyBody />;
  }
  return <>{controller.refusedExpired ? <SupportSessionExpiredBody /> : children}</>;
}
