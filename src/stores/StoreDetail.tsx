import { BackArrow } from "@/components/BackArrow";
import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import { useT } from "@/i18n";
/**
 * SF-S2 — Store detail (T027; RT-400 screen 19). Read-first field rows plus
 * the state badge and the store's time zone (RT-477), and «تعديل المتجر» in the header for everyone (no role
 * pre-hide, OQ-3; the server's 403 is the authority). 404 renders uniformly
 * (FR-004-008).
 *
 * There is no delete or closure action: permanent closure is a governed
 * workflow (Org & Store decision 194), not something this V1 surface offers.
 */
import { Link, useParams } from "react-router";
import { ScopePrompt } from "./ScopePrompt";
import { StoreStateBadge } from "./StoreStateBadge";
import { ZoneName } from "./ZoneName";
import { useStoreDetail } from "./useStoreQueries";
import "../shell/surface.css";

export function StoreDetail(): React.JSX.Element {
  const t = useT();
  const { storeId } = useParams();
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

  return (
    <div className="surface">
      <header className="surface__head">
        <h1 className="content__title">{store.name}</h1>
        <Link to={`/stores/${store.id}/edit`} className="btn-secondary">
          {t("stores.detail.edit")}
        </Link>
      </header>

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
            <StoreStateBadge isActive={store.is_active} />
          </dd>
        </div>
        <div className="field-row">
          <dt className="field-row__label">{t("stores.field.timezone")}</dt>
          <dd className="field-row__value">
            <ZoneName zone={store.timezone} />
          </dd>
        </div>
        <div className="field-row">
          <dt className="field-row__label">{t("stores.field.id")}</dt>
          <dd className="field-row__value field-row__value--mono">
            <bdi dir="ltr">{store.id}</bdi>
          </dd>
        </div>
      </dl>
    </div>
  );
}
