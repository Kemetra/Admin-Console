/**
 * RT-768 retire an item (CAT-C2a, RT-752 AC 3). Retiring cannot be undone on
 * this surface: the item reads `retired` from then on, the POS stops publishing
 * it, and its identifiers stay bound to it. So the action is two steps (UX-05
 * "friction follows consequence"): a quiet button starts it, an inline
 * confirmation names the item and the consequence, and the safe choice (Cancel)
 * has focus. The destructive fill is only on the confirming button.
 *
 * `expectedUpdatedAt` is the item's `updatedAt` as last read. A 409
 * `stale_write` offers Reload (the item is read again) and asks again; a 409
 * `product_retired` re-reads and the page shows the item retired.
 */
import { Banner } from "@/components/Banner";
import { GatedButton } from "@/components/GatedButton";
import { type MessageKey, useT } from "@/i18n";
import type { CatalogProductDetail } from "@/lib/catalog-queries";
import { useEffect, useRef, useState } from "react";
import type { ProductWriteRender } from "./productFormLogic";
import { useRetireProduct } from "./useProductWrites";
import "../components/confirm-delete.css";

export interface ProductRetireProps {
  product: CatalogProductDetail;
  tenantId: string;
  /** Read the item again; `undefined` when it could not be read. */
  reload: () => Promise<CatalogProductDetail | undefined>;
  /** The item is retired: the page says so and takes focus. */
  onRetired: () => void;
}

type Notice =
  | { kind: "render"; render: ProductWriteRender }
  | { kind: "info"; messageKey: MessageKey };

function FailureBanner({
  render,
  onReload,
  reloading,
}: Readonly<{
  render: ProductWriteRender;
  onReload: () => void;
  reloading: boolean;
}>): React.JSX.Element | null {
  const t = useT();
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
  if (render.kind === "retired") {
    return (
      <Banner
        variant="danger"
        message={t("catalog.write.error.retired")}
        requestId={render.requestId}
      />
    );
  }
  return (
    <Banner
      variant="warning"
      message={t("catalog.write.error.staleRetire")}
      requestId={render.requestId}
      action={
        <button type="button" className="btn-secondary" onClick={onReload} disabled={reloading}>
          {t("catalog.edit.reload")}
        </button>
      }
    />
  );
}

export function ProductRetire({
  product,
  tenantId,
  reload,
  onRetired,
}: Readonly<ProductRetireProps>): React.JSX.Element {
  const t = useT();
  const { productId, name, updatedAt } = product.summary;
  const retire = useRetireProduct(tenantId, productId);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<Notice | undefined>();
  const [reloading, setReloading] = useState(false);
  // A failed re-read is said next to the conflict banner, which keeps its Reload to retry.
  const [reloadFailed, setReloadFailed] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [returnFocus, setReturnFocus] = useState(0);

  // The safe choice has focus when the confirmation opens; Retire gets it back on Cancel.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);
  useEffect(() => {
    if (returnFocus > 0) startRef.current?.focus();
  }, [returnFocus]);

  function cancel(): void {
    setConfirming(false);
    setNotice(undefined);
    setReturnFocus((n) => n + 1);
  }

  async function onReload(): Promise<void> {
    setReloading(true);
    try {
      const fresh = await reload();
      setReloadFailed(!fresh);
      if (!fresh) return;
      setConfirming(false);
      setNotice({ kind: "info", messageKey: "catalog.retire.reloaded" });
    } finally {
      setReloading(false);
    }
  }

  async function confirm(): Promise<void> {
    if (retire.isPending) return;
    setNotice(undefined);
    setReloadFailed(false);
    try {
      const result = await retire.mutateAsync(updatedAt);
      if (result.ok) {
        onRetired();
        return;
      }
      setNotice({ kind: "render", render: result.render });
      if (result.render.kind === "retired") {
        setConfirming(false);
        await reload();
      }
    } catch {
      // A thrown request (offline, aborted) is still a visible failure, never silent.
      setNotice({
        kind: "render",
        render: { kind: "banner", variant: "danger", messageKey: "catalog.write.error.server" },
      });
    }
  }

  return (
    <section
      className="catalog-detail__section catalog-retire"
      aria-labelledby="catalog-retire-title"
    >
      <h2 id="catalog-retire-title" className="surface__section-title">
        {t("catalog.retire.section")}
      </h2>
      <p className="content__sub">{t("catalog.retire.sub")}</p>
      {notice?.kind === "render" ? (
        <FailureBanner
          render={notice.render}
          onReload={() => void onReload()}
          reloading={reloading}
        />
      ) : null}
      {reloadFailed ? <Banner variant="info" message={t("catalog.detail.loadFailed")} /> : null}
      {notice?.kind === "info" ? <Banner variant="info" message={t(notice.messageKey)} /> : null}
      {confirming ? (
        <section className="confirm-delete" aria-label={t("catalog.retire.confirmLabel")}>
          <p className="confirm-delete__msg">
            {t.rich("catalog.retire.prompt", {
              name: (
                <strong>
                  <bdi dir="auto">{name}</bdi>
                </strong>
              ),
            })}
          </p>
          <p className="confirm-delete__msg">{t("catalog.retire.consequence")}</p>
          <div className="confirm-delete__actions">
            <GatedButton
              type="button"
              className="btn-destructive"
              onClick={() => void confirm()}
              disabled={retire.isPending}
            >
              {retire.isPending ? <span className="spinner" aria-hidden="true" /> : null}
              {t("catalog.retire.confirm")}
            </GatedButton>
            <button
              ref={cancelRef}
              type="button"
              className="btn-secondary"
              onClick={cancel}
              disabled={retire.isPending}
            >
              {t("common.cancel")}
            </button>
          </div>
        </section>
      ) : (
        <div className="surface__actions catalog-retire__actions">
          <button
            ref={startRef}
            type="button"
            className="btn-danger-quiet"
            onClick={() => {
              setNotice(undefined);
              setConfirming(true);
            }}
          >
            {t("catalog.retire.start")}
          </button>
        </div>
      )}
    </section>
  );
}
