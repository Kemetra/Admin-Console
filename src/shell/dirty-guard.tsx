/**
 * RT-268 (UX-09) — unsaved-work guard for scope changes and navigation.
 *
 * Scope change is a context transition, not a filter click: it must never
 * silently discard unsaved form work. The guard tracks which forms inside the
 * shell's content area (`[data-dirty-scope]`) the user has edited, and before a
 * scope change or a route change asks Stay / Discard (owner decision 2026-10-10:
 * no generic "Save", so each form keeps its own validation and idempotency).
 *
 * Tracking is structural, so no form has to opt in:
 *  - any `input`/`change` event on a control inside a `<form>` in the content
 *    area marks that form dirty;
 *  - a form stops counting once it leaves the document (page left, drawer
 *    closed after a save);
 *  - filter/search forms opt out with `data-dirty-guard="off"`;
 *  - a post-save redirect passes `{ state: SAVED_NAVIGATION }` so it is not
 *    blocked.
 *
 * Without a provider (unit tests rendering a surface on its own) the hook falls
 * back to "never dirty", so nothing outside the app root has to know about it.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useBlocker } from "react-router";
import "./dirty-guard.css";

export interface DirtyGuardValue {
  /** True when a tracked form in the content area holds unsaved edits. */
  isDirty: () => boolean;
  /** Resolves true when it is safe to leave (clean, or the user chose Discard). */
  confirmLeave: () => Promise<boolean>;
}

/** Navigation state a form passes on its post-save redirect. */
export const SAVED_NAVIGATION = { dirtyGuard: "saved" } as const;

const fallback: DirtyGuardValue = {
  isDirty: () => false,
  confirmLeave: async () => true,
};

const DirtyGuardContext = createContext<DirtyGuardValue | null>(null);

export function useDirtyGuard(): DirtyGuardValue {
  return useContext(DirtyGuardContext) ?? fallback;
}

function formOf(target: EventTarget | null): HTMLFormElement | null {
  if (!(target instanceof HTMLElement) || !target.closest("[data-dirty-scope]")) return null;
  const form = (target as HTMLInputElement).form ?? target.closest("form");
  return form && form.dataset.dirtyGuard !== "off" ? form : null;
}

export function DirtyGuardProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const forms = useRef(new Set<HTMLFormElement>());
  const pending = useRef<{ promise: Promise<boolean>; resolve: (ok: boolean) => void } | null>(
    null,
  );
  const [asking, setAsking] = useState(false);

  const isDirty = useCallback(() => {
    for (const form of forms.current) {
      if (!form.isConnected) forms.current.delete(form);
    }
    return forms.current.size > 0;
  }, []);

  useEffect(() => {
    const track = (e: Event) => {
      const form = formOf(e.target);
      if (form) forms.current.add(form);
    };
    // Closing or reloading the tab with unsaved work gets the browser's prompt.
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty()) e.preventDefault();
    };
    document.addEventListener("input", track, true);
    document.addEventListener("change", track, true);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      document.removeEventListener("input", track, true);
      document.removeEventListener("change", track, true);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [isDirty]);

  const confirmLeave = useCallback(() => {
    if (!isDirty()) return Promise.resolve(true);
    if (!pending.current) {
      let resolve: (ok: boolean) => void = () => {};
      const promise = new Promise<boolean>((r) => {
        resolve = r;
      });
      pending.current = { promise, resolve };
      setAsking(true);
    }
    return pending.current.promise;
  }, [isDirty]);

  const settle = (ok: boolean) => {
    if (ok) forms.current.clear();
    pending.current?.resolve(ok);
    pending.current = null;
    setAsking(false);
  };

  const value = useMemo(() => ({ isDirty, confirmLeave }), [isDirty, confirmLeave]);
  return (
    <DirtyGuardContext.Provider value={value}>
      {children}
      {asking ? <LeaveDialog onStay={() => settle(false)} onDiscard={() => settle(true)} /> : null}
    </DirtyGuardContext.Provider>
  );
}

interface LeaveDialogProps {
  onStay: () => void;
  onDiscard: () => void;
}

/**
 * Stay / Discard confirmation. A real modal (UX-11 "modal semantics require
 * modal behavior"): initial focus on the safe choice, Escape = Stay, Tab is
 * trapped, and focus returns to whatever held it before.
 */
function LeaveDialog({ onStay, onDiscard }: LeaveDialogProps): React.JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    stayRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === "Escape") {
      e.preventDefault();
      onStay();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const buttons = Array.from(panelRef.current.querySelectorAll<HTMLElement>("button"));
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="leave-scrim" role="presentation">
      <div
        ref={panelRef}
        className="leave-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-dialog-title"
        aria-describedby="leave-dialog-desc"
        onKeyDown={onKeyDown}
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

/**
 * Blocks in-app navigation (links, back/forward) while a form is dirty and asks
 * Stay / Discard. Needs a data router (App uses createBrowserRouter). A
 * post-save redirect carrying SAVED_NAVIGATION passes straight through.
 */
export function NavigationBlocker(): null {
  const guard = useDirtyGuard();
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const state = nextLocation.state as { dirtyGuard?: string } | null;
    if (state?.dirtyGuard === SAVED_NAVIGATION.dirtyGuard) return false;
    const moving =
      currentLocation.pathname !== nextLocation.pathname ||
      currentLocation.search !== nextLocation.search;
    return moving && guard.isDirty();
  });
  const latest = useRef(blocker);
  latest.current = blocker;

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    void guard.confirmLeave().then((ok) => {
      const current = latest.current;
      if (current.state !== "blocked") return;
      if (ok) current.proceed();
      else current.reset();
    });
  }, [blocker.state, guard]);

  return null;
}
