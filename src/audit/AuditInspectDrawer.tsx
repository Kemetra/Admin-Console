/**
 * SF-6-2 — Row inspect drawer (T026, OQ-2). Reuses the shared focus-trapped
 * `Drawer` (so it inherits Escape, focus-trap, focus-return, and the justified
 * a11y biome-ignores). Renders the ALREADY-FETCHED row — **no** backend call,
 * no single-event read op. Read-only: NO action buttons (no acknowledge /
 * annotate / export — FR-006-009). `request_id` has a copy-to-clipboard control;
 * `metadata` renders as a readable mono key/value block.
 *
 * RT-399: `occurred_at` is evidence — exact UTC (`formatEvidenceTime`), with a
 * UTC label. Action codes, IDs, request refs and metadata are machine data:
 * never translated, LTR-isolated.
 */
import { Drawer } from "@/components/Drawer";
import { formatEvidenceTime, useT } from "@/i18n";
import type { AuditRow } from "./useAuditSearch";
import "./audit.css";

export interface AuditInspectDrawerProps {
  row: AuditRow;
  onClose: () => void;
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="field-row">
      <dt className="field-row__label">{label}</dt>
      <dd className={mono ? "field-row__value field-row__value--mono" : "field-row__value"}>
        {value}
      </dd>
    </div>
  );
}

function actorValue(row: AuditRow): React.ReactNode {
  if (row.actor_label != null) return <bdi>{row.actor_label}</bdi>;
  if (row.actor_user_id != null) return <bdi dir="ltr">{row.actor_user_id}</bdi>;
  return "—";
}

export function AuditInspectDrawer({ row, onClose }: AuditInspectDrawerProps): React.JSX.Element {
  const t = useT();

  function copyRequestId(): void {
    if (row.request_id) void navigator.clipboard?.writeText(row.request_id);
  }

  const metadataEntries = Object.entries(row.metadata ?? {});

  return (
    <Drawer title={t("audit.inspect.title")} onClose={onClose}>
      <dl className="surface__detail">
        <Field
          label={t("audit.field.time")}
          value={<bdi dir="ltr">{formatEvidenceTime(row.occurred_at)}</bdi>}
          mono
        />
        <Field label={t("audit.field.action")} value={<bdi dir="ltr">{row.action}</bdi>} mono />
        <Field label={t("audit.field.actor")} value={actorValue(row)} />
        <Field
          label={t("audit.field.target")}
          value={
            row.target_type ? (
              <bdi dir="ltr">{`${row.target_type} · ${row.target_id ?? "—"}`}</bdi>
            ) : (
              "—"
            )
          }
          mono
        />
        <Field
          label={t("audit.field.store")}
          value={<bdi dir="ltr">{row.store_id ?? "—"}</bdi>}
          mono
        />
        <Field
          label={t("audit.field.requestId")}
          value={
            <span className="audit-inspect__req">
              <bdi dir="ltr" className="field-row__value--mono">
                {row.request_id ?? "—"}
              </bdi>
              {row.request_id ? (
                <button type="button" className="btn-ghost" onClick={copyRequestId}>
                  {t("audit.inspect.copy")}
                </button>
              ) : null}
            </span>
          }
        />
      </dl>

      <section className="audit-inspect__metadata" aria-label={t("audit.inspect.metadata")}>
        <h3 className="drawer__danger-title">{t("audit.inspect.metadata")}</h3>
        {metadataEntries.length === 0 ? (
          <p className="audit-table__muted">{t("audit.inspect.noMetadata")}</p>
        ) : (
          <dl className="audit-inspect__kv">
            {metadataEntries.map(([k, v]) => (
              <div key={k} className="audit-inspect__kv-row">
                <dt className="field-row__value--mono">
                  <bdi dir="ltr">{k}</bdi>
                </dt>
                <dd className="field-row__value--mono">
                  <bdi dir="ltr">{JSON.stringify(v)}</bdi>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </Drawer>
  );
}
