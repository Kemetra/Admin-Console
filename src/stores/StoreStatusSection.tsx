import { GatedButton } from "@/components/GatedButton";
import { useT } from "@/i18n";
import { type Rf2ErrorRender, mapRf2Error } from "@/lib/rf2-queries";
/**
 * «حالة المتجر» on the edit screen (RT-400 screen 17). The V1 `is_active`
 * control: «إيقاف المتجر» sends `is_active: false`, «تفعيل المتجر» sends
 * `is_active: true` (owner decision 2026-10-13: the same flag the old checkbox
 * set, nothing more). It is not readiness-gated activation (decision 188) or a
 * closure (decision 194).
 *
 * Suspending asks first, inline, naming the store (owner decision 2026-10-13);
 * activating is one click. The section sits outside the name form, so it never
 * saves or discards a pending name edit and never marks the form dirty. Each
 * control is disabled while the other's request is in flight. Failures,
 * including a thrown network error, go to the page banner.
 */
import { useState } from "react";
import { StoreStateBadge } from "./StoreStateBadge";
import { STORE_REQUEST_FAILED, useStoreStatusMutation } from "./useStoreQueries";
import { useStoreScope } from "./useStoreScope";

export interface StoreStatusSectionProps {
  storeId: string;
  storeName?: string;
  isActive?: boolean;
  /** True while the name form is saving. */
  disabled?: boolean;
  onStart: () => void;
  onError: (render: Rf2ErrorRender) => void;
}

export function StoreStatusSection({
  storeId,
  storeName,
  isActive,
  disabled = false,
  onStart,
  onError,
}: Readonly<StoreStatusSectionProps>): React.JSX.Element {
  const t = useT();
  const { activeTenantId } = useStoreScope();
  const status = useStoreStatusMutation(activeTenantId, storeId);
  const [confirming, setConfirming] = useState(false);
  const active = isActive !== false;
  const busy = disabled || status.isPending;

  async function apply(nextActive: boolean): Promise<void> {
    onStart();
    try {
      const res = await status.mutateAsync(nextActive);
      if (res.status >= 400) onError(mapRf2Error({ ...res, context: "store" }));
    } catch {
      onError(STORE_REQUEST_FAILED);
    } finally {
      setConfirming(false);
    }
  }

  const spinner = status.isPending ? <span className="spinner" aria-hidden="true" /> : null;

  return (
    <section className="surface__status" aria-labelledby="store-status-title">
      <h2 id="store-status-title" className="surface__section-title">
        {t("stores.status.title")}
      </h2>
      <div className="surface__status-row">
        <p className="surface__status-current">
          {t("stores.status.current")} <StoreStateBadge isActive={isActive} />
        </p>
        {confirming ? null : (
          <GatedButton
            type="button"
            className="btn-secondary"
            onClick={active ? () => setConfirming(true) : () => apply(true)}
            disabled={busy}
          >
            {active ? null : spinner}
            {t(active ? "stores.status.suspend" : "stores.status.activate")}
          </GatedButton>
        )}
      </div>

      {confirming ? (
        <section className="surface__confirm" aria-label={t("stores.status.confirmLabel")}>
          <p className="surface__confirm-msg">
            {t.rich("stores.status.confirmPrompt", { name: <bdi>{storeName}</bdi> })}
          </p>
          <div className="surface__confirm-actions">
            <GatedButton
              type="button"
              className="btn-destructive"
              onClick={() => apply(false)}
              disabled={busy}
            >
              {spinner}
              {t("stores.status.suspend")}
            </GatedButton>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirming(false)}
              disabled={status.isPending}
            >
              {t("common.cancel")}
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
}
