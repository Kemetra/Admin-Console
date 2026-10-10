/**
 * RT-268 Stay / Discard confirmation. A real modal (UX-11 "modal semantics
 * require modal behavior"): initial focus on the safe choice, Escape = Stay,
 * Tab is trapped, and focus returns to whatever held it before.
 */
import { useEffect, useRef } from "react";
import "./dirty-guard.css";

/** The button Tab would leave from, and the one it should wrap to. */
function tabEdges(panel: HTMLElement, backwards: boolean): [HTMLElement, HTMLElement] {
  const buttons = Array.from(panel.querySelectorAll<HTMLElement>("button"));
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  return backwards ? [first, last] : [last, first];
}

/** Keep Tab / Shift+Tab cycling between the dialog's buttons. */
function trapTab(e: React.KeyboardEvent<HTMLElement>, panel: HTMLElement): void {
  const [edge, wrapTo] = tabEdges(panel, e.shiftKey);
  if (document.activeElement !== edge) return;
  e.preventDefault();
  wrapTo.focus();
}

function handleKey(
  e: React.KeyboardEvent<HTMLElement>,
  panel: HTMLElement | null,
  onStay: () => void,
): void {
  if (e.key === "Escape") {
    e.preventDefault();
    onStay();
  } else if (e.key === "Tab" && panel) {
    trapTab(e, panel);
  }
}

/** Focus `target` on open; give focus back to its previous owner on close. */
function useFocusWhileOpen(target: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    target.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [target]);
}

export interface LeaveDialogProps {
  onStay: () => void;
  onDiscard: () => void;
}

export function LeaveDialog({ onStay, onDiscard }: LeaveDialogProps): React.JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  useFocusWhileOpen(stayRef);

  return (
    <div className="leave-scrim" role="presentation">
      <div
        ref={panelRef}
        className="leave-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-dialog-title"
        aria-describedby="leave-dialog-desc"
        onKeyDown={(e) => handleKey(e, panelRef.current, onStay)}
      >
        <h2 id="leave-dialog-title" className="leave-dialog__title">
          Leave without saving?
        </h2>
        <p id="leave-dialog-desc" className="leave-dialog__desc">
          This page has changes that are not saved. If you leave, they are lost.
        </p>
        <div className="leave-dialog__actions">
          <button ref={stayRef} type="button" className="btn-primary" onClick={onStay}>
            Stay on this page
          </button>
          <button type="button" className="btn-destructive" onClick={onDiscard}>
            Discard changes
          </button>
        </div>
      </div>
    </div>
  );
}
