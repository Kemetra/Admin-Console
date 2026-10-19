/**
 * Shared destructive-confirm affordance (T008). An inline confirm step (not a
 * reflexive modal — modals are a last resort, DESIGN.md) that names the exact
 * resource before a soft-delete. Single destructive primary + a cancel
 * (single-primary rule). Used by SF-T3 / SF-S3 (design-brief §7).
 */
import { GatedButton } from "@/components/GatedButton";
import { useT } from "@/i18n";
import "./confirm-delete.css";

export interface ConfirmDeleteProps {
  /** The exact resource the destructive action names. */
  resourceName: string;
  /** Destructive primary label, e.g. "Soft-delete". */
  confirmLabel: string;
  /** Disable the confirm while the delete is in flight (prevents double-fire). */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDelete({
  resourceName,
  confirmLabel,
  pending = false,
  onConfirm,
  onCancel,
}: Readonly<ConfirmDeleteProps>): React.JSX.Element {
  const t = useT();
  return (
    <section
      className="confirm-delete"
      aria-label={t("components.confirmDelete.label", { action: confirmLabel })}
    >
      <p className="confirm-delete__msg">
        {t.rich("components.confirmDelete.prompt", {
          action: confirmLabel,
          name: (
            <strong>
              <bdi>{resourceName}</bdi>
            </strong>
          ),
        })}
      </p>
      <div className="confirm-delete__actions">
        <GatedButton
          type="button"
          className="btn-destructive"
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {confirmLabel}
        </GatedButton>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </button>
      </div>
    </section>
  );
}
