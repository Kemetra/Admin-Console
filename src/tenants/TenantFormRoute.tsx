import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { useT } from "@/i18n";
/**
 * Route wrapper for the tenant form (T018). Bridges the router (params) to the
 * presentational TenantForm: in edit mode it reads the tenant id from the path
 * and prefills from `readTenant`; in create mode it renders the empty form.
 * Keeps TenantForm free of routing concerns so it stays unit-testable.
 */
import { useParams } from "react-router";
import { TenantForm } from "./TenantForm";
import { useTenantDetail } from "./useTenantQueries";

export interface TenantFormRouteProps {
  mode: "create" | "edit";
}

export function TenantFormRoute({ mode }: TenantFormRouteProps): React.JSX.Element {
  const { tenantId } = useParams();

  if (mode === "create") {
    return <TenantForm mode="create" />;
  }

  return <EditTenantForm tenantId={tenantId} />;
}

function EditTenantForm({ tenantId }: { tenantId: string | undefined }): React.JSX.Element {
  const t = useT();
  const { result, isLoading } = useTenantDetail(tenantId);

  if (isLoading) {
    return (
      <div className="surface">
        <ListState state="loading" label={t("tenants.detail.loadingNoun")} />
      </div>
    );
  }
  if (result?.kind === "error") {
    return (
      <div className="surface">
        <Banner variant="danger" message={t(result.render.messageKey)} />
      </div>
    );
  }
  const tenant = result?.kind === "tenant" ? result.tenant : undefined;
  return (
    <TenantForm
      mode="edit"
      tenantId={tenantId}
      initial={tenant ? { slug: tenant.slug, name: tenant.name, status: tenant.status } : undefined}
    />
  );
}
