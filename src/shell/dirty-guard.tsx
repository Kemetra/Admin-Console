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
 * The dialog lives in leave-dialog.tsx and the route guard in
 * navigation-blocker.tsx.
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
import { LeaveDialog } from "./leave-dialog";

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

function inContentArea(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement && target.closest("[data-dirty-scope]") !== null;
}

function ownerForm(el: HTMLElement): HTMLFormElement | null {
  return (el as HTMLInputElement).form ?? el.closest("form");
}

function isTracked(form: HTMLFormElement | null): form is HTMLFormElement {
  return form !== null && form.dataset.dirtyGuard !== "off";
}

/** The form an edit belongs to, when that form counts as unsaved work. */
function editedForm(target: EventTarget | null): HTMLFormElement | null {
  if (!inContentArea(target)) return null;
  const form = ownerForm(target);
  return isTracked(form) ? form : null;
}

/** Drop forms that left the page (page left, drawer closed after a save). */
function pruneDetached(forms: Set<HTMLFormElement>): void {
  for (const form of forms) {
    if (!form.isConnected) forms.delete(form);
  }
}

/** Tracks edited forms in the content area, plus the tab-close prompt. */
function useFormTracking(
  forms: React.MutableRefObject<Set<HTMLFormElement>>,
  isDirty: () => boolean,
): void {
  useEffect(() => {
    const track = (e: Event) => {
      const form = editedForm(e.target);
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
  }, [forms, isDirty]);
}

interface Deferred {
  promise: Promise<boolean>;
  resolve: (ok: boolean) => void;
}

function deferred(): Deferred {
  let resolve: (ok: boolean) => void = () => {};
  const promise = new Promise<boolean>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export function DirtyGuardProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const forms = useRef(new Set<HTMLFormElement>());
  const pending = useRef<Deferred | null>(null);
  const [asking, setAsking] = useState(false);

  const isDirty = useCallback(() => {
    pruneDetached(forms.current);
    return forms.current.size > 0;
  }, []);
  useFormTracking(forms, isDirty);

  // One prompt at a time: concurrent callers share the same answer.
  const confirmLeave = useCallback(() => {
    if (!isDirty()) return Promise.resolve(true);
    pending.current ??= deferred();
    setAsking(true);
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
