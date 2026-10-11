/**
 * Operators scope prompt (SF5-1, FR-005-007). The pre-call active-tenant guard:
 * with no active tenant, RF-5 routes here instead of calling `listMembers`
 * (which has no precondition-401), or instead of letting a `createInvitation`
 * precondition-401 surface. A scope precondition, never a sign-out — the
 * operator resolves it via the RF-1 scope bar above.
 */
import "../shell/surface.css";

export function OperatorScopePrompt(): React.JSX.Element {
  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">Operators</h1>
        </div>
      </header>
      <p className="scope-prompt">
        Select a tenant to manage its operators. Use the tenant selector in the scope bar above to
        choose where you are working.
      </p>
    </div>
  );
}
