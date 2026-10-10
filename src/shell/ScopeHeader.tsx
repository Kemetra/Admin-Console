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
 */
import { useState } from "react";
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

export function ScopeHeader(): React.JSX.Element | null {
  const { context, switchStore, clearStore } = useActiveContextValue();
  const [open, setOpen] = useState(false);

  const tenant = context?.active_tenant;
  const store = context?.active_store;
  if (!tenant?.id) {
    return null; // no header until a tenant is resolved (chooser handles that)
  }

  return (
    <div className="scope">
      <button
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
            if (storeId !== store?.id) void switchStore(storeId);
            setOpen(false);
          }}
          onAllStores={() => {
            void clearStore();
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
