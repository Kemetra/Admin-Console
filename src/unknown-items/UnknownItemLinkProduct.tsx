import { ProductPicker } from "@/catalog/ProductPicker";
import { pickerQueryKeys } from "@/catalog/useProductPicker";
import { Banner } from "@/components/Banner";
import { GatedButton } from "@/components/GatedButton";
import { useT } from "@/i18n";
import type { CatalogProduct } from "@/lib/catalog-queries";
import { type ReviewQueueItem, identifierTypeKey } from "@/lib/unknown-items-queries";
/**
 * RT-767 — link a pending unknown item to an existing product. A step in the
 * inspect drawer: the shared product picker (active products only), then an
 * explicit confirm that names the identifier and the chosen product. Choosing
 * writes nothing; only the confirm sends the link.
 *
 * The product id sent always comes from the picker, never from typed text. A
 * refusal stays on the step as a persistent message: `alias_conflict` is
 * non-disclosing (the other product is never named); `target_unavailable` reads
 * the picker again and clears the choice, since the product it showed is gone;
 * `already_reconciled` hands back to the drawer, which reads the item again.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { UnknownItemErrorBanner } from "./UnknownItemErrorBanner";
import { useUnknownItemLink } from "./useUnknownItemQueries";

export interface UnknownItemLinkProductProps {
  item: ReviewQueueItem;
  activeTenantId: string | null;
  onLinked: () => void;
  /** The item was resolved by someone else while the operator was choosing. */
  onResolvedElsewhere: () => void;
  onCancel: () => void;
}

function ConfirmLink({
  item,
  product,
  pending,
  onConfirm,
  onChange,
  onCancel,
}: Readonly<{
  item: ReviewQueueItem;
  product: CatalogProduct;
  pending: boolean;
  onConfirm: () => void;
  onChange: () => void;
  onCancel: () => void;
}>): React.JSX.Element {
  const t = useT();
  const typeKey = identifierTypeKey(item.identifier_type);
  const groupRef = useRef<HTMLFieldSetElement>(null);
  // The picker that held focus has unmounted: the confirm takes it, so Escape and Tab still work.
  useEffect(() => groupRef.current?.focus(), []);
  return (
    <fieldset ref={groupRef} tabIndex={-1} className="unknown-item-link__confirm">
      <legend className="sr-only">{t("unknownItems.link.confirm.label")}</legend>
      <p>
        {t.rich("unknownItems.link.confirm.prompt", {
          identifier: (
            <>
              {typeKey ? `${t(typeKey)} ` : null}
              <bdi dir="ltr">{item.identifier_value}</bdi>
            </>
          ),
          product: <strong dir="auto">{product.name}</strong>,
        })}
      </p>
      <div className="unknown-item-detail__actions">
        <GatedButton type="button" className="btn-primary" disabled={pending} onClick={onConfirm}>
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {t("unknownItems.link.confirm.action")}
        </GatedButton>
        <button type="button" className="btn-secondary" disabled={pending} onClick={onChange}>
          {t("unknownItems.link.change")}
        </button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </fieldset>
  );
}

export function UnknownItemLinkProduct({
  item,
  activeTenantId,
  onLinked,
  onResolvedElsewhere,
  onCancel,
}: Readonly<UnknownItemLinkProductProps>): React.JSX.Element {
  const t = useT();
  const qc = useQueryClient();
  const link = useUnknownItemLink(activeTenantId);
  const [chosen, setChosen] = useState<CatalogProduct | null>(null);
  const result = link.data;
  const error = result && !result.ok ? result.render : undefined;

  function choose(product: CatalogProduct): void {
    link.reset();
    setChosen(product);
  }

  function confirm(): void {
    if (!chosen) return;
    link.mutate(
      { id: item.id, productId: chosen.productId },
      {
        onSuccess: (res) => {
          if (res.ok) onLinked();
          else if (res.render.kind === "already-reconciled") onResolvedElsewhere();
          else if (res.render.kind === "target-unavailable") {
            // The product the picker showed is gone: drop the cached list so the
            // picker reads fresh when it shows again, and choose again.
            setChosen(null);
            qc.removeQueries({ queryKey: pickerQueryKeys.all(activeTenantId) });
          }
        },
      },
    );
  }

  return (
    <section className="unknown-item-form unknown-item-link">
      <p className="unknown-item-form__legend">{t("unknownItems.link.legend")}</p>
      {link.isError ? <Banner variant="danger" message={t("errors.server")} /> : null}
      {error ? <UnknownItemErrorBanner error={error} /> : null}
      {chosen ? (
        <ConfirmLink
          item={item}
          product={chosen}
          pending={link.isPending}
          onConfirm={confirm}
          onChange={() => setChosen(null)}
          onCancel={onCancel}
        />
      ) : (
        <>
          <p className="field__hint">{t("unknownItems.link.lead")}</p>
          <ProductPicker tenantId={activeTenantId} onSelect={choose} selectedId={null} />
          <div className="unknown-item-detail__actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {t("common.cancel")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
