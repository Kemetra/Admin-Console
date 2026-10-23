/**
 * RT-753 (UX-10) — the opt-in header and selection cells of `DataTable`, kept
 * apart so the table itself stays a small presenter.
 */
import { Icon } from "@/components/icons/Icon";
import { useT } from "@/i18n";
import { useEffect, useRef } from "react";
import { type SortState, nextSort } from "./tableSort";

/** The WAI-ARIA token for the active column; every other column carries none. */
export function ariaSortOf(
  sort: SortState | null | undefined,
  key: string,
): "ascending" | "descending" | undefined {
  if (sort?.key !== key) return undefined;
  return sort.direction === "asc" ? "ascending" : "descending";
}

const SORT_ICON = { asc: "sortAscending", desc: "sortDescending" } as const;

/**
 * A sortable column header: a native button (Enter/Space, tab stop, the global
 * focus outline) whose label is the header text. The active direction is a
 * vertical arrow SHAPE from the registry (`sortAscending` / `sortDescending`);
 * an inactive sortable column shows the muted two-arrow `sortable` hint (RT-758,
 * UX-10: sortability is explicit). Both are shapes, never colour alone, and
 * decorative: `aria-sort` on the `<th>` carries the state for screen readers.
 * The third press yields `null`, the server's order.
 */
export function SortButton({
  header,
  columnKey,
  sort,
  onSortChange,
}: Readonly<{
  header: string;
  columnKey: string;
  sort: SortState | null | undefined;
  onSortChange: (next: SortState | null) => void;
}>): React.JSX.Element {
  const active = sort?.key === columnKey ? sort.direction : undefined;
  return (
    <button
      type="button"
      className="data-table__sort"
      onClick={() => onSortChange(nextSort(sort, columnKey))}
    >
      {header}
      {active ? (
        <span className="data-table__sort-mark" data-sort-direction={active} aria-hidden="true">
          <Icon name={SORT_ICON[active]} size="sm" />
        </span>
      ) : (
        <span className="data-table__sort-mark data-table__sort-mark--hint" aria-hidden="true">
          <Icon name="sortable" size="sm" />
        </span>
      )}
    </button>
  );
}

/**
 * The table's polite live region for the sort (RT-758). Always mounted while the
 * table is sortable so assistive tech has registered it before the text lands;
 * the text is driven by the press, never by the `sort` prop, so a caller reset
 * (a scope change) or the first render announces nothing stale.
 */
export function SortAnnouncer({ message }: Readonly<{ message: string }>): React.JSX.Element {
  return (
    <output className="sr-only" aria-live="polite" aria-atomic="true">
      {message}
    </output>
  );
}

/**
 * RT-757: a selection cell is the whole target (the 36px floor applies inside
 * tables) while the checkbox keeps its 18px glyph. A click on the cell itself
 * toggles; a click on the checkbox is left to its own `onChange`, so nothing
 * toggles twice. Click and key events stop here, so selecting never opens the
 * row (Selection ≠ navigation, UX-10).
 */
function cellTarget(onToggle: () => void) {
  return {
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      if (e.target === e.currentTarget) onToggle();
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => e.stopPropagation(),
  };
}

/** The header checkbox cell: selects/clears the rows on this page; mixed when partly selected. */
export function PageSelectHeader({
  checked,
  mixed,
  onToggle,
}: Readonly<{ checked: boolean; mixed: boolean; onToggle: () => void }>): React.JSX.Element {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <th scope="col" className="data-table__select" {...cellTarget(onToggle)}>
      <span className="sr-only">{t("table.selection.column")}</span>
      <input
        ref={ref}
        type="checkbox"
        className="data-table__checkbox"
        checked={checked}
        aria-label={t("table.selection.selectPage")}
        onChange={onToggle}
      />
    </th>
  );
}

/** The row checkbox cell; see `cellTarget` for why it never opens the row. */
export function SelectCell({
  checked,
  label,
  onToggle,
}: Readonly<{ checked: boolean; label: string; onToggle: () => void }>): React.JSX.Element {
  const t = useT();
  return (
    <td className="data-table__select" {...cellTarget(onToggle)}>
      <input
        type="checkbox"
        className="data-table__checkbox"
        checked={checked}
        aria-label={t("table.selection.selectRow", { value: label })}
        onChange={onToggle}
      />
    </td>
  );
}

/**
 * RT-756 (UX-10 "Selection ≠ Navigation"): with selection on, the row is no
 * longer a target, so opening it is an explicit control. The header carries
 * readable text so the column is not an empty header.
 */
export function OpenHeader(): React.JSX.Element {
  const t = useT();
  return (
    <th scope="col" className="data-table__open">
      <span className="sr-only">{t("table.selection.open")}</span>
    </th>
  );
}

/**
 * The explicit row-open button. Its visible label is «Open»; the accessible
 * name adds the row's name ("Open Alpha") so it contains the visible label
 * (WCAG 2.5.3) and tells rows apart. A native button: Enter and Space work, and
 * the shared secondary style carries the 36px target floor.
 */
export function OpenCell({
  label,
  onOpen,
}: Readonly<{ label: string; onOpen: () => void }>): React.JSX.Element {
  const t = useT();
  return (
    <td className="data-table__open">
      <button
        type="button"
        className="btn-secondary"
        aria-label={t("table.selection.openRow", { value: label })}
        onClick={onOpen}
      >
        {t("table.selection.open")}
      </button>
    </td>
  );
}
