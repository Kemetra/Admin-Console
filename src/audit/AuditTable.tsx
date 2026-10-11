/**
 * SF-6-1 audit table (T020). Semantic `<table>`, terminal-typographic: mono
 * `action`/`request_id`, right-aligned tabular time. POS-catalogue actions
 * (`shift.*`, `operator.session.takeover`) render IDENTICALLY to others — no
 * POS-special styling at this slice (R6-6). The row-inspect trigger is a real
 * `<button>` in the first cell (keyboard-activable, a11y), not an onClick on
 * `<tr>` (design-brief §5). No brand color anywhere; severity (if shown) is a contained
 * status badge, never a side-stripe.
 *
 * RT-399: the time is EVIDENCE — the exact recorded instant in UTC, unchanged
 * by locale (`formatEvidenceTime`), and the column header names UTC. Action
 * codes, IDs and request refs are machine data: never translated, LTR-isolated
 * so an RTL page can't reorder them.
 */
import { formatEvidenceTime, useT } from "@/i18n";
import type { AuditRow } from "./useAuditSearch";
import "./audit.css";

export interface AuditTableProps {
  rows: AuditRow[];
  onInspect: (row: AuditRow) => void;
}

function shortId(id?: string | null): string {
  if (!id) return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export function AuditTable({ rows, onInspect }: AuditTableProps): React.JSX.Element {
  const t = useT();
  return (
    <table className="audit-table">
      <caption className="audit-table__caption">{t("audit.table.caption")}</caption>
      <thead>
        <tr>
          <th scope="col">{t("audit.field.time")}</th>
          <th scope="col">{t("audit.field.action")}</th>
          <th scope="col">{t("audit.field.actor")}</th>
          <th scope="col">{t("audit.field.target")}</th>
          <th scope="col">{t("audit.field.store")}</th>
          <th scope="col">{t("audit.table.requestShort")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="audit-table__time">
              <bdi dir="ltr">{formatEvidenceTime(row.occurred_at)}</bdi>
            </td>
            <td>
              <button type="button" className="audit-table__action" onClick={() => onInspect(row)}>
                <bdi dir="ltr">{row.action}</bdi>
              </button>
            </td>
            <td className="audit-table__muted">
              {row.actor_label != null ? (
                <bdi>{row.actor_label}</bdi>
              ) : (
                <bdi dir="ltr">{shortId(row.actor_user_id)}</bdi>
              )}
            </td>
            <td className="audit-table__muted">
              {row.target_type ? (
                <bdi dir="ltr">{`${row.target_type} · ${shortId(row.target_id)}`}</bdi>
              ) : (
                "—"
              )}
            </td>
            <td className="audit-table__mono">
              <bdi dir="ltr">{shortId(row.store_id)}</bdi>
            </td>
            <td className="audit-table__mono">
              <bdi dir="ltr">{shortId(row.request_id)}</bdi>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
