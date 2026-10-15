import { Icon, type IconName } from "@/components/Icon";
import { TowerMark } from "@/components/TowerMark";
/**
 * SF-2 authenticated app shell (T027; RF-2 T009/T010). top-bar + persistent
 * scope header + sidebar + content (DESIGN.md layout). The frame every RF-2..RF-7
 * family attaches to. The content area renders `children` — the routed surface
 * (an <Outlet/> from the layout route). Sidebar entries beyond what is built are
 * shown gated to mark scope, not to claim they are built — in dev builds only.
 * RT-270 (UX-09: no dead destinations): a production build never lists them.
 *
 * Console v4.0 visual adoption: each nav entry leads with a decorative line icon
 * (aria-hidden, so labels stay the sole accessible name) and the topbar carries
 * the Console product label, the language switch (RT-399) and the dark-mode
 * switch (RT-398) before the user.
 * Operational chrome with no backing yet (search, notifications, system
 * status) is intentionally NOT rendered — a
 * dead control reads as a fake to an operator (PRODUCT.md P4/P5); each arrives as
 * its own slice when wired. Gated nav entries are the one exception, and they
 * announce it explicitly with a gate badge (RF-3 / RF-4).
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { type MessageKey, roleKey, useT } from "@/i18n";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import { canReadStockDiscrepancies } from "@/stock-discrepancies/stockDiscrepancyLogic";
import { ThemeToggle } from "@/theme/ThemeToggle";
import { NavLink } from "react-router";
import { ScopeHeader } from "./ScopeHeader";
import "./app-shell.css";

/** Live nav: RF-2 (Tenants/Stores), RF-5 (Operators), RF-6 (Audit). */
const LIVE_NAV: { label: MessageKey; to: string; icon: IconName }[] = [
  { label: "shell.nav.tenants", to: "/tenants", icon: "tenants" },
  { label: "shell.nav.stores", to: "/stores", icon: "stores" },
  { label: "shell.nav.operators", to: "/operators", icon: "operators" },
  { label: "shell.nav.audit", to: "/audit", icon: "audit" },
];

/**
 * Families not yet built — shown gated to mark scope, not to claim built. Dev
 * builds only (RT-270): in production they would be dead destinations.
 */
const GATED_NAV: { label: MessageKey; gate: string; icon: IconName }[] = [
  { label: "shell.nav.catalog", gate: "RF-3", icon: "catalog" },
  { label: "shell.nav.unknownItems", gate: "RF-4", icon: "unknown" },
];

export interface AppShellProps {
  onSignOut: () => void | Promise<void>;
  children?: React.ReactNode;
  /** Show the gated placeholders. Defaults to Vite's `DEV`: false in a production build. */
  showGatedNav?: boolean;
}

export function AppShell({
  onSignOut,
  children,
  showGatedNav = import.meta.env.DEV,
}: Readonly<AppShellProps>): React.JSX.Element {
  const t = useT();
  const { context } = useActiveContextValue();
  const user = context?.user;
  const roleCode = context?.active_role_code;
  const initials = (user?.display_name ?? user?.email ?? "?")
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="shell">
      <header className="topbar">
        <span className="tower-lockup">
          <TowerMark className="tower-mark" />
          <span className="tower-lockup__word">Retail Tower OS</span>
          <span className="tower-lockup__tag">{t("app.productTag")}</span>
        </span>

        <div className="topbar__spacer" />
        <LocaleSwitch userId={user?.id} />
        <ThemeToggle userId={user?.id} />
        {user ? (
          <span className="topbar__user">
            <span className="topbar__avatar-wrap">
              <span className="topbar__avatar" aria-hidden="true">
                {initials}
              </span>
              <span className="topbar__online" aria-hidden="true" />
            </span>
            <span className="topbar__name">
              {user.display_name ?? user.email}
              <small>{roleCode ? t(roleKey(roleCode)) : ""}</small>
            </span>
          </span>
        ) : null}
      </header>

      <ScopeHeader />

      <nav className="sidebar" aria-label={t("shell.nav.label")}>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? "nav-entry nav-entry--active" : "nav-entry nav-entry--link"
          }
        >
          <Icon name="overview" className="nav-entry__icon" />
          <span className="nav-entry__label">{t("shell.nav.overview")}</span>
        </NavLink>
        <div className="nav-section">{t("shell.nav.section.management")}</div>
        {LIVE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? "nav-entry nav-entry--active" : "nav-entry nav-entry--link"
            }
          >
            <Icon name={item.icon} className="nav-entry__icon" />
            <span className="nav-entry__label">{t(item.label)}</span>
          </NavLink>
        ))}
        {canReadStockDiscrepancies(context?.active_role_code) ? (
          <>
            {/* RT-178: shown only for the roles the API lets read this surface. */}
            <div className="nav-section">{t("shell.nav.section.inventory")}</div>
            <NavLink
              to="/stock-discrepancies"
              className={({ isActive }) =>
                isActive ? "nav-entry nav-entry--active" : "nav-entry nav-entry--link"
              }
            >
              <Icon name="stock" className="nav-entry__icon" />
              <span className="nav-entry__label">{t("shell.nav.stockDiscrepancies")}</span>
            </NavLink>
          </>
        ) : null}
        {showGatedNav
          ? GATED_NAV.map((item) => (
              <span key={item.gate} className="nav-entry nav-entry--disabled" aria-disabled="true">
                <Icon name={item.icon} className="nav-entry__icon" />
                <span className="nav-entry__label">{t(item.label)}</span>
                <span className="nav-gate">{item.gate}</span>
              </span>
            ))
          : null}
        <div className="topbar__spacer" />
        <button type="button" className="nav-entry nav-signout" onClick={() => void onSignOut()}>
          <Icon name="sign-out" className="nav-entry__icon" />
          <span className="nav-entry__label">{t("shell.signOut")}</span>
        </button>
      </nav>

      {/* data-dirty-scope: forms edited in here count as unsaved work (RT-268). */}
      <main className="content" data-dirty-scope>
        {children}
      </main>
    </div>
  );
}
