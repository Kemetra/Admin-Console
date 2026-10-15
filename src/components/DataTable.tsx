/**
 * Shared list-table presenter (T006). The canonical tables-over-cards surface
 * (DESIGN.md rule 7) for RF-2's tenant/store rosters and later list families.
 *
 * Renders EXACTLY the rows it is handed — the backend-scoped set, no client-side
 * authorization filter (spec OQ-2). Each row is the activation target (row →
 * detail), keyboard-navigable (Enter/Space), 36px+ touch floor (DESIGN.md rule
 * 10). No table library (research R4-4); hand-rolled over the design tokens.
 */
import "./data-table.css";

export interface DataTableColumn<Row> {
  /** Stable key for the column (React key + a11y). */
  key: string;
  /** Header label. */
  header: string;
  /** Cell renderer for a row. */
  cell: (row: Row) => React.ReactNode;
  /** Render the cell in the mono face (IDs, slugs, codes). */
  mono?: boolean;
}

export interface DataTableProps<Row> {
  /** Accessible caption naming the table contents. */
  caption: string;
  columns: ReadonlyArray<DataTableColumn<Row>>;
  rows: ReadonlyArray<Row>;
  rowKey: (row: Row) => string;
  /** Row activation (click / Enter / Space) → open detail. */
  onRowActivate: (row: Row) => void;
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  onRowActivate,
}: Readonly<DataTableProps<Row>>): React.JSX.Element {
  return (
    <table className="data-table">
      <caption className="data-table__caption">{caption}</caption>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} scope="col">
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={rowKey(row)}
            className="data-table__row"
            tabIndex={0}
            onClick={() => onRowActivate(row)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRowActivate(row);
              }
            }}
          >
            {columns.map((col) => (
              <td key={col.key} className={col.mono ? "data-table__cell--mono" : undefined}>
                {col.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
