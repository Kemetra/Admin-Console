import { BackArrow } from "@/components/BackArrow";
import { Banner } from "@/components/Banner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { ListState } from "@/components/ListState";
import { useT } from "@/i18n";
import { type Rf2ErrorRender, mapRf2Error } from "@/lib/rf2-queries";
/**
 * SF-S2 — Store detail (T027). Read-first field rows + active-state badge; edit
 * and soft-delete rendered for all (no role pre-hide, OQ-3). 404 renders
 * uniformly (FR-004-008). Soft-delete (T029) is behind the shared inline
 * ConfirmDelete, then re-fetches the store list and routes back (S8). Reads the
 * active tenant from RF-1's provider only to scope the delete invalidation.
 */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ScopePrompt } from "./ScopePrompt";
import { useStoreDelete, useStoreDetail } from "./useStoreQueries";
import { useStoreScope } from "./useStoreScope";
import "../shell/surface.css";

export function StoreDetail(): React.JSX.Element {
  const t = useT();
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { activeTenantId } = useStoreScope();
  const { result, isLoading } = useStoreDetail(storeId);
  const del = useStoreDelete(activeTenantId);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<Rf2ErrorRender | undefined>();

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
        <Banner
          variant="danger"
          message={t(result.render.messageKey)}
          requestId={result.render.kind === "banner" ? result.render.requestId : undefined}
        />
        <Link to="/stores" className="surface__back">
          <BackArrow /> {t("stores.detail.back")}
        </Link>
      </div>
    );
  }

  const store = result?.kind === "store" ? result.store : undefined;
  if (!store) {
    return <div className="surface" />;
  }
  const storeIdLocal = store.id;

  async function onConfirmDelete(): Promise<void> {
    setDeleteError(undefined);
    const res = await del.mutateAsync(storeIdLocal);
    if (res.status >= 400) {
      setDeleteError(mapRf2Error({ ...res, context: "store" }));
      setConfirming(false);
      return;
    }
    navigate("/stores");
  }

  return (
    <div className="surface">
      <Link to="/stores" className="surface__back">
        <BackArrow /> {t("stores.detail.back")}
      </Link>
      <header className="surface__head">
        <h1 className="content__title">{store.name}</h1>
      </header>

      {deleteError && deleteError.kind === "banner" ? (
        <Banner
          variant="danger"
          message={t(deleteError.messageKey)}
          requestId={deleteError.requestId}
        />
      ) : null}

      <dl className="surface__detail">
        <div className="field-row">
          <dt className="field-row__label">{t("stores.field.code")}</dt>
          <dd className="field-row__value field-row__value--mono">
            <bdi dir="ltr">{store.code}</bdi>
          </dd>
        </div>
        <div className="field-row">
          <dt className="field-row__label">{t("stores.field.state")}</dt>
          <dd className="field-row__value">
            <span
              className={
                store.is_active === false ? "badge badge--suspended" : "badge badge--active"
              }
            >
              {t(store.is_active === false ? "stores.state.inactive" : "stores.state.active")}
            </span>
          </dd>
        </div>
        <div className="field-row">
          <dt className="field-row__label">{t("stores.field.id")}</dt>
          <dd className="field-row__value field-row__value--mono">
            <bdi dir="ltr">{store.id}</bdi>
          </dd>
        </div>
      </dl>

      {confirming ? (
        <ConfirmDelete
          resourceName={store.name}
          confirmLabel={t("stores.detail.softDelete")}
          pending={del.isPending}
          onConfirm={onConfirmDelete}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <div className="surface__actions">
          <Link to={`/stores/${store.id}/edit`} className="btn-secondary">
            {t("stores.detail.edit")}
          </Link>
          <button type="button" className="btn-destructive" onClick={() => setConfirming(true)}>
            {t("stores.detail.softDelete")}
          </button>
        </div>
      )}
    </div>
  );
}
