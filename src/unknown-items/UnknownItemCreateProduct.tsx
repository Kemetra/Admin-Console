import { Banner } from "@/components/Banner";
import { GatedButton } from "@/components/GatedButton";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import type {
  CreateProductFromUnknownItemRequest,
  ReviewQueueItem,
} from "@/lib/unknown-items-queries";
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
import { type UnknownItemWriteResult, useUnknownItemCreateProduct } from "./useUnknownItemQueries";

export interface UnknownItemCreateProductProps {
  item: ReviewQueueItem;
  activeTenantId: string | null;
  onCreated: () => void;
  onCancel: () => void;
}

/** One labelled text input with an optional hint and its inline error. */
function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  error,
  machine = false,
  required = false,
}: Readonly<{
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  error?: MessageKey;
  /** A code rather than words: isolated LTR. */
  machine?: boolean;
  /** Announced to assistive technology; the form still validates itself (noValidate). */
  required?: boolean;
}>): React.JSX.Element {
  const t = useT();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        dir={machine ? "ltr" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required ? "true" : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy || undefined}
        autoComplete="off"
      />
      {hint ? (
        <span id={`${id}-hint`} className="field__hint">
          {hint}
        </span>
      ) : null}
      <span id={`${id}-error`}>
        <InlineError message={error ? t(error) : undefined} />
      </span>
    </div>
  );
}

/**
 * The failure of the last attempt, if any: the mapped contract error, or the
 * generic copy when the request itself never completed.
 */
function WriteError({
  result,
  requestFailed,
}: Readonly<{
  result: UnknownItemWriteResult<unknown> | undefined;
  requestFailed: boolean;
}>): React.JSX.Element | null {
  const t = useT();
  if (requestFailed) return <Banner variant="danger" message={t("errors.server")} />;
  return result && !result.ok ? <UnknownItemErrorBanner error={result.render} /> : null;
}

interface FieldErrors {
  name?: MessageKey;
  taxCategory?: MessageKey;
}

/** Both fields are required non-empty after trim; undefined when the body may be sent. */
function requiredFieldErrors(body: CreateProductFromUnknownItemRequest): FieldErrors | undefined {
  if (body.name && body.tax_category) return undefined;
  return {
    name: body.name ? undefined : "unknownItems.create.nameRequired",
    taxCategory: body.tax_category ? undefined : "unknownItems.create.taxCategoryRequired",
  };
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>();

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const body = { name: name.trim(), tax_category: taxCategory.trim() };
    const errors = requiredFieldErrors(body);
    setFieldErrors(errors);
    if (errors) return; // client guard: nothing sent
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
        <WriteError result={create.data} requestFailed={create.isError} />

        <TextField
          id="unknown-item-product-name"
          label={t("unknownItems.create.name")}
          value={name}
          onChange={setName}
          error={fieldErrors?.name}
          required
        />
        <TextField
          id="unknown-item-tax-category"
          label={t("unknownItems.create.taxCategory")}
          hint={t("unknownItems.create.taxCategoryHint")}
          value={taxCategory}
          onChange={setTaxCategory}
          error={fieldErrors?.taxCategory}
          machine
          required
        />

        <div className="unknown-item-detail__actions">
          <GatedButton type="submit" className="btn-primary">
            {create.isPending ? <span className="spinner" aria-hidden="true" /> : null}
            {t("unknownItems.create.submit")}
          </GatedButton>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
