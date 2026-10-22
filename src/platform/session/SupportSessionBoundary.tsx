import { useT } from "@/i18n";
/**
 * RT-781 (RT-777 S2): the page body of a shell that can host a support session.
 * Once the session has expired the body is replaced by one calm state, so a
 * surface never shows its generic 403 error for what is a known, expected end.
 *
 *  - A tenant call refused with 403 `support_session_expired` always swaps the
 *    body: that page is tenant-scoped and its data is gone.
 *  - `swapOnExpiredStatus` also swaps it when the context itself says expired.
 *    The tenant shell passes it (every surface there reads tenant data); the
 *    `/platform` shell does not, because the directory is platform-scoped and
 *    keeps working under an expired session.
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

export function SupportSessionBoundary({
  controller,
  swapOnExpiredStatus = false,
  children,
}: Readonly<{
  controller: SupportSessionController | null;
  swapOnExpiredStatus?: boolean;
  children?: React.ReactNode;
}>): React.JSX.Element {
  const expired =
    controller !== null &&
    (controller.refusedExpired || (swapOnExpiredStatus && controller.state === "expired"));
  return <>{expired ? <SupportSessionExpiredBody /> : children}</>;
}
