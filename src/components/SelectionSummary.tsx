/**
 * RT-753 (UX-10) — the bulk-command context a selection creates: how many rows
 * and WHICH scope, announced politely, with a clear action.
 *
 * "All visible rows" and "all matching records" are different scopes and are
 * never conflated: the count always says "on this page" unless the caller is in
 * `all-matching` mode with an authoritative total. The all-matching offer
 * exists only when the caller passes `allMatching` (a real total and a handler,
 * i.e. a bulk-query snapshot contract); without it the component cannot offer
 * a scope the backend does not support.
 */
import { useT } from "@/i18n";
import type { SelectionMode } from "./useRowSelection";

export interface AllMatchingCapability {
  /** The authoritative number of records matching the current query. */
  readonly total: number;
  readonly onSelect: () => void;
}

export interface SelectionSummaryProps {
  /** Rows selected on the loaded page(s). */
  readonly selectedCount: number;
  readonly mode?: SelectionMode;
  readonly allMatching?: AllMatchingCapability;
  readonly onClear: () => void;
}

export function SelectionSummary({
  selectedCount,
  mode = "page",
  allMatching,
  onClear,
}: Readonly<SelectionSummaryProps>): React.JSX.Element | null {
  const t = useT();
  const inAllMatching = mode === "all-matching" && allMatching !== undefined;
  if (selectedCount === 0 && !inAllMatching) return null;

  const offer = !inAllMatching && allMatching !== undefined && allMatching.total > selectedCount;
  const text = inAllMatching
    ? t("table.selection.allMatching", { count: allMatching.total })
    : t("table.selection.pageCount", { count: selectedCount });

  return (
    <output className="data-table__selection" aria-live="polite">
      <span>{text}</span>
      {offer ? (
        <button type="button" className="btn-secondary" onClick={allMatching.onSelect}>
          {t("table.selection.selectAllMatching", { count: allMatching.total })}
        </button>
      ) : null}
      <button type="button" className="btn-secondary" onClick={onClear}>
        {t("table.selection.clear")}
      </button>
    </output>
  );
}
