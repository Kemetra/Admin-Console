/**
 * Shared list-table presenter (T006). The canonical tables-over-cards surface
 * (DESIGN.md rule 7) for RF-2's tenant/store rosters and later list families.
 *
 * Renders EXACTLY the rows it is handed — the backend-scoped set, no client-side
 * authorization filter (spec OQ-2). Each row is the activation target (row →
 * detail), keyboard-navigable (Enter/Space), 36px+ touch floor (DESIGN.md rule
 * 10); with selection on, opening is an explicit button instead (RT-756). No table library (research R4-4); hand-rolled over the design tokens.
 *
 * RT-753 (UX-10), both opt-in so existing tables render exactly as before:
 * - Sort: a column marked `sortable` becomes a header button when the caller
 *   passes `onSortChange`. The caller owns the sort state AND the order of
 *   `rows`; this table never reorders (sort the dataset, not the viewport).
 * - Selection: a controlled checkbox column (`selection`). Selection is not
 *   navigation, so the checkbox never activates the row.
 *
 * RT-756 (UX-10 "Selection ≠ Navigation"): with `selection` on, the row is no
 * longer the activation target or a tab stop. An explicit «Open» button sits in
 * its own cell right after the checkbox (tab order: checkbox, then open) and
 * calls `onRowActivate`. It is named for the row from `selection.rowLabel`
 * ("Open Alpha"), the same caller-provided row name as the checkbox, so no
 * extra prop is needed. Without `selection` nothing changes.
 */
import "./data-table.css";
import { useT } from "@/i18n";
import { useState } from "react";
import {
  OpenCell,
  OpenHeader,
  PageSelectHeader,
  SelectCell,
  SortAnnouncer,
  SortButton,
  ariaSortOf,
} from "./DataTableParts";
import { DataTableScroll, useCaptionId } from "./DataTableScroll";
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
  /** The row's name, used to label its checkbox and its «Open» button. */
  rowLabel: (row: Row) => string;
}

export interface DataTableProps<Row> {
  /** Accessible caption naming the table contents. */
  caption: string;
  columns: ReadonlyArray<DataTableColumn<Row>>;
  rows: ReadonlyArray<Row>;
  rowKey: (row: Row) => string;
  /**
   * Row activation → open detail. Click / Enter / Space on the row, or, when
   * `selection` is on, the row's explicit «Open» button.
   */
  onRowActivate: (row: Row) => void;
  /** The active sort, shown on its header (`aria-sort`). */
  sort?: SortState | null;
  /**
   * Called with the requested sort when a sortable header is pressed; `null`
   * (the third press) asks for the server's order (RT-758).
   */
  onSortChange?: (next: SortState | null) => void;
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

/** The whole-row activation of a table without selection: click, Enter or Space. */
function rowActivation<Row>(row: Row, onRowActivate: (row: Row) => void) {
  return {
    tabIndex: 0,
    onClick: () => onRowActivate(row),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onRowActivate(row);
      }
    },
  };
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
  const captionId = useCaptionId();
  const t = useT();
  // RT-758: announced from the press that cleared the sort, not from the prop.
  const [restored, setRestored] = useState(false);
  const sortable = onSortChange !== undefined && columns.some((c) => c.sortable);
  const changeSort = (next: SortState | null) => {
    setRestored(next === null);
    onSortChange?.(next);
  };
  const pageKeys = rows.map(rowKey);
  const pageSelected = pageKeys.filter((k) => selection?.selectedKeys.has(k)).length;
  return (
    <>
      <DataTableScroll captionId={captionId}>
        <table className="data-table">
          <caption id={captionId} className="data-table__caption">
            {caption}
          </caption>
          <thead>
            <tr>
              {selection ? (
                <PageSelectHeader
                  checked={pageKeys.length > 0 && pageSelected === pageKeys.length}
                  mixed={pageSelected > 0 && pageSelected < pageKeys.length}
                  onToggle={() =>
                    selection.onSelectionChange(pageToggled(selection.selectedKeys, pageKeys))
                  }
                />
              ) : null}
              {selection ? <OpenHeader /> : null}
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
                      onSortChange={changeSort}
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
                className={
                  selection ? "data-table__row data-table__row--static" : "data-table__row"
                }
                {...(selection ? {} : rowActivation(row, onRowActivate))}
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
                {selection ? (
                  <OpenCell label={selection.rowLabel(row)} onOpen={() => onRowActivate(row)} />
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
      </DataTableScroll>
      {sortable ? <SortAnnouncer message={restored ? t("table.sort.restored") : ""} /> : null}
    </>
  );
}
