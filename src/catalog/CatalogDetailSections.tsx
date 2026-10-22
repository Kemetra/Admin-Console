/**
 * RT-766 detail sections (CAT-C1b, RT-752 AC 2): the tenant's values, the
 * item's identifiers and each store's override. Read-only text throughout: the
 * price is a value, not a disabled input. Overrides are the store's raw
 * deviations beside the labelled tenant value; nothing here computes what a
 * store resolves (RT-752 D8). Codes are isolated LTR and kept as stored
 * (`white-space: pre-wrap`, so leading zeros and inner spaces survive).
 */
import { DateTime, Money, type T, useT } from "@/i18n";
import type { CatalogIdentifier, CatalogMoney, CatalogProductDetail } from "@/lib/catalog-queries";
import {
  type Deviation,
  deviationFieldKey,
  identifierKey,
  identifierTypeKey,
  storeDeviations,
  tenantAvailable,
} from "./catalogDetailLogic";
import { availabilityKey, statusKey, trackingKey } from "./catalogLogic";
import type { StoreLabel } from "./useCatalogProduct";

/** A machine value (identifier, tax category, id): LTR-isolated, exactly as stored. */
function Code({ value }: Readonly<{ value: string }>): React.JSX.Element {
  return (
    <bdi dir="ltr" className="catalog-code">
      {value}
    </bdi>
  );
}

function Section({
  id,
  title,
  children,
}: Readonly<{ id: string; title: string; children: React.ReactNode }>): React.JSX.Element {
  return (
    <section className="catalog-detail__section" aria-labelledby={id}>
      <h2 id={id} className="surface__section-title">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="field-row">
      <dt className="field-row__label">{label}</dt>
      <dd className="field-row__value">{children}</dd>
    </div>
  );
}

/** The tenant default price as read-only text; no price says the POS will not sell the item. */
export function TenantPrice({
  price,
}: Readonly<{ price: CatalogMoney | null }>): React.JSX.Element {
  const t = useT();
  if (!price) return <>{t("catalog.detail.noPriceNotice")}</>;
  return <Money value={price.amount} currency={price.currencyCode} />;
}

export function TenantValues({
  product,
}: Readonly<{ product: CatalogProductDetail }>): React.JSX.Element {
  const t = useT();
  const { summary } = product;
  return (
    <Section id="catalog-detail-tenant" title={t("catalog.detail.tenant.title")}>
      <dl className="surface__detail">
        <Row label={t("catalog.detail.field.status")}>
          <span className="badge">{t(statusKey(summary.status))}</span>
        </Row>
        <Row label={t("catalog.detail.field.description")}>
          {product.description ? (
            <bdi dir="auto" className="catalog-description">
              {product.description}
            </bdi>
          ) : (
            t("catalog.detail.value.noDescription")
          )}
        </Row>
        <Row label={t("catalog.detail.field.category")}>
          {summary.categoryName ? (
            <bdi dir="auto">{summary.categoryName}</bdi>
          ) : (
            t("catalog.value.noCategory")
          )}
        </Row>
        <Row label={t("catalog.detail.field.taxCategory")}>
          <Code value={summary.taxCategory} />
        </Row>
        <Row label={t("catalog.detail.field.tenantAvailability")}>
          {t(availabilityKey(tenantAvailable(summary)))}
        </Row>
        <Row label={t("catalog.detail.field.tracking")}>{t(trackingKey(summary.trackingMode))}</Row>
        <Row label={t("catalog.detail.field.price")}>
          <TenantPrice price={summary.defaultPrice} />
        </Row>
        <Row label={t("catalog.detail.field.updatedAt")}>
          <DateTime value={summary.updatedAt} />
        </Row>
      </dl>
    </Section>
  );
}

/** A store as a label: its name when known, else its id, isolated LTR. */
function StoreName({ label }: Readonly<{ label: StoreLabel }>): React.JSX.Element {
  return label.name ? <bdi dir="auto">{label.name}</bdi> : <Code value={label.id} />;
}

