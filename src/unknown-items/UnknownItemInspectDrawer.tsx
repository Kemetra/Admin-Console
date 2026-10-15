import { Banner } from "@/components/Banner";
import { Drawer } from "@/components/Drawer";
import { ListState } from "@/components/ListState";
import { DateTime, type MessageKey, useT } from "@/i18n";
import {
  type ReviewQueueItem,
  identifierTypeKey,
  resolutionActionKey,
  resolutionStatusKey,
} from "@/lib/unknown-items-queries";
/**
 * SF-4a-2 — inspect drawer (T007). Reuses the shared Drawer (right-side panel,
 * focus-trapped, Escape closes) to render the `ReviewQueueItem` projection
 * read-only. It renders ONLY ReviewQueueItem fields — it MUST NOT reference
 * `sale_context` (that field lives on `UnknownItem`, not the review projection;
 * FR-007 / FR-4a-004).
 *
 * For a `pending` item it offers a Dismiss entry, which swaps the body to the
 * dismiss confirm. The dismiss action and its inline error live in
 * UnknownItemDismiss; this surface just owns the panel + the read-only detail.
 * RT-399: enum fields render their localized labels (never the raw code), ids
 * stay LTR-isolated, and the instants render as operational times.
 */
import { useState } from "react";
import { UnknownItemDismiss } from "./UnknownItemDismiss";
import { useUnknownItemInspect } from "./useUnknownItemQueries";
import "./unknown-items.css";

export interface UnknownItemInspectDrawerProps {
  id: string;
  activeTenantId: string | null;
  onClose: () => void;
  /** Called after a successful dismiss so the parent can close + refresh. */
  onDismissed: () => void;
}

function Field({
  label,
  value,
}: Readonly<{ label: string; value: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="unknown-item-detail__field">
      <dt className="unknown-item-detail__label">{label}</dt>
      <dd className="unknown-item-detail__value">{value ?? "—"}</dd>
    </div>
  );
}

/** A machine value (id, code) isolated LTR, or null to show the empty mark. */
function machine(value: string | null): React.ReactNode {
  return value === null ? null : <bdi dir="ltr">{value}</bdi>;
}

function DetailBody({ item }: Readonly<{ item: ReviewQueueItem }>): React.JSX.Element {
  const t = useT();
  // An enum value outside the contract shows verbatim rather than a guess.
  const label = (key: MessageKey | null, raw: string | null): React.ReactNode =>
    key ? t(key) : machine(raw);
  return (
    <dl className="unknown-item-detail">
      <Field label={t("unknownItems.field.identifier")} value={machine(item.identifier_value)} />
      <Field
        label={t("unknownItems.field.identifierType")}
        value={label(identifierTypeKey(item.identifier_type), item.identifier_type)}
      />
      <Field label={t("unknownItems.field.source")} value={machine(item.source_system)} />
      <Field label={t("unknownItems.field.store")} value={machine(item.store_id)} />
      <Field
        label={t("unknownItems.field.status")}
        value={label(resolutionStatusKey(item.resolution_status), item.resolution_status)}
      />
      <Field
        label={t("unknownItems.field.resolutionAction")}
        value={label(resolutionActionKey(item.resolution_action), item.resolution_action)}
      />
      <Field
        label={t("unknownItems.field.encounteredAt")}
        value={<DateTime value={item.encountered_at} />}
      />
      <Field
        label={t("unknownItems.field.resolvedAt")}
        value={item.resolved_at ? <DateTime value={item.resolved_at} /> : null}
      />
      <Field label={t("unknownItems.field.resolvedBy")} value={machine(item.resolved_by)} />
    </dl>
  );
}

export function UnknownItemInspectDrawer({
  id,
  activeTenantId,
  onClose,
  onDismissed,
}: Readonly<UnknownItemInspectDrawerProps>): React.JSX.Element {
  const t = useT();
  const { result, isLoading } = useUnknownItemInspect(id);
  const [confirming, setConfirming] = useState(false);

  const item = result?.kind === "item" ? result.item : undefined;
  const error = result?.kind === "error" ? result.render : undefined;
  const isPending = item?.resolution_status === "pending";

  return (
    <Drawer title={t("unknownItems.drawer.title")} onClose={onClose}>
      {isLoading ? (
        <ListState state="loading" label={t("unknownItems.drawer.loadingNoun")} />
      ) : null}

      {error && error.kind === "not-found" ? (
        <Banner variant="info" message={t(error.messageKey)} />
      ) : null}
      {error && (error.kind === "banner" || error.kind === "generic") ? (
        <Banner variant="danger" message={t(error.messageKey)} requestId={error.requestId} />
      ) : null}

      {item ? (
        <>
          <DetailBody item={item} />
          {isPending && !confirming ? (
            <div className="unknown-item-detail__actions">
              <button type="button" className="btn-destructive" onClick={() => setConfirming(true)}>
                {t("unknownItems.dismiss.action")}
              </button>
            </div>
          ) : null}
          {isPending && confirming ? (
            <UnknownItemDismiss
              item={item}
              activeTenantId={activeTenantId}
              onDismissed={onDismissed}
              onCancel={() => setConfirming(false)}
            />
          ) : null}
        </>
      ) : null}
    </Drawer>
  );
}
