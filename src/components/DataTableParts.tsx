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

/**
 * A sortable column header: a native button (Enter/Space, tab stop, the global
 * focus outline) whose label is the header text. The direction is a chevron
 * SHAPE (up = ascending) drawn from the registry's `disclosure` glyph, so it
 * never relies on colour; `aria-sort` on the `<th>` carries it for screen
 * readers. An inactive sortable column shows no mark.
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
  onSortChange: (next: SortState) => void;
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
          <Icon name="disclosure" size="sm" />
        </span>
      ) : null}
    </button>
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
