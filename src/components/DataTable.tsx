/**
 * Shared list-table presenter (T006). The canonical tables-over-cards surface
 * (DESIGN.md rule 7) for RF-2's tenant/store rosters and later list families.
 *
 * Renders EXACTLY the rows it is handed — the backend-scoped set, no client-side
 * authorization filter (spec OQ-2). Each row is the activation target (row →
 * detail), keyboard-navigable (Enter/Space), 36px+ touch floor (DESIGN.md rule
 * 10). No table library (research R4-4); hand-rolled over the design tokens.
 *
 * RT-753 (UX-10), both opt-in so existing tables render exactly as before:
 * - Sort: a column marked `sortable` becomes a header button when the caller
 *   passes `onSortChange`. The caller owns the sort state AND the order of
 *   `rows`; this table never reorders (sort the dataset, not the viewport).
 * - Selection: a controlled checkbox column (`selection`). Selection is not
 *   navigation, so the checkbox never activates the row.
 */
import "./data-table.css";
import { PageCheckbox, SelectCell, SortButton, ariaSortOf } from "./DataTableParts";
import type { SortState } from "./tableSort";

export interface DataTableColumn<Row> {
  /** Stable key for the column (React key + a11y). */
  key: string;
  /** Header label. */
  header: string;
  /** Cell renderer for a row. */
  cell: (row: Row) => React.ReactNode;
  /** Render the cell in the mono face (IDs, slugs, codes). */
  mono?: boolean;
  /** Offer sorting on this column (needs `onSortChange` on the table). */
  sortable?: boolean;
}

export interface DataTableSelection<Row> {
  /** The selected row keys; the caller keeps them to the rows listed. */
  selectedKeys: ReadonlySet<string>;
  onSelectionChange: (next: ReadonlySet<string>) => void;
  /** The row's name for its checkbox label. */
  rowLabel: (row: Row) => string;
}

export interface DataTableProps<Row> {
  /** Accessible caption naming the table contents. */
  caption: string;
  columns: ReadonlyArray<DataTableColumn<Row>>;
  rows: ReadonlyArray<Row>;
  rowKey: (row: Row) => string;
  /** Row activation (click / Enter / Space) → open detail. */
  onRowActivate: (row: Row) => void;
  /** The active sort, shown on its header (`aria-sort`). */
  sort?: SortState | null;
  /** Called with the requested sort when a sortable header is pressed. */
  onSortChange?: (next: SortState) => void;
  selection?: DataTableSelection<Row>;
}

function withToggled(selected: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(selected);
  if (!next.delete(key)) next.add(key);
  return next;
}

function pageToggled(selected: ReadonlySet<string>, pageKeys: string[]): ReadonlySet<string> {
  const next = new Set(selected);
  const all = pageKeys.every((k) => selected.has(k));
  for (const k of pageKeys) {
    if (all) next.delete(k);
    else next.add(k);
  }
  return next;
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  onRowActivate,
  sort,
  onSortChange,
  selection,
}: Readonly<DataTableProps<Row>>): React.JSX.Element {
  const pageKeys = rows.map(rowKey);
  const pageSelected = pageKeys.filter((k) => selection?.selectedKeys.has(k)).length;
  return (
    <table className="data-table">
      <caption className="data-table__caption">{caption}</caption>
      <thead>
        <tr>
          {selection ? (
            <th scope="col" className="data-table__select">
              <PageCheckbox
                checked={pageKeys.length > 0 && pageSelected === pageKeys.length}
                mixed={pageSelected > 0 && pageSelected < pageKeys.length}
                onToggle={() =>
                  selection.onSelectionChange(pageToggled(selection.selectedKeys, pageKeys))
                }
              />
            </th>
          ) : null}
          {columns.map((col) => (
            <th
              key={col.key}
              scope="col"
              aria-sort={col.sortable ? ariaSortOf(sort, col.key) : undefined}
            >
              {col.sortable && onSortChange ? (
                <SortButton
                  header={col.header}
                  columnKey={col.key}
                  sort={sort}
                  onSortChange={onSortChange}
                />
              ) : (
                col.header
              )}
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
            {selection ? (
              <SelectCell
                checked={selection.selectedKeys.has(rowKey(row))}
                label={selection.rowLabel(row)}
                onToggle={() =>
                  selection.onSelectionChange(withToggled(selection.selectedKeys, rowKey(row)))
                }
              />
            ) : null}
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
