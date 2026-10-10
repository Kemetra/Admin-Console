import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { useStoreList } from "@/stores/useStoreQueries";
/**
 * Persistent gold scope header (SF-2, T028). DESIGN.md signature: the only
 * persistent gold surface besides the active nav marker. Always visible
 * in-context (rule 3). Click-to-switch opens the scope menu; selecting a tenant
 * or store drives the SF-3 mutators (which re-fetch — no optimistic update).
 *
 * RT-354: the menu lists the stores the caller may enter in the active tenant
 * (see scope-stores.ts). The list loads only while the menu is open and shares
 * the Stores page's cache key.
 *
 * RT-268: a scope change asks Stay / Discard when a form holds unsaved work,
 * Escape closes the menu back to its button, and the new scope is announced
 * politely to screen readers.
 */
import { useEffect, useRef, useState } from "react";
import { useDirtyGuard } from "./dirty-guard";
import { type ScopeMembership, type ScopeStore, scopeMenuStores } from "./scope-stores";
import "./scope-header.css";

/** Non-color "current scope" cue (RT-267/UX-11); aria-current names it for AT. */
function ActiveCheck(): React.JSX.Element {
  return (
    <span className="scope-menu__check" aria-hidden="true">
      ✓
    </span>
  );
}

interface ScopeMenuProps {
  tenant: { id: string; name?: string };
  activeStore: { id?: string; name?: string } | null | undefined;
  membership: ScopeMembership | undefined;
  onChooseStore: (storeId: string) => void;
  onAllStores: () => void;
}

function ScopeMenu({
  tenant,
  activeStore,
  membership,
  onChooseStore,
  onAllStores,
}: ScopeMenuProps): React.JSX.Element {
  const { result, isLoading, refetch } = useStoreList(tenant.id);
  // The shell must survive a malformed list: anything but an array lists nothing.
  const rows = result?.kind === "rows" && Array.isArray(result.rows) ? result.rows : [];
  const stores: ScopeStore[] = scopeMenuStores(rows, membership, activeStore);

  return (
    <div className="scope-menu" role="menu">
      <div className="scope-menu__group">STORE · {tenant.name}</div>
      <button
        type="button"
        role="menuitem"
        className={`scope-menu__item${activeStore ? "" : " scope-menu__item--active"}`}
        aria-current={activeStore ? undefined : "true"}
        onClick={onAllStores}
      >
        All stores
        {activeStore ? null : <ActiveCheck />}
      </button>
      {stores.map((s) => {
        const active = s.id === activeStore?.id;
        return (
          <button
            key={s.id}
            type="button"
            role="menuitem"
            className={`scope-menu__item${active ? " scope-menu__item--active" : ""}`}
            aria-current={active ? "true" : undefined}
            onClick={() => onChooseStore(s.id)}
          >
            {s.name ?? s.id}
            {active ? <ActiveCheck /> : null}
          </button>
        );
      })}
      {isLoading ? <div className="scope-menu__note">Loading stores…</div> : null}
      {result?.kind === "error" ? (
        <>
          <div className="scope-menu__note">Couldn't load stores.</div>
          <button type="button" role="menuitem" className="scope-menu__item" onClick={refetch}>
            Try again
          </button>
        </>
      ) : null}
      {result?.kind === "rows" && stores.length === 0 ? (
        <div className="scope-menu__note">No stores you can open in this tenant.</div>
      ) : null}
    </div>
  );
}

/** Polite announcement of a scope change for screen-reader users (RT-268). */
function useScopeAnnouncement(scopeKey: string, label: string): string {
  const [announcement, setAnnouncement] = useState("");
  const previous = useRef(scopeKey);
  useEffect(() => {
    if (previous.current === scopeKey) return;
    previous.current = scopeKey;
    setAnnouncement(`Now working in ${label}.`);
  }, [scopeKey, label]);
  return announcement;
}

export function ScopeHeader(): React.JSX.Element | null {
  const { context, switchStore, clearStore } = useActiveContextValue();
  const guard = useDirtyGuard();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const tenant = context?.active_tenant;
  const store = context?.active_store;
  const announcement = useScopeAnnouncement(
    `${tenant?.id ?? ""}/${store?.id ?? "all"}`,
    `${tenant?.name ?? ""}, ${store?.name ?? "all stores"}`,
  );
  if (!tenant?.id) {
    return null; // no header until a tenant is resolved (chooser handles that)
  }

  const closeMenu = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  // A scope change is a context transition: unsaved work is confirmed first
  // (RT-268), then the server switch runs and the context re-fetches.
  const changeScope = async (change: () => Promise<void>) => {
    closeMenu();
    if (await guard.confirmLeave()) await change();
  };

  return (
    <div
      className="scope"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) closeMenu();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="scope__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="scope__crumb">{tenant.name}</span>
        <span className="scope__sep" aria-hidden="true">
          ›
        </span>
        <span className="scope__current">{store ? store.name : "All stores"}</span>
        <svg
          className="scope__caret"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <ScopeMenu
          tenant={{ id: tenant.id, name: tenant.name }}
          activeStore={store}
          membership={context?.memberships?.find((m) => m.tenant_id === tenant.id)}
          onChooseStore={(storeId) => {
            if (storeId === store?.id) closeMenu();
            else void changeScope(() => switchStore(storeId));
          }}
          onAllStores={() => {
            if (!store) closeMenu();
            else void changeScope(clearStore);
          }}
        />
      ) : null}
      <output className="sr-only" aria-live="polite">
        {announcement}
      </output>
    </div>
  );
}
