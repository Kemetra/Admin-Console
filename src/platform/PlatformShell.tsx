/**
 * Tenant-less shell for `/platform` (RT-780, RT-777 §2). Top bar with a
 * platform identity label, a live-destinations-only sidebar (shell rule 7), and
 * the support-session bar (RT-781, RT-777 S2), which renders only while the
 * context carries a support session. It has no tenant scope bar: nothing here
 * switches the active tenant.
 */
import { RateLimitBanner } from "@/components/RateLimitBanner";
import { TowerMark } from "@/components/TowerMark";
import { Icon } from "@/components/icons/Icon";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { useT } from "@/i18n";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import { ThemeToggle } from "@/theme/ThemeToggle";
import { NavLink } from "react-router";
import { SupportSessionBarSlot, SupportSessionBoundary } from "./session/SupportSessionBoundary";
import { useSupportSession } from "./session/useSupportSession";
import "@/shell/app-shell.css";
import "./platform.css";

export interface PlatformShellProps {
  onSignOut: () => void | Promise<void>;
  children?: React.ReactNode;
}

export function PlatformShell({
  onSignOut,
  children,
}: Readonly<PlatformShellProps>): React.JSX.Element {
  const t = useT();
  const { context } = useActiveContextValue();
  const supportSession = useSupportSession();
  const user = context?.user;
  const initials = (user?.display_name ?? user?.email ?? "?")
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="platform-shell">
      <header className="topbar">
        <span className="tower-lockup">
          <TowerMark className="tower-mark" />
          <span className="tower-lockup__word">Retail Tower OS</span>
          <span className="tower-lockup__tag">{t("platform.label")}</span>
        </span>
        <div className="topbar__spacer" />
        <LocaleSwitch userId={user?.id} />
        <ThemeToggle userId={user?.id} />
        {user ? (
          <span className="topbar__user">
            <span className="topbar__avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="topbar__name">{user.display_name ?? user.email}</span>
          </span>
        ) : null}
      </header>

      <div className="platform-session-slot" data-slot="support-session-bar">
        <SupportSessionBarSlot controller={supportSession} />
      </div>

      <nav className="sidebar" aria-label={t("platform.nav.label")}>
        <NavLink
          to="/platform/tenants"
          className={({ isActive }) =>
            isActive ? "nav-entry nav-entry--active" : "nav-entry nav-entry--link"
          }
        >
          <Icon name="tenant" className="nav-entry__icon" />
          <span className="nav-entry__label">{t("platform.nav.tenants")}</span>
        </NavLink>
        <div className="topbar__spacer" />
        <button type="button" className="nav-entry nav-signout" onClick={() => void onSignOut()}>
          <Icon name="signOut" className="nav-entry__icon" />
          <span className="nav-entry__label">{t("shell.signOut")}</span>
        </button>
      </nav>

      <main className="content">
        <RateLimitBanner />
        <SupportSessionBoundary controller={supportSession}>{children}</SupportSessionBoundary>
      </main>
    </div>
  );
}
