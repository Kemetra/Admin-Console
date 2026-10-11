/**
 * Shared list state presenter (T007). Renders the non-table states of a list
 * surface: loading and empty. The "ready" state renders nothing — the caller
 * renders the DataTable instead.
 *
 * Empty is a SUCCESSFUL zero-row state, distinct from loading and from error
 * (spec OQ-8, design-brief §6). Error is NOT handled here — it routes through
 * RF-1's persistent Banner (reuse, not a new surface). The create entry point
 * is passed in and rendered in the empty state (never role-hidden, OQ-3).
 */
import { useT } from "@/i18n";
import "./list-state.css";

export type ListStateKind = "loading" | "empty" | "ready";

export interface ListStateProps {
  state: ListStateKind;
  /** Translated plural noun for the loading copy ("Loading {label}…"). */
  label?: string;
  /** Empty-state message; the zero-row success copy. */
  emptyMessage?: string;
  /** Create entry point rendered alongside the empty message. */
  action?: React.ReactNode;
}

export function ListState({
  state,
  label,
  emptyMessage,
  action,
}: ListStateProps): React.JSX.Element | null {
  const t = useT();
  if (state === "ready") {
    return null;
  }
  if (state === "loading") {
    return (
      <div className="list-state list-state--loading" aria-busy="true">
        <span className="spinner" aria-hidden="true" />
        <span>
          {t("components.list.loading", { label: label ?? t("components.list.loadingDefault") })}
        </span>
      </div>
    );
  }
  // empty
  return (
    <div className="list-state list-state--empty">
      <p className="list-state__msg">{emptyMessage}</p>
      {action ? <div className="list-state__action">{action}</div> : null}
    </div>
  );
}
