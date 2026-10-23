/**
 * RT-825 (RT-785 SHELL-M1, decisions D1/D2): the compact shell's menu. At
 * ≤768px the sidebar is hidden, so the top bar's first item is a menu button
 * that opens a modal navigation drawer from the inline start (the shared
 * `Drawer`, start side). The drawer holds who is signed in, the same nav
 * entries the sidebar renders, then the language switch, the theme switch and
 * sign-out, so nothing the desktop top bar or sidebar offers is lost on a phone.
 *
 * The drawer mounts only while open. Choosing any destination closes it (the
 * current one too, which changes no location), and so does growing past the
 * compact width, where the menu button is hidden. Focus returns to the button
 * (Drawer restores it).
 */
import { Drawer } from "@/components/Drawer";
import { Icon } from "@/components/icons/Icon";
import { useT } from "@/i18n";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import { ThemeToggle } from "@/theme/ThemeToggle";
import { useEffect, useId, useState } from "react";

/** The compact-shell breakpoint; app-shell.css uses the same width. */
const COMPACT_QUERY = "(max-width: 768px)";

export interface ShellMenu {
  open: boolean;
  show: () => void;
  close: () => void;
}

export function useShellMenu(): ShellMenu {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(COMPACT_QUERY);
    const closeWhenWide = (e: { matches: boolean }): void => {
      if (!e.matches) setOpen(false);
    };
    query.addEventListener("change", closeWhenWide);
    return () => query.removeEventListener("change", closeWhenWide);
  }, [open]);

  return { open, show: () => setOpen(true), close: () => setOpen(false) };
}

export interface ShellMenuButtonProps {
  menu: ShellMenu;
  drawerId: string;
}

/** The top bar's first item at the compact width; hidden above it (CSS). */
export function ShellMenuButton({ menu, drawerId }: Readonly<ShellMenuButtonProps>) {
  const t = useT();
  return (
    <button
      type="button"
      className="shell-menu-btn"
      aria-expanded={menu.open}
      // Only while open: the drawer is not mounted otherwise.
      aria-controls={menu.open ? drawerId : undefined}
      // Safari does not focus a tapped button; Drawer returns focus to whatever
      // held it when it opened, so make that this button on every engine.
      onClick={(e) => {
        e.currentTarget.focus();
        menu.show();
      }}
    >
      {t("shell.menu")}
    </button>
  );
}

export interface ShellMenuDrawerProps {
  menu: ShellMenu;
  drawerId: string;
  user: { id?: string; display_name?: string | null; email?: string | null } | undefined;
  roleLabel?: string;
  navLabel: string;
  onSignOut: () => void | Promise<void>;
  /** The nav entries; `onNavigate` closes the drawer. */
  renderNav: (onNavigate: () => void) => React.ReactNode;
}

export function ShellMenuDrawer({
  menu,
  drawerId,
  user,
  roleLabel,
  navLabel,
  onSignOut,
  renderNav,
}: Readonly<ShellMenuDrawerProps>): React.JSX.Element | null {
  const t = useT();
  if (!menu.open) return null;
  return (
    <Drawer title={t("shell.menu")} onClose={menu.close} side="start" id={drawerId}>
      {user ? (
        <div className="shell-menu__who">
          <span className="shell-menu__name">
            <bdi>{user.display_name ?? user.email}</bdi>
          </span>
          {roleLabel ? <span className="shell-menu__role">{roleLabel}</span> : null}
        </div>
      ) : null}
      <nav className="shell-menu__nav" aria-label={navLabel}>
        {renderNav(menu.close)}
      </nav>
      <div className="shell-menu__prefs">
        <LocaleSwitch userId={user?.id} />
        <ThemeToggle userId={user?.id} />
        <button type="button" className="nav-entry nav-signout" onClick={() => void onSignOut()}>
          <Icon name="signOut" className="nav-entry__icon" />
          <span className="nav-entry__label">{t("shell.signOut")}</span>
        </button>
      </div>
    </Drawer>
  );
}

/** A stable id for the drawer, shared by the button's aria-controls. */
export function useShellMenuId(): string {
  return `shell-menu-${useId().replaceAll(":", "")}`;
}
