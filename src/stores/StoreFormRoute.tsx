import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { useT } from "@/i18n";
/**
 * Route wrapper for the store form (T028). Bridges the router (params) to the
 * presentational StoreForm: edit mode reads the store id and prefills from
 * `readStore`; create mode renders the empty form. The StoreForm itself owns the
 * active-tenant pre-gate (OQ-4), so this wrapper stays thin.
 */
import { useParams } from "react-router";
import { ScopePrompt } from "./ScopePrompt";
import { StoreForm } from "./StoreForm";
import { useStoreDetail } from "./useStoreQueries";

export interface StoreFormRouteProps {
  mode: "create" | "edit";
}

export function StoreFormRoute({ mode }: StoreFormRouteProps): React.JSX.Element {
  const { storeId } = useParams();

  if (mode === "create") {
    return <StoreForm mode="create" />;
  }
  return <EditStoreForm storeId={storeId} />;
}

function EditStoreForm({ storeId }: { storeId: string | undefined }): React.JSX.Element {
  const t = useT();
  const { result, isLoading } = useStoreDetail(storeId);

  if (isLoading) {
    return (
      <div className="surface">
        <ListState state="loading" label={t("stores.detail.loadingNoun")} />
      </div>
    );
  }
  if (result?.kind === "error") {
    if (result.render.kind === "scope-required") {
      return <ScopePrompt />;
    }
    return (
      <div className="surface">
        <Banner variant="danger" message={t(result.render.messageKey)} />
      </div>
    );
  }
  const store = result?.kind === "store" ? result.store : undefined;
  return (
    <StoreForm
      mode="edit"
      storeId={storeId}
      initial={
        store ? { code: store.code, name: store.name, is_active: store.is_active } : undefined
      }
    />
  );
}
