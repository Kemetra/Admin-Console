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
 *
 * Closing plays an exit (panel slides out, scrim fades) on `--duration-2`. Whether
 * a close is allowed is decided when it is requested: a non-dismissible drawer
 * (a request in flight whose answer must not be lost, e.g. a one-time pairing
 * code) ignores Escape, the scrim and the close button. The `onClose` in force at
 * that moment runs when the exit ends; a parent that keeps the drawer mounted gets
 * it back usable. Under reduced motion the token is 0ms, so `onClose` runs at once.
 */
import { Icon } from "@/components/icons/Icon";
import { useT } from "@/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import "./drawer.css";

export interface DrawerProps {
  title: string;
  onClose: () => void;
  /** False while closing would lose work (a request in flight). Default true. */
  dismissible?: boolean;
  children: React.ReactNode;
}

/** `--duration-2` in ms from the root's computed style; "", NaN or 0 mean no exit. */
function exitDurationMs(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--duration-2").trim();
  const value = Number.parseFloat(raw);
  if (Number.isNaN(value) || value <= 0) return 0;
  return raw.endsWith("ms") || !raw.endsWith("s") ? value : value * 1000;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Drawer({
  title,
  onClose,
  dismissible = true,
  children,
}: Readonly<DrawerProps>): React.JSX.Element {
  const t = useT();
  const panelRef = useRef<HTMLDialogElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  const requestClose = useCallback((): void => {
    if (closingRef.current || !dismissibleRef.current) return;
    // Decided now, not when the exit ends: the handler in force at the request.
    const close = onCloseRef.current;
    const ms = exitDurationMs();
    if (ms === 0) {
      close();
      return;
    }
    closingRef.current = true;
    setClosing(true);
    timerRef.current = setTimeout(() => {
      close();
      // Still mounted means the parent kept the drawer open: give it back.
      closingRef.current = false;
      setClosing(false);
    }, ms);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

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
      if (e.target === scrim) requestClose();
    };
    scrim.addEventListener("click", closeOnScrimClick);
    return () => scrim.removeEventListener("click", closeOnScrimClick);
  }, [requestClose]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDialogElement>): void {
    if (e.key === "Escape") {
      requestClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    // Trap focus within the panel (honors aria-modal): cycle at the edges.
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null,
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1) as HTMLElement;
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
    <div ref={scrimRef} className={closing ? "drawer-scrim drawer-scrim--closing" : "drawer-scrim"}>
      {/* Native <dialog open>, positioned by the scrim rather than the top layer
          (the side-drawer needs custom backdrop/placement). Focus is moved in and
          trapped (onKeyDown), so aria-modal is honored. */}
      <dialog
        ref={panelRef}
        open
        className={closing ? "drawer drawer--closing" : "drawer"}
        // While the exit plays nothing inside may act: a Save clicked or keyed
        // during those 150ms would land on a panel that is already leaving.
        inert={closing}
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
            onClick={requestClose}
            aria-label={t("common.close")}
          >
            <Icon name="close" size="sm" />
          </button>
        </header>
        <div className="drawer__body">{children}</div>
      </dialog>
    </div>
  );
}
