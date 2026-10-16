/**
 * RT-560 store filter (spec 016 §4.5): the optional `store_id` on the three C3
 * reads, limited to the caller's in-scope stores. A filter, not a scope change:
 * it never touches the active store. A store id in the URL that the roster does
 * not list stays selectable as itself so the 404 it earns is visible.
 */
import { useT } from "@/i18n";

export interface FilterStore {
  id: string;
  name?: string;
}

export interface StoreFilterProps {
  stores: readonly FilterStore[];
  /** The selected store id, or "" for all stores. */
  value: string;
  onChange: (storeId: string) => void;
}

export function StoreFilter({
  stores,
  value,
  onChange,
}: Readonly<StoreFilterProps>): React.JSX.Element {
  const t = useT();
  const listed = value && !stores.some((s) => s.id === value) ? [...stores, { id: value }] : stores;
  return (
    <div className="erp-filter">
      <div className="erp-filter__field">
        <label htmlFor="erp-store-filter">{t("erp.filter.store")}</label>
        <select
          id="erp-store-filter"
          className="input"
          aria-describedby="erp-store-filter-note"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{t("erp.filter.allStores")}</option>
          {listed.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name ?? store.id}
            </option>
          ))}
        </select>
      </div>
      <p className="erp-filter__note" id="erp-store-filter-note">
        {t("erp.filter.note")}
      </p>
    </div>
  );
}
