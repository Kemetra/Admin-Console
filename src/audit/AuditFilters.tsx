/**
 * SF-6-1 filter bar (T019). Uncontrolled native inputs (no form library, R6-5):
 * action prefix, actor id, store id (shown only when a store dimension is in
 * scope — scope-driven, never role-driven, FR-006-004), from/to date-time. One
 * navy Apply; a quiet Clear. Serializes to the contract's query params.
 */
import { Icon } from "@/components/Icon";
import { useRef } from "react";
import type { AuditFilters as Filters } from "./auditQueryKeys";
import "./audit.css";

export interface AuditFiltersProps {
  /** True when the active scope carries a store dimension (shows the store filter). */
  storeInScope: boolean;
  onApply: (filters: Filters) => void;
  onClear: () => void;
}

export function AuditFilters({
  storeInScope,
  onApply,
  onClear,
}: AuditFiltersProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);

  function read(): Filters {
    const form = new FormData(formRef.current ?? undefined);
    const val = (k: string) => {
      const v = String(form.get(k) ?? "").trim();
      return v.length > 0 ? v : undefined;
    };
    return {
      action: val("action"),
      actor_user_id: val("actor_user_id"),
      store_id: storeInScope ? val("store_id") : undefined,
      from: val("from"),
      to: val("to"),
    };
  }

  return (
    <form
      ref={formRef}
      className="audit-filters"
      // Filters are not unsaved work: no Stay / Discard prompt for them (RT-268).
      data-dirty-guard="off"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(read());
      }}
      noValidate
    >
      <span className="audit-filters__lead" aria-hidden="true">
        <Icon name="search" size={16} />
      </span>
      <div className="audit-filters__field">
        <label htmlFor="f-action">Action</label>
        <input
          id="f-action"
          name="action"
          className="input"
          placeholder="auth. / shift."
          autoComplete="off"
        />
      </div>
      <div className="audit-filters__field">
        <label htmlFor="f-actor">Actor</label>
        <input
          id="f-actor"
          name="actor_user_id"
          className="input"
          placeholder="user id"
          autoComplete="off"
        />
      </div>
      {storeInScope ? (
        <div className="audit-filters__field">
          <label htmlFor="f-store">Store</label>
          <input
            id="f-store"
            name="store_id"
            className="input"
            placeholder="store id"
            autoComplete="off"
          />
        </div>
      ) : null}
      <div className="audit-filters__field">
        <label htmlFor="f-from">From</label>
        <input id="f-from" name="from" type="datetime-local" className="input" />
      </div>
      <div className="audit-filters__field">
        <label htmlFor="f-to">To</label>
        <input id="f-to" name="to" type="datetime-local" className="input" />
      </div>
      <div className="audit-filters__actions">
        <button type="submit" className="btn-primary">
          Apply
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            formRef.current?.reset();
            onClear();
          }}
        >
          Clear
        </button>
      </div>
    </form>
  );
}
