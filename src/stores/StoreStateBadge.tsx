import { useT } from "@/i18n";

/**
 * The store's V1 `is_active` state as a status badge: «نشط» / «موقوف». A
 * missing flag reads as active, matching the backend default. This is not a
 * lifecycle state (decisions 188/194).
 */
export function StoreStateBadge({ isActive }: Readonly<{ isActive?: boolean }>): React.JSX.Element {
  const t = useT();
  const inactive = isActive === false;
  return (
    <span className={inactive ? "badge badge--suspended" : "badge badge--active"}>
      {t(inactive ? "stores.state.inactive" : "stores.state.active")}
    </span>
  );
}
