import { canReadCatalog } from "@/catalog/catalogLogic";
import { RateLimitBanner } from "@/components/RateLimitBanner";
import { TowerMark } from "@/components/TowerMark";
import { Icon, type IconNameFor } from "@/components/icons/Icon";
/**
 * SF-2 authenticated app shell (T027; RF-2 T009/T010). top-bar + persistent
 * scope header + sidebar + content (DESIGN.md layout). The frame every RF-2..RF-7
 * family attaches to. The content area renders `children` — the routed surface
 * (an <Outlet/> from the layout route). RT-270 (UX-09: no dead destinations): a
 * destination is listed only once it is built. The dev-only gated placeholders
 * went with the last one, the RF-3 Catalog entry (RT-765).
 *
 * Console v4.0 visual adoption: each nav entry leads with a decorative registry
 * icon (RT-696; aria-hidden, so labels stay the sole accessible name) and the topbar carries
 * the Console product label, the language switch (RT-399) and the dark-mode
 * switch (RT-398) before the user.
 * Operational chrome with no backing yet (search, notifications, system
 * status) is intentionally NOT rendered — a
 * dead control reads as a fake to an operator (PRODUCT.md P4/P5); each arrives as
 * its own slice when wired.
 */
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { canReadDevices } from "@/devices/deviceLogic";
import { canReadErpStatus } from "@/erp-status/erpStatusLogic";
import { type MessageKey, roleKey, useT } from "@/i18n";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import { canReadInventory } from "@/inventory/inventoryLogic";
import { canReadPayers } from "@/payers/payerAccess";
import {
  SupportSessionBarSlot,
  SupportSessionBoundary,
} from "@/platform/session/SupportSessionBoundary";
import { useSupportSession } from "@/platform/session/useSupportSession";
import { canUseProductReconciliation } from "@/product-reconciliation/productReconLogic";
import { canUseSaleSyncOps } from "@/sale-sync/saleSyncLogic";
import { canReadSales } from "@/sales/saleLogic";
import { canReadShiftCloses } from "@/shift-closes/shiftCloseLogic";
import { canReadStockDiscrepancies } from "@/stock-discrepancies/stockDiscrepancyLogic";
import { ThemeToggle } from "@/theme/ThemeToggle";
import { canReadUnknownItems } from "@/unknown-items/unknownItemAccess";
import { Fragment } from "react";
import { NavLink } from "react-router";
import { ScopeHeader } from "./ScopeHeader";
import { ShellMenuButton, ShellMenuDrawer, useShellMenu, useShellMenuId } from "./ShellMenu";
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
 * sales, RT-724 unknown items, RT-726 sales needing repair, RT-727 product
 * reconciliation, RT-728 inventory, RT-765 catalog items). Consecutive entries of one section share
 * its heading. The nav mirrors the API; it is not an authorization decision.
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
    // RT-728: the read-only movement ledger, locations and on-hand, in the same
    // Inventory section, for the console roles with store-scoped reads.
    section: "shell.nav.section.inventory",
    label: "inventory.nav.label",
    to: "/inventory",
    icon: "inventory",
    canRead: canReadInventory,
  },
  {
    // RT-765 (RT-752 AC 2): «الأصناف», first in the Catalog section, for the
    // roles the catalog read API serves. Its child routes keep it selected.
    section: "shell.nav.section.catalog",
    label: "catalog.nav.label",
    to: "/catalog/products",
    icon: "product",
    canRead: canReadCatalog,
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
    // RT-726: the NEEDS_REPAIR queue, beside the ERP status in the same
    // section, for the roles the sale sync-ops API serves (owner / tenant_admin).
    section: "erp.nav.section",
    label: "saleSync.nav.label",
    to: "/sales-needing-repair",
    icon: "sale",
    canRead: canUseSaleSyncOps,
  },
  {
    // RT-727: ERPNext product-master reconciliation, in the same Integration
    // section as the connection status (owner / tenant_admin, the API's roles).
    section: "erp.nav.section",
    label: "productRecon.nav.label",
    to: "/product-reconciliation",
    icon: "product",
    canRead: canUseProductReconciliation,
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

type RoleNavEntry = (typeof ROLE_NAV)[number];

const entryClass = ({ isActive }: { isActive: boolean }): string =>
  isActive ? "nav-entry nav-entry--active" : "nav-entry nav-entry--link";

/**
 * The tenant shell's destinations, rendered once for the sidebar and once for
 * the compact-shell drawer (RT-825), so both list exactly the same entries.
 * `onNavigate` lets the drawer close on any choice, the current page included.
 */
function TenantNavEntries({
  inSession,
  roleNav,
  onNavigate,
}: Readonly<{
  inSession: boolean;
  roleNav: readonly RoleNavEntry[];
  onNavigate?: () => void;
}>): React.JSX.Element {
  const t = useT();
  if (inSession) {
    return (
      <NavLink to="/platform/tenants" className="nav-entry nav-entry--link" onClick={onNavigate}>
        <Icon name="tenant" className="nav-entry__icon" />
        <span className="nav-entry__label">{t("platform.nav.tenants")}</span>
      </NavLink>
    );
  }
  return (
    <>
      <NavLink to="/" end className={entryClass} onClick={onNavigate}>
        <Icon name="dashboard" className="nav-entry__icon" />
        <span className="nav-entry__label">{t("shell.nav.overview")}</span>
      </NavLink>
      <div className="nav-section">{t("shell.nav.section.management")}</div>
      {LIVE_NAV.map((item) => (
        <NavLink key={item.to} to={item.to} className={entryClass} onClick={onNavigate}>
          <Icon name={item.icon} className="nav-entry__icon" />
          <span className="nav-entry__label">{t(item.label)}</span>
        </NavLink>
      ))}
      {roleNav.map((entry, index) => (
        <Fragment key={entry.to}>
          {roleNav[index - 1]?.section === entry.section ? null : (
            <div className="nav-section">{t(entry.section)}</div>
          )}
          <NavLink to={entry.to} className={entryClass} onClick={onNavigate}>
            <Icon name={entry.icon} className="nav-entry__icon" />
            <span className="nav-entry__label">{t(entry.label)}</span>
          </NavLink>
        </Fragment>
      ))}
    </>
  );
}

export interface AppShellProps {
  onSignOut: () => void | Promise<void>;
  children?: React.ReactNode;
}

export function AppShell({ onSignOut, children }: Readonly<AppShellProps>): React.JSX.Element {
  const t = useT();
  const { context } = useActiveContextValue();
  const supportSession = useSupportSession();
  // RT-781: inside a support session the shell shows no tenant surface, scope bar or tenant
  // navigation: no write control by construction (a UI safeguard, not a security control).
  const inSession = supportSession !== null;
  const user = context?.user;
  const roleCode = context?.active_role_code;
  const roleNav = ROLE_NAV.filter((entry) => entry.canRead(roleCode));
  const menu = useShellMenu();
  const menuId = useShellMenuId();
  const initials = (user?.display_name ?? user?.email ?? "?")
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className={inSession ? "shell shell--session" : "shell"}>
      <header className="topbar">
        <ShellMenuButton menu={menu} drawerId={menuId} />
        <span className="tower-lockup">
          <TowerMark className="tower-mark" />
          <span className="tower-lockup__word">Retail Tower OS</span>
          <span className="tower-lockup__tag">{t("app.productTag")}</span>
        </span>

        <div className="topbar__spacer" />
        {/* RT-825: at the compact width these move into the menu drawer. */}
        <div className="topbar__prefs">
          <LocaleSwitch userId={user?.id} />
          <ThemeToggle userId={user?.id} />
        </div>
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

      {/* RT-781: the support-session bar, only for a session-entered tenant. */}
      <div className="shell-session-slot">
        <SupportSessionBarSlot controller={supportSession} />
      </div>

      {inSession ? null : <ScopeHeader />}

      <nav className="sidebar" aria-label={t("shell.nav.label")}>
        <TenantNavEntries inSession={inSession} roleNav={roleNav} />
        <div className="topbar__spacer" />
        <button type="button" className="nav-entry nav-signout" onClick={() => void onSignOut()}>
          <Icon name="signOut" className="nav-entry__icon" />
          <span className="nav-entry__label">{t("shell.signOut")}</span>
        </button>
      </nav>

      <ShellMenuDrawer
        menu={menu}
        drawerId={menuId}
        user={user}
        roleLabel={roleCode ? t(roleKey(roleCode)) : undefined}
        navLabel={t("shell.nav.label")}
        onSignOut={onSignOut}
        renderNav={(onNavigate) => (
          <TenantNavEntries inSession={inSession} roleNav={roleNav} onNavigate={onNavigate} />
        )}
      />

      {/* data-dirty-scope: forms edited in here count as unsaved work (RT-268). */}
      <main className="content" data-dirty-scope>
        {/* RT-621: any 429 shows here, above the surface, without blocking it. */}
        <RateLimitBanner />
        <SupportSessionBoundary controller={supportSession} tenantShell>
          {children}
        </SupportSessionBoundary>
      </main>
    </div>
  );
}
