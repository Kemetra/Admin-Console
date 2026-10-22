/**
 * RT-768 product edit form (CAT-C2a, RT-752 AC 3, decisions D5 and D7). A full
 * page form on its own route, with the shared error summary.
 *
 * What it guarantees:
 *   - PATCH sends `expectedUpdatedAt` and only the fields that changed
 *     (`buildPatch`); a no-op edit submits nothing and says so.
 *   - Typed values outlive every failure. After a `stale_write`, Reload reads
 *     the item again: fields the person edited keep their value, every other
 *     field takes the fresh server value (`mergeReload`), and the precondition
 *     moves to the new `updatedAt`.
 *   - No premature errors: nothing is in error before the first submit. (Not on
 *     blur either: an error appearing as a field is left shifts the layout under
 *     the pointer and the click on Save is lost.) After a blocked submit the
 *     summary lists every error in field order, takes focus, and entries clear
 *     live as fields are fixed. Context errors (stale, retired, origin, 404, 429, 500) are a
 *     Banner above it, never an entry.
 *   - The form is a plain `<form>` in the content area, so the unsaved-work
 *     guard (RT-268) tracks it; a saved edit leaves with `SAVED_NAVIGATION`.
 */
import { Banner } from "@/components/Banner";
import { FormErrorSummary, useSummaryFocus } from "@/components/FormErrorSummary";
import { GatedButton } from "@/components/GatedButton";
import { type MessageKey, useT } from "@/i18n";
import type { CatalogProductDetail } from "@/lib/catalog-queries";
import { SAVED_NAVIGATION } from "@/shell/dirty-guard";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { FIELD_IDS, ProductFields } from "./ProductFormFields";
import {
  FIELD_ORDER,
  type ProductFieldErrors,
  type ProductFormValues,
  type ProductPatch,
  type ProductWriteRender,
  buildPatch,
  formValuesOf,
  mergeReload,
  validateProductForm,
} from "./productFormLogic";
import { catalogQueryKeys, useCatalogCategories } from "./useCatalog";
import { useUpdateProduct } from "./useProductWrites";
import "../shell/surface.css";
import "./catalog.css";

/** The one banner above the form: a failed write, or a state of the page. */
type Notice =
  | { kind: "render"; render: ProductWriteRender }
  | { kind: "info"; messageKey: MessageKey; requestId?: string };

const NOTICE_MESSAGE: Record<"stale" | "retired", MessageKey> = {
  stale: "catalog.write.error.stale",
  retired: "catalog.write.error.retired",
};

function NoticeBanner({
  notice,
  onReload,
  reloading,
}: Readonly<{
  notice: Notice;
  onReload: () => void;
  reloading: boolean;
}>): React.JSX.Element | null {
  const t = useT();
  if (notice.kind === "info") {
    return <Banner variant="info" message={t(notice.messageKey)} requestId={notice.requestId} />;
  }
  const { render } = notice;
  if (render.kind === "field") return null;
  if (render.kind === "banner") {
    return (
      <Banner
        variant={render.variant}
        message={t(render.messageKey)}
        requestId={render.requestId}
      />
    );
  }
  return (
    <Banner
      variant={render.kind === "stale" ? "warning" : "danger"}
      message={t(NOTICE_MESSAGE[render.kind])}
      requestId={render.requestId}
      action={
        render.kind === "stale" ? (
          <button type="button" className="btn-secondary" onClick={onReload} disabled={reloading}>
            {t("catalog.edit.reload")}
          </button>
        ) : undefined
      }
    />
  );
}

export interface ProductEditFormProps {
  product: CatalogProductDetail;
  tenantId: string;
  /** Read the item again; `undefined` when it could not be read. */
  reload: () => Promise<CatalogProductDetail | undefined>;
}

/** What the server last said the item is: the baseline every patch is measured against. */
interface Baseline {
  product: CatalogProductDetail;
  values: ProductFormValues;
  updatedAt: string;
}

function baselineOf(product: CatalogProductDetail): Baseline {
  return { product, values: formValuesOf(product), updatedAt: product.summary.updatedAt };
}

