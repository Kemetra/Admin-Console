import { useActiveContextValue } from "@/context/ActiveContextProvider";
/**
 * Persistent gold scope header (SF-2, T028). DESIGN.md signature: the only
 * persistent gold surface besides the active nav marker. Always visible
 * in-context (rule 3). Click-to-switch opens the scope menu; selecting a tenant
 * or store drives the SF-3 mutators (which re-fetch — no optimistic update).
 */
import { useState } from "react";
import "./scope-header.css";

/** Non-color "current scope" cue (RT-267/UX-11); aria-current names it for AT. */
function ActiveCheck(): React.JSX.Element {
  return (
    <span className="scope-menu__check" aria-hidden="true">
      ✓
    </span>
  );
}

export function ScopeHeader(): React.JSX.Element | null {
  const { context, switchStore, clearStore } = useActiveContextValue();
  const [open, setOpen] = useState(false);

  const tenant = context?.active_tenant;
  const store = context?.active_store;
  if (!tenant) {
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
        <div className="scope-menu" role="menu">
          <div className="scope-menu__group">STORE · {tenant.name}</div>
          <button
            type="button"
            role="menuitem"
            className={`scope-menu__item${store ? "" : " scope-menu__item--active"}`}
            aria-current={store ? undefined : "true"}
            onClick={() => {
              void clearStore();
              setOpen(false);
            }}
          >
            All stores
            {store ? null : <ActiveCheck />}
          </button>
          {store?.id ? (
            <button
              type="button"
              role="menuitem"
              className="scope-menu__item scope-menu__item--active"
              aria-current="true"
              onClick={() => {
                void switchStore(store.id as string);
                setOpen(false);
              }}
            >
              {store.name}
              <ActiveCheck />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
