import { Banner } from "@/components/Banner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { useT } from "@/i18n";
import { type ReviewQueueItem, identifierTypeKey } from "@/lib/unknown-items-queries";
/**
 * SF-4a-3 — dismiss confirm (T008). Reuses the shared ConfirmDelete affordance
 * (inline confirm, not a reflexive modal) naming the item's identifier before
 * the dismiss. Single destructive primary + cancel.
 *
 * On a failed dismiss the mapped error renders inline: a 409 `already_reconciled`
 * tells the operator the item is already terminal (refresh), a 403 `forbidden`
 * is the 007 8th category, a 404 is the uniform non-disclosing copy. Success is
 * surfaced by the parent (the list invalidates and the drawer closes).
 */
import { useUnknownItemDismiss } from "./useUnknownItemQueries";

export interface UnknownItemDismissProps {
  item: ReviewQueueItem;
  activeTenantId: string | null;
  onDismissed: () => void;
  onCancel: () => void;
}

export function UnknownItemDismiss({
  item,
  activeTenantId,
  onDismissed,
  onCancel,
}: UnknownItemDismissProps): React.JSX.Element {
  const t = useT();
  const dismiss = useUnknownItemDismiss(activeTenantId);
  const result = dismiss.data;
  const error = result && !result.ok ? result.render : undefined;
  // The confirm names the item: its identifier type label + the exact value.
  const typeKey = identifierTypeKey(item.identifier_type);
  const resourceName = t("unknownItems.dismiss.resource", {
    type: typeKey ? t(typeKey) : item.identifier_type,
    value: item.identifier_value,
  });

  function onConfirm(): void {
    dismiss.mutate(item.id, {
      onSuccess: (res) => {
        if (res.ok) onDismissed();
      },
    });
  }

  return (
    <div className="unknown-item-dismiss">
      {error && error.kind === "banner" ? (
        <Banner variant="danger" message={t(error.messageKey)} requestId={error.requestId} />
      ) : null}
      {error && error.kind === "already-reconciled" ? (
        <Banner variant="warning" message={t(error.messageKey)} />
      ) : null}
      {error && error.kind === "not-found" ? (
        <Banner variant="info" message={t(error.messageKey)} />
      ) : null}
      {error && error.kind === "generic" ? (
        <Banner variant="danger" message={t(error.messageKey)} requestId={error.requestId} />
      ) : null}

      <ConfirmDelete
        resourceName={resourceName}
        confirmLabel={t("unknownItems.dismiss.action")}
        pending={dismiss.isPending}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </div>
  );
}
