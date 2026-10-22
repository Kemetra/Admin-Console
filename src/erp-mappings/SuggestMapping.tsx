/**
 * RT-725 / RT-767 — suggest an ERPNext Item for a product. One form for both
 * entry points: a replacement for the product of a mapping just retired (its id
 * is known from the row), and a fresh suggestion for a product chosen in the
 * shared catalog picker (CAT-C1c). In neither is a product id ever typed: it is
 * a prop, from a row or from the picker.
 *
 * The suggestion is recorded inert (`suggested`, never used for posting) and
 * only after an explicit confirm; the call goes to Backend-Core, never to ERPNext.
 */
import { ProductPicker } from "@/catalog/ProductPicker";
import { useT } from "@/i18n";
import type { CatalogProduct } from "@/lib/catalog-queries";
import type { ErpnextItemMapping } from "@/lib/erp-mapping-queries";
import { useEffect, useId, useRef, useState } from "react";
import { InlineConfirm, Ref } from "./MappingParts";
import { cleanRef } from "./mappingLogic";
import { useSuggestItemMapping } from "./useErpMappings";

interface SuggestFormProps {
  tenantId: string;
  productId: string;
  /** The product as the sentence names it: its id, with its name when known. */
  product: React.ReactNode;
  label: string;
  lead: React.ReactNode;
  /** Beside the Review button: a way back a flow offers (choose another product). */
  extraAction?: React.ReactNode;
  /** The previous step has unmounted under the keyboard: the reference input takes focus. */
  focusOnMount?: boolean;
  onSuggested: () => void;
  onDismiss: () => void;
}

function SuggestForm({
  tenantId,
  productId,
  product,
  label,
  lead,
  extraAction,
  focusOnMount = false,
  onSuggested,
  onDismiss,
}: Readonly<SuggestFormProps>): React.JSX.Element {
  const t = useT();
  const inputId = useId();
  const refInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusOnMount) refInput.current?.focus();
  }, [focusOnMount]);
  const suggest = useSuggestItemMapping(tenantId);
  const [ref, setRef] = useState("");
  const [review, setReview] = useState(false);
  const [empty, setEmpty] = useState(false);

  if (review) {
    return (
      <InlineConfirm
        label={label}
        prompt={t.rich("erp.map.items.suggest.prompt", { product, item: <Ref value={ref} /> })}
        confirmLabel={t("erp.map.items.suggest.action")}
        op="suggest"
        pending={suggest.pending}
        failure={suggest.failure}
        onConfirm={() =>
          suggest.run({ tenant_product_id: productId, erpnext_item_ref: ref }, (o) => {
            if (o.ok) onSuggested();
          })
        }
        onCancel={() => {
          suggest.reset();
          setReview(false);
        }}
      />
    );
  }

  return (
    <form
      className="map-form"
      aria-label={label}
      onSubmit={(e) => {
        e.preventDefault();
        const clean = cleanRef(ref);
        setEmpty(clean === "");
        if (clean === "") return;
        setRef(clean);
        setReview(true);
      }}
    >
      <p className="map-form__lead">{lead}</p>
      <div className="field">
        <label htmlFor={inputId}>{t("erp.map.items.suggest.ref")}</label>
        <input
          ref={refInput}
          id={inputId}
          className="input input--mono"
          dir="ltr"
          autoComplete="off"
          value={ref}
          aria-invalid={empty}
          aria-describedby={empty ? `${inputId}-error` : undefined}
          onChange={(e) => setRef(e.target.value)}
        />
        {empty ? (
          <p className="map-form__error" id={`${inputId}-error`}>
            {t("erp.map.form.required")}
          </p>
        ) : null}
      </div>
      <p className="erp-note">{t("erp.map.items.suggest.note")}</p>
      <div className="map-confirm__actions">
        <button type="submit" className="btn-primary">
          {t("erp.map.review")}
        </button>
        {extraAction}
        <button type="button" className="btn-secondary" onClick={onDismiss}>
          {t("erp.map.items.suggest.dismiss")}
        </button>
      </div>
    </form>
  );
}

/** After a retire: suggest a replacement for the same product (known from the retired row). */
export function ReplacementSuggest({
  tenantId,
  retired,
  onSuggested,
  onDismiss,
}: Readonly<{
  tenantId: string;
  retired: ErpnextItemMapping;
  onSuggested: () => void;
  onDismiss: () => void;
}>): React.JSX.Element {
  const t = useT();
  const product = <Ref value={retired.tenant_product_id} />;
  return (
    <SuggestForm
      tenantId={tenantId}
      productId={retired.tenant_product_id}
      product={product}
      label={t("erp.map.items.suggest.label")}
      lead={t.rich("erp.map.items.suggest.lead", { product })}
      onSuggested={onSuggested}
      onDismiss={onDismiss}
    />
  );
}

/** A fresh suggestion: choose the product in the catalog picker, then the ERPNext reference. */
export function CatalogSuggest({
  tenantId,
  onSuggested,
  onDismiss,
}: Readonly<{
  tenantId: string;
  onSuggested: () => void;
  onDismiss: () => void;
}>): React.JSX.Element {
  const t = useT();
  const [chosen, setChosen] = useState<CatalogProduct | null>(null);
  const label = t("erp.map.items.suggestNew.label");

  if (chosen) {
    const product = (
      <>
        <strong dir="auto">{chosen.name}</strong> <Ref value={chosen.productId} />
      </>
    );
    return (
      <SuggestForm
        key={chosen.productId}
        tenantId={tenantId}
        productId={chosen.productId}
        product={product}
        label={label}
        lead={t.rich("erp.map.items.suggestNew.lead", { product })}
        focusOnMount
        extraAction={
          <button type="button" className="btn-secondary" onClick={() => setChosen(null)}>
            {t("erp.map.items.suggestNew.change")}
          </button>
        }
        onSuggested={onSuggested}
        onDismiss={onDismiss}
      />
    );
  }

  return (
    <section className="map-form" aria-label={label}>
      <p className="map-form__lead">{t("erp.map.items.suggestNew.choose")}</p>
      <ProductPicker tenantId={tenantId} onSelect={setChosen} selectedId={null} />
      <div className="map-confirm__actions">
        <button type="button" className="btn-secondary" onClick={onDismiss}>
          {t("erp.map.items.suggest.dismiss")}
        </button>
      </div>
    </section>
  );
}
