/**
 * RT-753 (UX-10) — the selection state a list screen keeps beside `DataTable`.
 *
 * - The selection belongs to the scope it was made under. `scopeKey` must
 *   encode everything that makes the old selection meaningless (tenant/store
 *   scope, filters AND sort): when it changes the selection is cleared, and
 *   coming back to an earlier scope does not bring the old selection back.
 * - Only rows still listed count ("invisible selection is dangerous
 *   selection"): a row that left the list drops out of `selectedKeys`.
 * - `mode` keeps "this page" and "all matching records" apart. `all-matching`
 *   is only meaningful where a bulk-query snapshot contract exists; the caller
 *   must not offer it (see `SelectionSummary`) or act on it otherwise.
 */
import { useCallback, useMemo, useState } from "react";

export type SelectionMode = "page" | "all-matching";

interface State {
  readonly scope: string;
  readonly keys: ReadonlySet<string>;
  readonly mode: SelectionMode;
}

const NONE: ReadonlySet<string> = new Set();

function fresh(scope: string): State {
  return { scope, keys: NONE, mode: "page" };
}

export interface RowSelection {
  /** Always a subset of the listed rows. */
  readonly selectedKeys: ReadonlySet<string>;
  readonly mode: SelectionMode;
  /** An explicit selection; leaves `all-matching` mode. */
  readonly setSelectedKeys: (next: ReadonlySet<string>) => void;
  readonly selectAllMatching: () => void;
  readonly clear: () => void;
}

/**
 * `rowKeys` are the keys of the rows currently listed. Memoise them (or pass a
 * stable array): `selectedKeys` is recomputed whenever the array identity
 * changes, so an inline `rows.map(rowKey)` yields a new Set every render.
 */
export function useRowSelection(scopeKey: string, rowKeys: readonly string[]): RowSelection {
  const [state, setState] = useState<State>(() => fresh(scopeKey));
  const stale = state.scope !== scopeKey;
  // A scope change resets the stored state (not just the view of it), so
  // returning to an earlier scope cannot resurrect its selection.
  if (stale) setState(fresh(scopeKey));
  const current = stale ? fresh(scopeKey) : state;

  const selectedKeys = useMemo(() => {
    if (current.mode === "all-matching") return new Set(rowKeys);
    return new Set(rowKeys.filter((k) => current.keys.has(k)));
  }, [current.mode, current.keys, rowKeys]);

  // A row that left the list is dropped from the stored selection itself, not
  // just from the view, so it is not selected again if it comes back.
  if (current.mode === "page" && selectedKeys.size !== current.keys.size) {
    setState({ scope: scopeKey, keys: selectedKeys, mode: "page" });
  }

  const setSelectedKeys = useCallback(
    (next: ReadonlySet<string>) => setState({ scope: scopeKey, keys: next, mode: "page" }),
    [scopeKey],
  );
  const selectAllMatching = useCallback(
    () => setState({ scope: scopeKey, keys: NONE, mode: "all-matching" }),
    [scopeKey],
  );
  const clear = useCallback(() => setState(fresh(scopeKey)), [scopeKey]);

  return { selectedKeys, mode: current.mode, setSelectedKeys, selectAllMatching, clear };
}
