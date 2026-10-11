/**
 * SF-6-1 audit table (T020). Semantic `<table>`, terminal-typographic: mono
 * `action`/`request_id`, right-aligned tabular time. POS-catalogue actions
 * (`shift.*`, `operator.session.takeover`) render IDENTICALLY to others — no
 * POS-special styling at this slice (R6-6). The row-inspect trigger is a real
 * `<button>` in the first cell (keyboard-activable, a11y), not an onClick on
 * `<tr>` (design-brief §5). No brand color anywhere; severity (if shown) is a contained
 * status badge, never a side-stripe.
 */
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

function formatTime(iso: string): string {
  // Stable, locale-independent absolute time (tabular). No Date.now relative.
  return iso.replace("T", " ").replace("Z", " UTC");
}

export function AuditTable({ rows, onInspect }: AuditTableProps): React.JSX.Element {
  return (
    <table className="audit-table">
      <caption className="audit-table__caption">Audit events</caption>
      <thead>
        <tr>
          <th scope="col">Time</th>
          <th scope="col">Action</th>
          <th scope="col">Actor</th>
          <th scope="col">Target</th>
          <th scope="col">Store</th>
          <th scope="col">Req</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="audit-table__time">{formatTime(row.occurred_at)}</td>
            <td>
              <button type="button" className="audit-table__action" onClick={() => onInspect(row)}>
                {row.action}
              </button>
            </td>
            <td className="audit-table__muted">{row.actor_label ?? shortId(row.actor_user_id)}</td>
            <td className="audit-table__muted">
              {row.target_type ? `${row.target_type} · ${shortId(row.target_id)}` : "—"}
            </td>
            <td className="audit-table__mono">{shortId(row.store_id)}</td>
            <td className="audit-table__mono">{shortId(row.request_id)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
