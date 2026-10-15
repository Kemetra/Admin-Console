import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { type T, useT } from "@/i18n";
import { useStoreList } from "@/stores/useStoreQueries";
/**
 * Persistent scope header (SF-2, T028): a recessed bar under the top bar,
 * always visible
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
  /** Escape inside the menu closes it back to its button (RT-268). */
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
}

function ScopeMenu({
  tenant,
  activeStore,
  membership,
  onChooseStore,
  onAllStores,
  onKeyDown,
}: Readonly<ScopeMenuProps>): React.JSX.Element {
  const t = useT();
  const { result, isLoading, refetch } = useStoreList(tenant.id);
  // The shell must survive a malformed list: anything but an array lists nothing.
  const rows = result?.kind === "rows" && Array.isArray(result.rows) ? result.rows : [];
  const stores: ScopeStore[] = scopeMenuStores(rows, membership, activeStore);

  return (
    <div className="scope-menu" role="menu" tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="scope-menu__group">
        {t.rich("shell.scope.menuGroup", { tenant: <bdi>{tenant.name}</bdi> })}
      </div>
      <button
        type="button"
        role="menuitem"
        className={`scope-menu__item${activeStore ? "" : " scope-menu__item--active"}`}
        aria-current={activeStore ? undefined : "true"}
        onClick={onAllStores}
      >
        {t("shell.scope.allStores")}
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
            <bdi>{s.name ?? s.id}</bdi>
            {active ? <ActiveCheck /> : null}
          </button>
        );
      })}
      {isLoading ? <div className="scope-menu__note">{t("shell.scope.loading")}</div> : null}
      {result?.kind === "error" ? (
        <>
          <div className="scope-menu__note">{t("shell.scope.loadFailed")}</div>
          <button type="button" role="menuitem" className="scope-menu__item" onClick={refetch}>
            {t("common.tryAgain")}
          </button>
        </>
      ) : null}
      {result?.kind === "rows" && stores.length === 0 ? (
        <div className="scope-menu__note">{t("shell.scope.noStores")}</div>
      ) : null}
    </div>
  );
}

interface ScopeNames {
  tenant: string;
  /** The active store's name, or null for "All stores". */
  store: string | null;
}

/**
 * Polite announcement of a scope change for screen-reader users (RT-268). The
 * announced scope is kept, not the sentence, so it is spoken in the current
 * locale (RT-399).
 */
function useScopeAnnouncement(scopeKey: string, names: ScopeNames, t: T): string {
  const [announced, setAnnounced] = useState<ScopeNames | null>(null);
  const previous = useRef(scopeKey);
  const { tenant, store } = names;
  useEffect(() => {
    if (previous.current === scopeKey) return;
    previous.current = scopeKey;
    setAnnounced({ tenant, store });
  }, [scopeKey, tenant, store]);
  if (!announced) return "";
  return t("shell.scope.announce", {
    tenant: announced.tenant,
    store: announced.store ?? t("shell.scope.allStores"),
  });
}

export function ScopeHeader(): React.JSX.Element | null {
  const t = useT();
  const { context, switchStore, clearStore } = useActiveContextValue();
  const guard = useDirtyGuard();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const tenant = context?.active_tenant;
  const store = context?.active_store;
  const announcement = useScopeAnnouncement(
    `${tenant?.id ?? ""}/${store?.id ?? "all"}`,
    { tenant: tenant?.name ?? "", store: store ? (store.name ?? "") : null },
    t,
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

  // Escape closes the open menu from the trigger or from inside the menu.
  const closeOnEscape = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && open) closeMenu();
  };

  return (
    <div className="scope">
      <button
        ref={buttonRef}
        type="button"
        className="scope__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={closeOnEscape}
      >
        {/* Names are isolated so a Latin-only name can't turn the Bidi_Mirrored
            separator: › reads ‹ in Arabic with no code change (RT-266 §2.1). */}
        <span className="scope__crumb">
          <bdi>{tenant.name}</bdi>
        </span>
        <span className="scope__sep" aria-hidden="true">
          ›
        </span>
        <span className="scope__current">
          {store ? <bdi>{store.name}</bdi> : t("shell.scope.allStores")}
        </span>
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
          onKeyDown={closeOnEscape}
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
