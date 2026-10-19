import { Banner } from "@/components/Banner";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import type { ReviewQueueItem } from "@/lib/unknown-items-queries";
/**
 * RT-724 (RF-4b) — create a tenant product from a pending unknown item. An
 * inline form in the inspect drawer: product name + tax category, both
 * required by the contract. `category_id` is optional and has no picker (there
 * is no console catalog read contract), so the product is created
 * uncategorized rather than asking for a raw id.
 *
 * The inputs are controlled and outlive any failure: a 400, a 409
 * `alias_conflict` (the identifier is bound to another product, which is never
 * named) or a dropped request leaves what the operator typed in place. Success
 * is surfaced by the parent (the queue refreshes and the drawer closes).
 */
import { useState } from "react";
import { UnknownItemErrorBanner } from "./UnknownItemErrorBanner";
import { useUnknownItemCreateProduct } from "./useUnknownItemQueries";

export interface UnknownItemCreateProductProps {
  item: ReviewQueueItem;
  activeTenantId: string | null;
  onCreated: () => void;
  onCancel: () => void;
}

interface FieldErrors {
  name?: MessageKey;
  taxCategory?: MessageKey;
}

export function UnknownItemCreateProduct({
  item,
  activeTenantId,
  onCreated,
  onCancel,
}: Readonly<UnknownItemCreateProductProps>): React.JSX.Element {
  const t = useT();
  const create = useUnknownItemCreateProduct(activeTenantId);
  const [name, setName] = useState("");
  const [taxCategory, setTaxCategory] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const result = create.data;
  const error = result && !result.ok ? result.render : undefined;

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const body = { name: name.trim(), tax_category: taxCategory.trim() };
    const errors: FieldErrors = {
      name: body.name ? undefined : "unknownItems.create.nameRequired",
      taxCategory: body.tax_category ? undefined : "unknownItems.create.taxCategoryRequired",
    };
    setFieldErrors(errors);
    if (errors.name || errors.taxCategory) return; // client guard: nothing sent
    create.mutate(
      { id: item.id, body },
      {
        onSuccess: (res) => {
          if (res.ok) onCreated();
        },
      },
    );
  }

  return (
    <form className="unknown-item-form" onSubmit={onSubmit} noValidate>
      <fieldset className="unknown-item-form__fields" disabled={create.isPending}>
        <legend className="unknown-item-form__legend">{t("unknownItems.create.legend")}</legend>
        {error ? <UnknownItemErrorBanner error={error} /> : null}
        {create.isError ? <Banner variant="danger" message={t("errors.server")} /> : null}

        <div className="field">
          <label htmlFor="unknown-item-product-name">{t("unknownItems.create.name")}</label>
          <input
            id="unknown-item-product-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={fieldErrors.name ? "true" : undefined}
            aria-describedby={fieldErrors.name ? "unknown-item-product-name-error" : undefined}
            autoComplete="off"
          />
          <span id="unknown-item-product-name-error">
            <InlineError message={fieldErrors.name ? t(fieldErrors.name) : undefined} />
          </span>
        </div>

        <div className="field">
          <label htmlFor="unknown-item-tax-category">{t("unknownItems.create.taxCategory")}</label>
          <input
            id="unknown-item-tax-category"
            className="input"
            dir="ltr"
            value={taxCategory}
            onChange={(e) => setTaxCategory(e.target.value)}
            aria-invalid={fieldErrors.taxCategory ? "true" : undefined}
            aria-describedby="unknown-item-tax-category-hint unknown-item-tax-category-error"
            autoComplete="off"
          />
          <span id="unknown-item-tax-category-hint" className="field__hint">
            {t("unknownItems.create.taxCategoryHint")}
          </span>
          <span id="unknown-item-tax-category-error">
            <InlineError
              message={fieldErrors.taxCategory ? t(fieldErrors.taxCategory) : undefined}
            />
          </span>
        </div>

        <div className="unknown-item-detail__actions">
          <button type="submit" className="btn-primary">
            {create.isPending ? <span className="spinner" aria-hidden="true" /> : null}
            {t("unknownItems.create.submit")}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
