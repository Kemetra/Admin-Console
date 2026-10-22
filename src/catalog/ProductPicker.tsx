/**
 * RT-767 shared product picker (CAT-C1c): search the tenant's ACTIVE products
 * and choose one. It reads through `consoleListCatalogProducts` only, shows no
 * price (RT-743 D4), and writes nothing: choosing calls `onSelect`, and the host
 * (unknown-item link, ERP mapping suggest) puts its own confirm step after it.
 *
 * The listbox is one tab stop with `aria-activedescendant`: Up / Down / Home /
 * End move, Enter or Space choose, a click chooses. Escape is left alone so a
 * surrounding drawer can close. Search runs on an explicit submit, with the text
 * sent exactly as typed. Loading, empty, error and 429 are each their own state;
 * a list longer than the page says so and never claims a total (there is none).
 */
import { Banner, type BannerVariant } from "@/components/Banner";
import { GatedButton } from "@/components/GatedButton";
import { InlineError } from "@/components/InlineError";
import { useT } from "@/i18n";
import type { CatalogProduct } from "@/lib/catalog-queries";
import { useId, useRef, useState } from "react";
import {
  MAX_PICKER_QUERY_LENGTH,
  nextOptionIndex,
  pickerErrorKey,
  validatePickerQuery,
} from "./productPickerLogic";
import { type PickerError, useProductPicker } from "./useProductPicker";
import "./catalog.css";

export interface ProductPickerProps {
  /** The active tenant: the query is keyed by it, and none means nothing is read. */
  tenantId: string | null;
  /** Called with the chosen product. Writes nothing. */
  onSelect: (product: CatalogProduct) => void;
  /** The product the host currently has chosen, marked as selected. */
  selectedId?: string | null;
}

const ERROR_VARIANT: Record<PickerError["kind"], BannerVariant> = {
  "not-found": "info",
  session: "danger",
  rejected: "warning",
  "rate-limited": "warning",
  generic: "danger",
};

function PickerOption({
  id,
  product,
  active,
  selected,
  onChoose,
  onHover,
}: Readonly<{
  id: string;
  product: CatalogProduct;
  active: boolean;
  selected: boolean;
  onChoose: () => void;
  onHover: () => void;
}>): React.JSX.Element {
  const t = useT();
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the listbox owns the keyboard (aria-activedescendant); a click is the pointer path.
    <div
      id={id}
      // biome-ignore lint/a11y/useSemanticElements: a native <option> cannot hold two bidi-isolated lines, and Enter must choose, not change.
      role="option"
      tabIndex={-1}
      aria-selected={selected}
      data-active={active ? "true" : undefined}
      className="product-picker__option"
      onClick={onChoose}
      onMouseMove={onHover}
    >
      <span className="product-picker__name" dir="auto">
        {product.name}
      </span>
      <span className="product-picker__codes">
        {product.primarySku ? (
          <span>
            {t("catalog.picker.sku")} <bdi dir="ltr">{product.primarySku}</bdi>
          </span>
        ) : null}
        {product.primaryBarcode ? (
          <span>
            {t("catalog.picker.barcode")} <bdi dir="ltr">{product.primaryBarcode}</bdi>
          </span>
        ) : null}
      </span>
    </div>
  );
}

