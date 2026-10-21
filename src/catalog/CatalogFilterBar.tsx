/**
 * RT-765 catalog filter form (CAT-C1a, RT-752 AC 4). Search text, status
 * (default «نشط») and category. Nothing is read until Search applies the form to
 * the URL. The store is not a filter here: it comes from the scope header. The
 * search text is sent exactly as typed (no trim): an exact barcode, SKU or
 * quick-sale code keeps its leading zeros and every space, so a pasted trailing
 * space is a miss, not something silently fixed.
 */
import { GatedButton } from "@/components/GatedButton";
import { InlineError } from "@/components/InlineError";
import { type MessageKey, useT } from "@/i18n";
import type { CatalogCategory } from "@/lib/catalog-queries";
import { useState } from "react";
import {
  type CatalogFilters,
  type FilterErrors,
  MAX_QUERY_LENGTH,
  STATUS_FILTERS,
  defaultFilters,
  statusFilterKey,
  validateFilters,
} from "./catalogLogic";
import "./catalog.css";

export interface CatalogFilterBarProps {
  applied: CatalogFilters;
  categories: readonly CatalogCategory[];
  categoriesLoading: boolean;
  categoriesFailed: boolean;
  /** Errors already present in the applied filters (a hand-edited URL). */
  initialErrors: FilterErrors;
  onApply: (filters: CatalogFilters) => void;
  onClear: () => void;
}

function Field({
  id,
  label,
  error,
  note,
  children,
}: Readonly<{
  id: string;
  label: string;
  error?: MessageKey;
  note?: string;
  children: React.ReactNode;
}>): React.JSX.Element {
  const t = useT();
  return (
    <div className="catalog-filters__field">
      <label htmlFor={id}>{label}</label>
      {children}
      {note ? (
        <small id={`${id}-note`} className="catalog-filters__note">
          {note}
        </small>
      ) : null}
      <InlineError message={error ? t(error) : undefined} />
    </div>
  );
}

/** A category the list does not carry: "Unavailable" only once the list is known. */
function missingLabelKey(loading: boolean, failed: boolean): MessageKey {
  if (loading) return "catalog.filter.categoryLoading";
  return failed ? "catalog.filter.categorySelected" : "catalog.filter.categoryStale";
}

/** The category options, plus the applied one when the list does not carry it (a retired category). */
function CategoryOptions({
  categories,
  appliedId,
  loading,
  failed,
}: Readonly<{
  categories: readonly CatalogCategory[];
  appliedId: string;
  loading: boolean;
  failed: boolean;
}>): React.JSX.Element {
  const t = useT();
  const known = categories.some((c) => c.categoryId.toLowerCase() === appliedId);
  const missing = appliedId !== "" && !known;
  return (
    <>
      <option value="">{t("catalog.filter.categoryAll")}</option>
      {categories.map((c) => (
        <option key={c.categoryId} value={c.categoryId.toLowerCase()}>
          {c.name}
        </option>
      ))}
      {missing ? <option value={appliedId}>{t(missingLabelKey(loading, failed))}</option> : null}
    </>
  );
}

export function CatalogFilterBar({
  applied,
  categories,
  categoriesLoading,
  categoriesFailed,
  initialErrors,
  onApply,
  onClear,
}: Readonly<CatalogFilterBarProps>): React.JSX.Element {
  const t = useT();
  const [draft, setDraft] = useState<CatalogFilters>(applied);
  const [errors, setErrors] = useState<FilterErrors>(initialErrors);

  // The URL is the source of truth: when the applied filters change from outside
  // (Back, a deep link, a tenant change) the draft follows. The form stays
  // mounted, so keyboard focus survives a Search.
  const appliedKey = JSON.stringify(applied);
  const [syncedKey, setSyncedKey] = useState(appliedKey);
  if (syncedKey !== appliedKey) {
    setSyncedKey(appliedKey);
    setDraft(applied);
    setErrors(initialErrors);
  }

  const set =
    <K extends keyof CatalogFilters>(key: K) =>
    (value: CatalogFilters[K]) =>
      setDraft((current) => ({ ...current, [key]: value }));

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const found = validateFilters(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onApply(draft);
  }

  function clear(): void {
    setDraft(defaultFilters());
    setErrors({});
    onClear();
  }

  return (
    <form
      className="catalog-filters"
      aria-label={t("catalog.filter.label")}
      // Filters are not unsaved work: no Stay / Discard prompt for them (RT-268).
      data-dirty-guard="off"
      onSubmit={submit}
      noValidate
    >
      <Field
        id="cf-q"
        label={t("catalog.filter.q")}
        error={errors.q}
        note={t("catalog.filter.qNote")}
      >
        <input
          id="cf-q"
          className="input"
          dir="auto"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={MAX_QUERY_LENGTH}
          aria-describedby="cf-q-note"
          aria-invalid={errors.q ? true : undefined}
          value={draft.q}
          onChange={(e) => set("q")(e.target.value)}
        />
      </Field>
      <Field id="cf-status" label={t("catalog.filter.status")}>
        <select
          id="cf-status"
          className="input"
          value={draft.status}
          onChange={(e) => set("status")(e.target.value as CatalogFilters["status"])}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {t(statusFilterKey(s))}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id="cf-category"
        label={t("catalog.filter.category")}
        error={errors.category}
        note={categoriesFailed ? t("catalog.filter.categoriesFailed") : undefined}
      >
        <select
          id="cf-category"
          className="input"
          aria-invalid={errors.category ? true : undefined}
          aria-describedby={categoriesFailed ? "cf-category-note" : undefined}
          value={draft.categoryId}
          onChange={(e) => set("categoryId")(e.target.value)}
        >
          <CategoryOptions
            categories={categories}
            appliedId={draft.categoryId}
            loading={categoriesLoading}
            failed={categoriesFailed}
          />
        </select>
      </Field>
      <div className="catalog-filters__actions">
        <GatedButton type="submit" className="btn-primary">
          {t("catalog.filter.apply")}
        </GatedButton>
        <button type="button" className="btn-ghost" onClick={clear}>
          {t("catalog.filter.clear")}
        </button>
      </div>
    </form>
  );
}
