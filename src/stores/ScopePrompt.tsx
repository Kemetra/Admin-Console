/**
 * Scope prompt (Phase 4, OQ-4). Rendered by the store surfaces when there is no
 * active tenant (pre-gate) or on a residual scope-`401`. It is a scope
 * precondition, NOT a session-expiry: it must never trigger RF-1's sign-out.
 * The operator resolves scope by switching tenant via the RF-1 scope header
 * (the scope bar above this content), so this prompt points there rather than
 * duplicating the chooser.
 */
import "../shell/surface.css";

export function ScopePrompt(): React.JSX.Element {
  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">Stores</h1>
        </div>
      </header>
      <p className="scope-prompt">
        Select a tenant before managing stores. Use the tenant selector in the scope bar above to
        choose where you are working.
      </p>
    </div>
  );
}
