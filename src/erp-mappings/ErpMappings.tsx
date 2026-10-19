/**
 * RT-725 — ERPNext item and warehouse mappings, for owner / tenant_admin, under
 * the ERP connection area (`/erp-connection/mappings`, spec 016). Two panels
 * over Backend-Core only: item mappings (review queue, confirm, retire, and a
 * replacement suggestion for a product just retired) and warehouse mappings
 * (set, retire).
 *
 * Gate first: any other role gets the existing NoAccess state and nothing is
 * requested. The server stays the authority (a wrong role is its 404); the gate
 * mirrors its roles. Nothing here reaches ERPNext: a mapping records a reference
 * in Retail Tower, and the Connector resolves it at posting time.
 */
import { NoAccess } from "@/auth/NoAccess";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { useErpScope } from "@/erp-status/useErpStatus";
import { useT } from "@/i18n";
import { type ScopeMembership, scopeMenuStores } from "@/shell/scope-stores";
import { useSignOut } from "@/shell/useSignOut";
import { useStoreList } from "@/stores/useStoreQueries";
import { Link } from "react-router";
import { ItemMappings } from "./ItemMappings";
import { type StoreOptions, WarehouseMappings } from "./WarehouseMappings";
import { canManageMappings } from "./mappingLogic";
import "../shell/surface.css";
import "../erp-status/erp-status.css";
import "./erp-mappings.css";

/** The caller's in-scope stores (the scope menu's own rule, RT-354), and whether they loaded. */
function useMappingStores(tenantId: string): StoreOptions {
  const { context } = useActiveContextValue();
  const { result, isLoading } = useStoreList(tenantId);
  const rows = result?.kind === "rows" ? result.rows : [];
  const membership = context?.memberships?.find((m) => m.tenant_id === tenantId) as
    | ScopeMembership
    | undefined;
  return {
    stores: scopeMenuStores(rows, membership, null).map((s) => ({ id: s.id, name: s.name })),
    loading: isLoading,
    // A thrown read leaves no result at all: unloaded is failed, never "no stores".
    failed: !isLoading && result?.kind !== "rows",
  };
}

function MappingsContent({
  tenantId,
  tenantName,
}: Readonly<{ tenantId: string; tenantName: string | null }>): React.JSX.Element {
  const t = useT();
  const stores = useMappingStores(tenantId);
  return (
    <div className="surface erp-surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("erp.map.title")}</h1>
          <p className="content__sub">
            {t.rich("erp.map.sub", { tenant: <bdi>{tenantName ?? ""}</bdi> })}
          </p>
        </div>
        <Link className="btn-secondary" to="/erp-connection">
          {t("erp.map.back")}
        </Link>
      </header>
      <ItemMappings tenantId={tenantId} />
      <WarehouseMappings tenantId={tenantId} options={stores} />
    </div>
  );
}

export function ErpMappings(): React.JSX.Element {
  const t = useT();
  const scope = useErpScope();
  const signOut = useSignOut();
  if (!canManageMappings(scope.role)) return <NoAccess onSignOut={signOut} />;
  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("erp.map.scopePrompt")}</p>
      </div>
    );
  }
  return (
    <MappingsContent key={scope.tenantId} tenantId={scope.tenantId} tenantName={scope.tenantName} />
  );
}
