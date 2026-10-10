/**
 * RT-354 — which stores the scope menu offers.
 *
 * `GET /api/v1/stores` lists every live store in the active tenant; it is
 * intentionally not store-access-gated (Backend-Core `StoresService.list`).
 * The active membership on `GET /context/me` carries the server's own grant
 * list (`accessible_store_ids` when `store_access_kind` is `specific`), so the
 * menu narrows to it. This renders backend truth: `PUT /context/store`
 * re-checks access and 404s anything else, and nothing here branches on a role
 * or the platform-admin flag.
 */

export interface ScopeStore {
  id: string;
  name?: string;
}

export interface ScopeMembership {
  store_access_kind?: "all" | "specific";
  accessible_store_ids?: string[];
}

export function scopeMenuStores<S extends ScopeStore>(
  stores: readonly S[],
  membership: ScopeMembership | undefined,
  activeStore: { id?: string; name?: string } | null | undefined,
): Array<S | ScopeStore> {
  const listed: Array<S | ScopeStore> =
    membership?.store_access_kind === "specific"
      ? stores.filter((s) => membership.accessible_store_ids?.includes(s.id) ?? false)
      : [...stores];
  // The current scope is always visible, even before the list loads.
  if (activeStore?.id && !listed.some((s) => s.id === activeStore.id)) {
    listed.unshift({ id: activeStore.id, name: activeStore.name });
  }
  return listed;
}
