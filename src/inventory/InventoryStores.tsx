/**
 * RT-728 — Inventory, store picker. The stores whose inventory the caller may
 * read: with an active store, only that store (the API binds a store-scoped
 * session to it); otherwise the caller's in-scope stores (the scope menu's own
 * rule, RT-354). Each row opens the store's movement ledger and locations.
 * Read-only; picking a store here is navigation, never a scope change.
 *
 * Gate first: a role outside the read roles gets NoAccess and nothing is
 * requested.
 */
import { NoAccess } from "@/auth/NoAccess";
import { Banner } from "@/components/Banner";
import { GatedButton } from "@/components/GatedButton";
import { ListState } from "@/components/ListState";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { useT } from "@/i18n";
import { type ScopeMembership, scopeMenuStores } from "@/shell/scope-stores";
import { useSignOut } from "@/shell/useSignOut";
import { useStoreList } from "@/stores/useStoreQueries";
import { Link } from "react-router";
import { canReadInventory } from "./inventoryLogic";
import { Machine } from "./parts";
import { type InventoryScope, useInventoryScope } from "./useInventory";
import "../shell/surface.css";
import "./inventory.css";

interface PickerStore {
  id: string;
  name?: string;
}

interface PickerState {
  stores: PickerStore[];
  isLoading: boolean;
  failed: boolean;
  retry: () => void;
}

type ActiveStore = { id?: string; name?: string } | null | undefined;

/** With an active store the API reads only that store: it is the one choice. */
function activeStoreChoice(active: ActiveStore, rows: readonly PickerStore[]): PickerStore[] {
  if (!active?.id) return [];
  const listed = rows.find((s) => s.id === active.id);
  return [{ id: active.id, name: listed?.name ?? active.name }];
}

/** The stores this caller may open, from the store list and the active context. */
function usePickerStores(scope: InventoryScope): PickerState {
  const { context } = useActiveContextValue();
  const { result, isLoading, refetch } = useStoreList(scope.tenantId);
  const rows = result?.kind === "rows" ? result.rows : [];
  const pinned = activeStoreChoice(context?.active_store, rows);
  if (pinned.length > 0) return { stores: pinned, isLoading: false, failed: false, retry: refetch };
  const membership = context?.memberships?.find((m) => m.tenant_id === scope.tenantId) as
    | ScopeMembership
    | undefined;
  return {
    stores: scopeMenuStores(rows, membership, null).map((s) => ({ id: s.id, name: s.name })),
    isLoading,
    failed: result?.kind === "error",
    retry: refetch,
  };
}

function StoresTable({ stores }: Readonly<{ stores: PickerStore[] }>): React.JSX.Element {
  const t = useT();
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="data-table__caption">{t("inventory.stores.caption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("inventory.stores.col.store")}</th>
          </tr>
        </thead>
        <tbody>
          {stores.map((store) => (
            <tr key={store.id} className="data-table__row data-table__row--static">
              <th scope="row">
                <Link to={`/inventory/stores/${store.id}`}>
                  {store.name ? <bdi dir="auto">{store.name}</bdi> : <Machine value={store.id} />}
                </Link>
              </th>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StoresBody({ picker }: Readonly<{ picker: PickerState }>): React.JSX.Element {
  const t = useT();
  if (picker.isLoading) {
    return <ListState state="loading" label={t("inventory.stores.loadingNoun")} />;
  }
  if (picker.failed) {
    return (
      <Banner
        variant="danger"
        message={t("inventory.stores.loadFailed")}
        action={
          <GatedButton type="button" className="btn-secondary" onClick={picker.retry}>
            {t("inventory.retry")}
          </GatedButton>
        }
      />
    );
  }
  if (picker.stores.length === 0) {
    return <ListState state="empty" emptyMessage={t("inventory.stores.empty")} />;
  }
  return <StoresTable stores={picker.stores} />;
}

function Content({ scope }: Readonly<{ scope: InventoryScope }>): React.JSX.Element {
  const t = useT();
  const picker = usePickerStores(scope);
  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("inventory.title")}</h1>
          <p className="content__sub">{t("inventory.stores.sub")}</p>
        </div>
      </header>
      <p className="inventory__note">{t("inventory.note.readOnly")}</p>
      <StoresBody picker={picker} />
    </div>
  );
}

export function InventoryStores(): React.JSX.Element {
  const t = useT();
  const scope = useInventoryScope();
  const signOut = useSignOut();
  if (!canReadInventory(scope.role)) return <NoAccess onSignOut={signOut} />;
  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("inventory.scopePrompt")}</p>
      </div>
    );
  }
  return <Content scope={scope} />;
}