export function ProductEditForm({
  product,
  tenantId,
  reload,
}: Readonly<ProductEditFormProps>): React.JSX.Element {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { productId } = product.summary;
  const update = useUpdateProduct(tenantId, productId);
  const categories = useCatalogCategories(tenantId, true);
  const { ref: summaryRef, focusSummary } = useSummaryFocus();

  // Initialised once from the item as loaded; a re-read never re-derives it.
  const [base, setBase] = useState<Baseline>(() => baselineOf(product));
  const [values, setValues] = useState<ProductFormValues>(base.values);
  const [submitted, setSubmitted] = useState(false);
  // The category the server refused (422): kept visible and selected until another is chosen.
  const [categoryRefused, setCategoryRefused] = useState<{
    id: string;
    name: string | null;
  } | null>(null);
  const [notice, setNotice] = useState<Notice | undefined>();
  const [noChanges, setNoChanges] = useState(false);
  const [locked, setLocked] = useState(false);
  const [reloading, setReloading] = useState(false);
  // A failed re-read is said next to the conflict banner, which keeps its Reload to retry.
  const [reloadFailed, setReloadFailed] = useState(false);

  const errors: ProductFieldErrors = {
    ...validateProductForm(values),
    ...(categoryRefused ? { categoryId: "catalog.form.error.categoryUnavailable" as const } : {}),
  };
  // Nothing is in error until the first submit. There is no check on blur: an error that
  // appears as a field is left moves the layout under the pointer and swallows the click
  // on Save. After the first submit every error shows, and clears live as it is fixed.
  const shown: ProductFieldErrors = submitted ? errors : {};
  const entries = submitted
    ? FIELD_ORDER.flatMap((field) => {
        const key = errors[field];
        return key ? [{ fieldId: FIELD_IDS[field], message: t(key) }] : [];
      })
    : [];

  function change<K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]): void {
    setValues((v) => ({ ...v, [field]: value }));
    setNoChanges(false);
    if (field === "categoryId") setCategoryRefused(null);
  }

  async function onReload(): Promise<void> {
    setReloading(true);
    try {
      const fresh = await reload();
      if (!fresh) {
        setReloadFailed(true);
        return;
      }
      setReloadFailed(false);
      const freshBase = baselineOf(fresh);
      setValues((v) => mergeReload(base.values, v, freshBase.values));
      setBase(freshBase);
      if (fresh.summary.status === "retired") {
        setLocked(true);
        setNotice({ kind: "render", render: { kind: "retired" } });
      } else {
        setNotice({ kind: "info", messageKey: "catalog.edit.reloaded" });
      }
    } finally {
      setReloading(false);
    }
  }

  /** Where a failed write is shown: the category field, or a banner above the form. */
  function show(render: ProductWriteRender, patch: ProductPatch): void {
    if (render.kind === "field") {
      const id = patch.categoryId ?? values.categoryId;
      const name = categories.categories.find((c) => c.categoryId === id)?.name ?? null;
      setCategoryRefused({ id, name });
      setNotice(undefined);
      // The category list is what was out of date.
      void qc.invalidateQueries({ queryKey: catalogQueryKeys.categories(tenantId) });
      focusSummary();
      return;
    }
    if (render.kind === "retired") setLocked(true);
    setNotice({ kind: "render", render });
  }

  async function send(patch: ProductPatch): Promise<void> {
    try {
      const result = await update.mutateAsync({ expectedUpdatedAt: base.updatedAt, ...patch });
      if (result.ok) {
        navigate(`/catalog/products/${productId}`, { state: SAVED_NAVIGATION });
      } else {
        show(result.render, patch);
      }
    } catch {
      // A thrown request (offline, aborted) is still a visible failure, never silent.
      setNotice({
        kind: "render",
        render: { kind: "banner", variant: "danger", messageKey: "catalog.write.error.server" },
      });
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (update.isPending || locked) return;
    setNotice(undefined);
    setReloadFailed(false);
    setSubmitted(true);
    // A category the server already refused stands as an error until another is chosen:
    // sending the same id again would only be refused again.
    if (Object.keys(errors).length > 0) {
      focusSummary();
      return;
    }
    const patch = buildPatch(base.values, values);
    if (Object.keys(patch).length === 0) {
      setNoChanges(true);
      return;
    }
    void send(patch);
  }

  const detailPath = `/catalog/products/${productId}`;
  return (
    <>
      {notice ? (
        <NoticeBanner notice={notice} onReload={() => void onReload()} reloading={reloading} />
      ) : null}
      {reloadFailed ? <Banner variant="info" message={t("catalog.edit.reloadFailed")} /> : null}
      {noChanges ? <Banner variant="info" message={t("catalog.edit.noChanges")} /> : null}
      <form className="surface__form" onSubmit={onSubmit} noValidate>
        <FormErrorSummary ref={summaryRef} entries={entries} />
        <h2 className="surface__section-title">{t("catalog.edit.section")}</h2>
        <fieldset className="catalog-form__fields" disabled={locked}>
          <ProductFields
            values={values}
            errors={shown}
            onChange={change}
            categories={categories.categories}
            categoriesFailed={categories.failed}
            categoriesLoading={categories.isLoading}
            refusedCategory={categoryRefused}
            product={base.product}
          />
        </fieldset>
        <div className="surface__actions surface__actions--divided">
          <GatedButton type="submit" className="btn-primary" disabled={update.isPending || locked}>
            {update.isPending ? <span className="spinner" aria-hidden="true" /> : null}
            {t("catalog.edit.save")}
          </GatedButton>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(detailPath)}
            disabled={update.isPending}
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </>
  );
}
