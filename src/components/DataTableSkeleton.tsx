/**
 * Loading state of a list table (RT-549; approved Stores designs 02/07/12).
 * The real column headers over flat placeholder rows, so the page keeps its
 * shape while the roster loads. Static bars — no shimmer — as in the designs.
 *
 * The table is `aria-busy`, the bars are hidden from assistive tech, and a
 * visually hidden status line carries the same "Loading {label}…" copy as the
 * spinner `ListState`, so the announcement is unchanged.
 */
import { useT } from "@/i18n";
import type { DataTableColumn } from "./DataTable";
import "./data-table.css";

const SKELETON_ROWS = 6;

export interface DataTableSkeletonProps<Row> {
  /** Accessible caption naming the table contents (same as the loaded table). */
  caption: string;
  /** Only the key and header are used; cells are placeholders. */
  columns: ReadonlyArray<Pick<DataTableColumn<Row>, "key" | "header">>;
  /** Translated plural noun for the loading copy ("Loading {label}…"). */
  label: string;
}

export function DataTableSkeleton<Row = unknown>({
  caption,
  columns,
  label,
}: Readonly<DataTableSkeletonProps<Row>>): React.JSX.Element {
  const t = useT();
  const rowKeys = Array.from({ length: SKELETON_ROWS }, (_, i) => `skeleton-${i}`);
  return (
    <>
      <table className="data-table" aria-busy="true">
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
          {rowKeys.map((rowKey) => (
            <tr key={rowKey} className="data-table__row data-table__row--skeleton">
              {columns.map((col) => (
                <td key={col.key}>
                  <span className="skeleton" aria-hidden="true" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <output className="sr-only">{t("components.list.loading", { label })}</output>
    </>
  );
}