function PickerList({
  products,
  selectedId,
  onSelect,
}: Readonly<{
  products: readonly CatalogProduct[];
  selectedId: string | null | undefined;
  onSelect: (product: CatalogProduct) => void;
}>): React.JSX.Element {
  const t = useT();
  const base = useId();
  const [activeIndex, setActiveIndex] = useState(-1);
  const optionId = (index: number) => `${base}-option-${index}`;

  function move(index: number): void {
    setActiveIndex(index);
    document.getElementById(optionId(index))?.scrollIntoView?.({ block: "nearest" });
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    const next = nextOptionIndex(activeIndex, event.key, products.length);
    if (next !== null) {
      event.preventDefault();
      move(next);
      return;
    }
    const chosen = products[activeIndex];
    if ((event.key === "Enter" || event.key === " ") && chosen) {
      event.preventDefault();
      onSelect(chosen);
    }
  }

  return (
    <div
      id={`${base}-list`}
      // biome-ignore lint/a11y/useSemanticElements: a native <select> changes its value on every arrow key; the picker chooses only on Enter, Space or a click.
      role="listbox"
      tabIndex={0}
      aria-label={t("catalog.picker.list")}
      aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
      className="product-picker__list"
      onKeyDown={onKeyDown}
    >
      {products.map((product, index) => (
        <PickerOption
          key={product.productId}
          id={optionId(index)}
          product={product}
          active={index === activeIndex}
          selected={product.productId === selectedId}
          onHover={() => setActiveIndex(index)}
          onChoose={() => {
            setActiveIndex(index);
            onSelect(product);
          }}
        />
      ))}
    </div>
  );
}

function PickerFailure({
  error,
  onRetry,
}: Readonly<{ error: PickerError; onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  return (
    <Banner
      variant={ERROR_VARIANT[error.kind]}
      message={t(pickerErrorKey(error.kind))}
      requestId={error.requestId}
      action={
        <GatedButton className="btn-secondary" onClick={onRetry}>
          {t("catalog.picker.retry")}
        </GatedButton>
      }
    />
  );
}

export function ProductPicker({
  tenantId,
  onSelect,
  selectedId,
}: Readonly<ProductPickerProps>): React.JSX.Element {
  const t = useT();
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState("");
  const [inputError, setInputError] = useState<ReturnType<typeof validatePickerQuery>>();
  const picker = useProductPicker(tenantId, applied);
  const rootRef = useRef<HTMLDivElement>(null);

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const found = validatePickerQuery(draft);
    setInputError(found);
    if (found) return;
    // The same search again reads again: a failed or stale list is refreshed.
    if (draft === applied) picker.retry();
    else setApplied(draft);
  }

  const showList = !picker.isLoading && !picker.error && picker.products.length > 0;
  const showEmpty = !picker.isLoading && !picker.error && picker.products.length === 0 && tenantId;

  return (
    <div className="product-picker" ref={rootRef}>
      <form
        className="product-picker__search"
        onSubmit={submit}
        // The search is not unsaved work: no Stay / Discard prompt for it (RT-268).
        data-dirty-guard="off"
        noValidate
      >
        <div className="field">
          <label htmlFor={inputId}>{t("catalog.picker.search")}</label>
          <input
            id={inputId}
            className="input"
            dir="auto"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={MAX_PICKER_QUERY_LENGTH}
            aria-describedby={`${inputId}-note`}
            aria-invalid={inputError ? true : undefined}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                const list = rootRef.current?.querySelector<HTMLElement>("[role=listbox]");
                if (list) {
                  e.preventDefault();
                  list.focus();
                }
              }
            }}
          />
          <span id={`${inputId}-note`} className="field__hint">
            {t("catalog.picker.searchNote")}
          </span>
          <InlineError message={inputError ? t(inputError) : undefined} />
        </div>
        <GatedButton type="submit" className="btn-secondary">
          {t("catalog.picker.submit")}
        </GatedButton>
      </form>

      {picker.isLoading ? (
        <output className="product-picker__status">{t("catalog.picker.loading")}</output>
      ) : null}
      {picker.error ? <PickerFailure error={picker.error} onRetry={picker.retry} /> : null}
      {showList ? (
        <>
          <PickerList
            key={applied}
            products={picker.products}
            selectedId={selectedId}
            onSelect={onSelect}
          />
          <output className="product-picker__status">
            {t("catalog.picker.count", { count: picker.products.length })}
          </output>
          {picker.hasMore ? (
            <p className="product-picker__more">{t("catalog.picker.more")}</p>
          ) : null}
        </>
      ) : null}
      {showEmpty ? (
        <p className="product-picker__status">
          {t(applied === "" ? "catalog.picker.emptyAll" : "catalog.picker.empty")}
        </p>
      ) : null}
    </div>
  );
}
