/**
 * Side-panel drawer (RF-5 SF5-2/SF5-3). A new shared primitive: invite + edit
 * mount over the member list as a side panel at the inline end (right in English,
 * left in Arabic, RT-399) (`--shadow-overlay`, DESIGN.md
 * rule 8). Not a modal-as-first-thought — it is the intent-driven editing
 * surface for a row/action, with the list still visible behind it.
 *
 * Accessibility: labelled dialog, Escape closes, focus moves in on open, and
 * Tab/Shift+Tab are trapped within the panel so `aria-modal` is honest. No
 * nested cards (rule 5); internal grouping uses ruled sections.
 */
import { useT } from "@/i18n";
import { useEffect, useRef } from "react";
import "./drawer.css";

export interface DrawerProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Drawer({ title, onClose, children }: Readonly<DrawerProps>): React.JSX.Element {
  const t = useT();
  const panelRef = useRef<HTMLDialogElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Move focus in on open; restore it to the trigger (the row/button that
    // opened the drawer) on close, so keyboard users keep their place.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  // A click on the scrim itself (not the panel) closes. Keyboard close is Escape
  // on the dialog, so the non-interactive scrim carries no JSX handler.
  useEffect(() => {
    const scrim = scrimRef.current;
    if (!scrim) return;
    const closeOnScrimClick = (e: MouseEvent): void => {
      if (e.target === scrim) onClose();
    };
    scrim.addEventListener("click", closeOnScrimClick);
    return () => scrim.removeEventListener("click", closeOnScrimClick);
  }, [onClose]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDialogElement>): void {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    // Trap focus within the panel (honors aria-modal): cycle at the edges.
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null,
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div ref={scrimRef} className="drawer-scrim">
      {/* Native <dialog open>, positioned by the scrim rather than the top layer
          (the side-drawer needs custom backdrop/placement). Focus is moved in and
          trapped (onKeyDown), so aria-modal is honored. */}
      <dialog
        ref={panelRef}
        open
        className="drawer"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="drawer__head">
          <h2 className="drawer__title">{title}</h2>
          <button
            type="button"
            className="btn-ghost"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </header>
        <div className="drawer__body">{children}</div>
      </dialog>
    </div>
  );
}
