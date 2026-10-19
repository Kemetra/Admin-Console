import { TowerMark } from "@/components/TowerMark";
import { Icon, type IconNameFor } from "@/components/icons/Icon";
/**
 * SF-2 authenticated app shell (T027; RF-2 T009/T010). top-bar + persistent
 * scope header + sidebar + content (DESIGN.md layout). The frame every RF-2..RF-7
 * family attaches to. The content area renders `children` — the routed surface
 * (an <Outlet/> from the layout route). Sidebar entries beyond what is built are
 * shown gated to mark scope, not to claim they are built — in dev builds only.
 * RT-270 (UX-09: no dead destinations): a production build never lists them.
 *
 * Console v4.0 visual adoption: each nav entry leads with a decorative registry
 * icon (RT-696; aria-hidden, so labels stay the sole accessible name) and the topbar carries
 * the Console product label, the language switch (RT-399) and the dark-mode
 * switch (RT-398) before the user.
 * Operational chrome with no backing yet (search, notifications, system
 * status) is intentionally NOT rendered — a
 * dead control reads as a fake to an operator (PRODUCT.md P4/P5); each arrives as
 * its own slice when wired. Gated nav entries are the one exception, and they
 * announce it explicitly with a gate badge (RF-3).
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { canReadDevices } from "@/devices/deviceLogic";
import { canReadErpStatus } from "@/erp-status/erpStatusLogic";
import { type MessageKey, roleKey, useT } from "@/i18n";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import { canReadPayers } from "@/payers/payerAccess";
import { canReadSales } from "@/sales/saleLogic";
import { canReadShiftCloses } from "@/shift-closes/shiftCloseLogic";
import { canReadStockDiscrepancies } from "@/stock-discrepancies/stockDiscrepancyLogic";
import { ThemeToggle } from "@/theme/ThemeToggle";
import { canReadUnknownItems } from "@/unknown-items/unknownItemAccess";
import { Fragment } from "react";
import { NavLink } from "react-router";
import { ScopeHeader } from "./ScopeHeader";
import "./app-shell.css";

/** Nav glyphs all sit on the md (20) grid (RT-263 doc 25 §2 rule 7). */
type NavIcon = IconNameFor<"md">;

/** Live nav: RF-2 (Tenants/Stores), RF-5 (Operators), RF-6 (Audit). */
const LIVE_NAV: { label: MessageKey; to: string; icon: NavIcon }[] = [
  { label: "shell.nav.tenants", to: "/tenants", icon: "tenant" },
  { label: "shell.nav.stores", to: "/stores", icon: "store" },
  { label: "shell.nav.operators", to: "/operators", icon: "people" },
  { label: "shell.nav.audit", to: "/audit", icon: "audit" },
];

/**
 * Role-gated destinations, each under its own section: shown only for the roles
 * the API lets read the surface (RT-178 stock discrepancies, RT-18 shift
 * closes, RT-560 ERP connection, RT-371 devices, RT-421 payer accounts, RT-587
 * sales, RT-724 unknown items). The nav mirrors the API; it is not an authorization decision.
 */
const ROLE_NAV: {
  section: MessageKey;
  label: MessageKey;
  to: string;
  icon: NavIcon;
  canRead: (role: string | null | undefined) => boolean;
}[] = [
  {
    // RT-587 (spec 012 FR-012, OD-556-3): sales search and sale detail.
    section: "sales.nav.section",
    label: "sales.nav.label",
    to: "/sales",
    icon: "sale",
    canRead: canReadSales,
  },
  {
    section: "shell.nav.section.inventory",
    label: "shell.nav.stockDiscrepancies",
    to: "/stock-discrepancies",
    icon: "inventory",
    canRead: canReadStockDiscrepancies,
  },
  {
    // RT-724: the unknown-items review queue left the RF-4 gate once its
    // RF-4b actions shipped; listed for the roles the list API serves.
    section: "shell.nav.section.catalog",
    label: "shell.nav.unknownItems",
    to: "/unknown-items",
    icon: "unknownItem",
    canRead: canReadUnknownItems,
  },
  {
    section: "shell.nav.section.cash",
    label: "shell.nav.shiftCloses",
    to: "/shift-closes",
    icon: "cash",
    canRead: canReadShiftCloses,
  },
  {
    // RT-557 OD-2 (decided in RT-560): one entry in its own section, owner /
    // tenant_admin only, within the RT-392 nav budget.
    section: "erp.nav.section",
    label: "erp.nav.label",
    to: "/erp-connection",
    icon: "connection",
    canRead: canReadErpStatus,
  },
  {
    // RT-371: the device registry, for the roles the RT-365 API lets read it.
    section: "devices.nav.section",
    label: "devices.nav.label",
    to: "/devices",
    icon: "terminal",
    canRead: canReadDevices,
  },
  {
    // RT-421: the 017 payer accounts, owner / tenant_admin only (the API's roles).
    section: "payers.nav.section",
    label: "payers.nav.label",
    to: "/payer-accounts",
    icon: "cash",
    canRead: canReadPayers,
  },
];

/**
 * Families not yet built — shown gated to mark scope, not to claim built. Dev
 * builds only (RT-270): in production they would be dead destinations.
 */
const GATED_NAV: { label: MessageKey; gate: string; icon: NavIcon }[] = [
  { label: "shell.nav.catalog", gate: "RF-3", icon: "product" },
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
          <Icon name="dashboard" className="nav-entry__icon" />
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
        {ROLE_NAV.filter((entry) => entry.canRead(context?.active_role_code)).map((entry) => (
          <Fragment key={entry.to}>
            <div className="nav-section">{t(entry.section)}</div>
            <NavLink
              to={entry.to}
              className={({ isActive }) =>
                isActive ? "nav-entry nav-entry--active" : "nav-entry nav-entry--link"
              }
            >
              <Icon name={entry.icon} className="nav-entry__icon" />
              <span className="nav-entry__label">{t(entry.label)}</span>
            </NavLink>
          </Fragment>
        ))}
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
          <Icon name="signOut" className="nav-entry__icon" />
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