function IdentifierRow({
  identifier,
  storeLabel,
}: Readonly<{
  identifier: CatalogIdentifier;
  storeLabel: (id: string) => StoreLabel;
}>): React.JSX.Element {
  const t = useT();
  return (
    <tr>
      <td>{t(identifierTypeKey(identifier.identifierType))}</td>
      <td>
        <Code value={identifier.value} />
      </td>
      <td>
        {identifier.storeId ? (
          <StoreName label={storeLabel(identifier.storeId)} />
        ) : (
          t("catalog.detail.identifiers.scopeAll")
        )}
      </td>
      <td>{identifier.sourceSystem ? <Code value={identifier.sourceSystem} /> : "—"}</td>
    </tr>
  );
}

export function Identifiers({
  identifiers,
  storeLabel,
}: Readonly<{
  identifiers: readonly CatalogIdentifier[];
  storeLabel: (id: string) => StoreLabel;
}>): React.JSX.Element {
  const t = useT();
  return (
    <Section id="catalog-detail-identifiers" title={t("catalog.detail.identifiers.title")}>
      {identifiers.length === 0 ? (
        <p className="catalog-detail__empty">{t("catalog.detail.identifiers.empty")}</p>
      ) : (
        <table className="data-table catalog-readonly">
          <caption className="data-table__caption">
            {t("catalog.detail.identifiers.caption")}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t("catalog.detail.identifiers.col.type")}</th>
              <th scope="col">{t("catalog.detail.identifiers.col.value")}</th>
              <th scope="col">{t("catalog.detail.identifiers.col.scope")}</th>
              <th scope="col">{t("catalog.detail.identifiers.col.source")}</th>
            </tr>
          </thead>
          <tbody>
            {identifiers.map((identifier) => (
              <IdentifierRow
                key={identifierKey(identifier)}
                identifier={identifier}
                storeLabel={storeLabel}
              />
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function DeviationValue({
  deviation,
  side,
}: Readonly<{ deviation: Deviation; side: "override" | "tenant" }>): React.JSX.Element {
  const t = useT();
  switch (deviation.field) {
    case "availability":
      return <>{t(availabilityKey(deviation[side]))}</>;
    case "taxCategory":
      return <Code value={deviation[side]} />;
    case "price": {
      const money = deviation[side];
      if (!money) return <>{t("catalog.value.noPrice")}</>;
      return <Money value={money.amount} currency={money.currencyCode} />;
    }
  }
}

function DeviationRow({
  deviation,
  t,
}: Readonly<{ deviation: Deviation; t: T }>): React.JSX.Element {
  return (
    <tr>
      <td>{t(deviationFieldKey(deviation.field))}</td>
      <td>
        <DeviationValue deviation={deviation} side="override" />
      </td>
      <td>
        <DeviationValue deviation={deviation} side="tenant" />
      </td>
    </tr>
  );
}

function StoreOverride({
  deviations,
  label,
}: Readonly<{ deviations: Deviation[]; label: StoreLabel }>): React.JSX.Element {
  const t = useT();
  return (
    <div className="catalog-detail__store">
      <h3 className="catalog-detail__store-name">
        <StoreName label={label} />
      </h3>
      {deviations.length === 0 ? (
        <p className="catalog-detail__empty">{t("catalog.detail.overrides.noValues")}</p>
      ) : (
        <table className="data-table catalog-readonly">
          <caption className="data-table__caption">
            {t("catalog.detail.overrides.caption", { store: label.name ?? label.id })}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t("catalog.detail.overrides.col.setting")}</th>
              <th scope="col">{t("catalog.detail.overrides.col.store")}</th>
              <th scope="col">{t("catalog.detail.overrides.col.tenant")}</th>
            </tr>
          </thead>
          <tbody>
            {deviations.map((deviation) => (
              <DeviationRow key={deviation.field} deviation={deviation} t={t} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function StoreOverrides({
  product,
  storeLabel,
}: Readonly<{
  product: CatalogProductDetail;
  storeLabel: (id: string) => StoreLabel;
}>): React.JSX.Element {
  const t = useT();
  const stores = storeDeviations(product.storeOverrides, product.summary);
  return (
    <Section id="catalog-detail-overrides" title={t("catalog.detail.overrides.title")}>
      <p className="catalog-detail__note">{t("catalog.detail.overrides.sub")}</p>
      {stores.length === 0 ? (
        <p className="catalog-detail__empty">{t("catalog.detail.overrides.empty")}</p>
      ) : (
        stores.map((store) => (
          <StoreOverride
            key={store.storeId}
            deviations={store.deviations}
            label={storeLabel(store.storeId)}
          />
        ))
      )}
    </Section>
  );
}
