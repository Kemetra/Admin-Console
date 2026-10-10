import { Icon, type IconName } from "@/components/Icon";
import { TowerMark } from "@/components/TowerMark";
/**
 * SF-2 authenticated app shell (T027; RF-2 T009/T010). top-bar + persistent gold
 * scope header + sidebar + content (DESIGN.md layout). The frame every RF-2..RF-7
 * family attaches to. The content area renders `children` — the routed surface
 * (an <Outlet/> from the layout route). Sidebar entries beyond what is built are
 * shown gated to mark scope, not to claim they are built.
 *
 * Console v4.0 visual adoption: each nav entry leads with a decorative line icon
 * (aria-hidden, so labels stay the sole accessible name) and the topbar carries
 * the Console product label. Operational chrome with no backing yet (search,
 * notifications, system status, theme switch) is intentionally NOT rendered — a
 * dead control reads as a fake to an operator (PRODUCT.md P4/P5); each arrives as
 * its own slice when wired. Gated nav entries are the one exception, and they
 * announce it explicitly with a gate badge (RF-3 / RF-4).
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { canReadStockDiscrepancies } from "@/stock-discrepancies/stockDiscrepancyLogic";
import { NavLink } from "react-router";
import { ScopeHeader } from "./ScopeHeader";
import "./app-shell.css";

/** Live nav: RF-2 (Tenants/Stores), RF-5 (Operators), RF-6 (Audit). */
const LIVE_NAV: { label: string; to: string; icon: IconName }[] = [
  { label: "Tenants", to: "/tenants", icon: "tenants" },
  { label: "Stores", to: "/stores", icon: "stores" },
  { label: "Operators", to: "/operators", icon: "operators" },
  { label: "Audit", to: "/audit", icon: "audit" },
];

/** Families not yet built — shown gated to mark scope, not to claim built. */
const GATED_NAV: { label: string; gate: string; icon: IconName }[] = [
  { label: "Catalog", gate: "RF-3", icon: "catalog" },
  { label: "Unknown items", gate: "RF-4", icon: "unknown" },
];

export interface AppShellProps {
  onSignOut: () => void | Promise<void>;
  children?: React.ReactNode;
}

export function AppShell({ onSignOut, children }: AppShellProps): React.JSX.Element {
  const { context } = useActiveContextValue();
  const user = context?.user;
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
          <span className="tower-lockup__tag">Console</span>
        </span>

        <div className="topbar__spacer" />
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
              <small>{context?.active_role_code ?? ""}</small>
            </span>
          </span>
        ) : null}
      </header>

      <ScopeHeader />

      <nav className="sidebar" aria-label="Primary">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? "nav-entry nav-entry--active" : "nav-entry nav-entry--link"
          }
        >
          <Icon name="overview" className="nav-entry__icon" />
          <span className="nav-entry__label">Overview</span>
        </NavLink>
        <div className="nav-section">Management</div>
        {LIVE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? "nav-entry nav-entry--active" : "nav-entry nav-entry--link"
            }
          >
            <Icon name={item.icon} className="nav-entry__icon" />
            <span className="nav-entry__label">{item.label}</span>
          </NavLink>
        ))}
        {canReadStockDiscrepancies(context?.active_role_code) ? (
          <>
            {/* RT-178: shown only for the roles the API lets read this surface. */}
            <div className="nav-section">Inventory</div>
            <NavLink
              to="/stock-discrepancies"
              className={({ isActive }) =>
                isActive ? "nav-entry nav-entry--active" : "nav-entry nav-entry--link"
              }
            >
              <Icon name="stock" className="nav-entry__icon" />
              <span className="nav-entry__label">Stock discrepancies</span>
            </NavLink>
          </>
        ) : null}
        {GATED_NAV.map((item) => (
          <span key={item.gate} className="nav-entry nav-entry--disabled" aria-disabled="true">
            <Icon name={item.icon} className="nav-entry__icon" />
            <span className="nav-entry__label">{item.label}</span>
            <span className="nav-gate">{item.gate}</span>
          </span>
        ))}
        <div className="topbar__spacer" />
        <button type="button" className="nav-entry nav-signout" onClick={() => void onSignOut()}>
          <Icon name="sign-out" className="nav-entry__icon" />
          <span className="nav-entry__label">Sign out</span>
        </button>
      </nav>

      {/* data-dirty-scope: forms edited in here count as unsaved work (RT-268). */}
      <main className="content" data-dirty-scope>
        {children}
      </main>
    </div>
  );
}
