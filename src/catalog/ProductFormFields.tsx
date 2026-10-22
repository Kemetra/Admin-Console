/**
 * RT-768 fields of the product edit form (CAT-C2a, RT-752 AC 3): name,
 * description, category, tax category, tenant availability, and the price as
 * read-only text. Controlled inputs: what is typed outlives every failure.
 *
 * Each field with an error is `aria-invalid` and `aria-describedby` its error
 * text. The inline error is NOT a live region: the form's error summary is what
 * announces a blocked submit, so the same words are not spoken twice.
 */
import { type MessageKey, useT } from "@/i18n";
import type { CatalogCategory, CatalogProductDetail } from "@/lib/catalog-queries";
import { TenantPrice } from "./CatalogDetailSections";
import {
  type ExtraCategoryOption,
  NO_CATEGORY,
  type ProductFormValues,
  extraCategoryOptions,
} from "./productFormLogic";
import "../components/inline-error.css";

export const FIELD_IDS = {
  name: "product-name",
  description: "product-description",
  categoryId: "product-category",
  taxCategory: "product-tax-category",
} as const;

const MARK_KEY: Record<"refused" | "retired", MessageKey> = {
  refused: "catalog.form.categoryUnavailableOption",
  retired: "catalog.form.categoryRetired",
};

type Errors = Partial<Record<keyof typeof FIELD_IDS, MessageKey>>;

function Field({
  id,
  label,
  required = false,
  hint,
  error,
  children,
}: Readonly<{
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: MessageKey;
  children: (aria: React.AriaAttributes) => React.ReactNode;
}>): React.JSX.Element {
  const t = useT();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? (
          <span className="field__required" aria-hidden="true">
            {" "}
            {t("catalog.form.required")}
          </span>
        ) : null}
      </label>
      {children({
        "aria-required": required ? true : undefined,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {hint ? (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="rtc-inline-error">
          {t(error)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * «بدون فئة», the tenant's categories, and the item's own category when the list
 * does not have it: a retired category is read-only to this form (the list omits
 * it), so it stays selectable as the current value and is marked retired. While
 * the list is still loading or could not be read, the name is shown unmarked
 * rather than claiming something that is not known.
 */
function CategoryOptions({
  categories,
  current,
  listKnown,
  refused,
}: Readonly<{
  categories: readonly CatalogCategory[];
  current: { id: string; name: string | null } | null;
  listKnown: boolean;
  /** A category the server refused: it stays selected, marked unavailable, until another is chosen. */
  refused: { id: string; name: string | null } | null;
}>): React.JSX.Element {
  const t = useT();
  const text = (option: ExtraCategoryOption): string =>
    option.mark === "plain" ? option.name : t(MARK_KEY[option.mark], { name: option.name });
  return (
    <>
      <option value={NO_CATEGORY}>{t("catalog.form.categoryNone")}</option>
      {extraCategoryOptions(categories, current, refused, listKnown).map((option) => (
        <option key={option.id} value={option.id}>
          {text(option)}
        </option>
      ))}
      {categories.map((c) => (
        <option key={c.categoryId} value={c.categoryId}>
          {c.name}
        </option>
      ))}
    </>
  );
}

export interface ProductFieldsProps {
  values: ProductFormValues;
  /** The errors to show now (inline); the form decides when each is visible. */
  errors: Errors;
  onChange: <K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) => void;
  categories: readonly CatalogCategory[];
  categoriesFailed: boolean;
  categoriesLoading: boolean;
  /** The category the server refused (422), if any. */
  refusedCategory: { id: string; name: string | null } | null;
  /** The product as loaded, for the current category and the read-only price. */
  product: CatalogProductDetail;
}

export function ProductFields({
  values,
  errors,
  onChange,
  categories,
  categoriesFailed,
  categoriesLoading,
  refusedCategory,
  product,
}: Readonly<ProductFieldsProps>): React.JSX.Element {
  const t = useT();
  const { summary } = product;
  const current = summary.categoryId
    ? { id: summary.categoryId, name: summary.categoryName }
    : null;
  return (
    <>
      <Field id={FIELD_IDS.name} label={t("catalog.form.name")} required error={errors.name}>
        {(aria) => (
          <input
            id={FIELD_IDS.name}
            className="input"
            dir="auto"
            value={values.name}
            onChange={(e) => onChange("name", e.target.value)}
            autoComplete="off"
            {...aria}
          />
        )}
      </Field>

      <Field
        id={FIELD_IDS.description}
        label={t("catalog.form.description")}
        error={errors.description}
      >
        {(aria) => (
          <textarea
            id={FIELD_IDS.description}
            className="input"
            dir="auto"
            rows={4}
            value={values.description}
            onChange={(e) => onChange("description", e.target.value)}
            {...aria}
          />
        )}
      </Field>

      <Field
        id={FIELD_IDS.categoryId}
        label={t("catalog.form.category")}
        hint={categoriesFailed ? t("catalog.form.categoriesFailed") : undefined}
        error={errors.categoryId}
      >
        {(aria) => (
          <select
            id={FIELD_IDS.categoryId}
            className="input"
            value={values.categoryId}
            onChange={(e) => onChange("categoryId", e.target.value)}
            {...aria}
          >
            <CategoryOptions
              categories={categories}
              current={current}
              listKnown={!categoriesLoading && !categoriesFailed}
              refused={refusedCategory}
            />
          </select>
        )}
      </Field>

      <Field
        id={FIELD_IDS.taxCategory}
        label={t("catalog.form.taxCategory")}
        required
        hint={t("catalog.form.taxCategoryHint")}
        error={errors.taxCategory}
      >
        {(aria) => (
          <input
            id={FIELD_IDS.taxCategory}
            className="input input--mono"
            dir="ltr"
            spellCheck={false}
            autoComplete="off"
            value={values.taxCategory}
            onChange={(e) => onChange("taxCategory", e.target.value)}
            {...aria}
          />
        )}
      </Field>

      <div className="field">
        <label className="catalog-form__check" htmlFor="product-available">
          <input
            id="product-available"
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => onChange("isActive", e.target.checked)}
            aria-describedby="product-available-hint"
          />
          {t("catalog.form.availability")}
        </label>
        <p id="product-available-hint" className="field__hint">
          {t("catalog.form.availabilityHint")}
        </p>
      </div>

      <dl className="surface__detail catalog-form__price">
        <div className="field-row">
          <dt className="field-row__label">{t("catalog.form.price")}</dt>
          <dd className="field-row__value">
            <TenantPrice price={summary.defaultPrice} />
            <span className="field__hint catalog-form__price-hint">
              {t("catalog.form.priceHint")}
            </span>
          </dd>
        </div>
      </dl>
    </>
  );
}
