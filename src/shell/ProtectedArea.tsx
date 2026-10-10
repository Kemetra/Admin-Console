import { NoAccess } from "@/auth/NoAccess";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
/**
 * Protected area (SF-2/SF-3, T031). Renders the right surface based on the
 * server-resolved context — never a frontend authorization decision
 * (FR-003-004), only rendering of backend truth:
 *
 *  - loading                  → nothing yet (context resolving)
 *  - session lost (401, S5)   → redirect to SF-1 /signin
 *  - no memberships (S7)      → NoAccess
 *  - no active tenant (multi) → ScopeGate (S2)
 *  - active tenant resolved   → AppShell
 *
 * The 401 path runs through the auth interceptor (refresh-once + retry); if the
 * refresh also fails the session is lost and we route to SF-1. This is why a
 * 401 (not signed in / expired) is distinct from a 200 with zero memberships
 * (signed in, no access).
 */
import { Navigate, Outlet } from "react-router";
import { AppShell } from "./AppShell";
import { ScopeGate } from "./ScopeGate";
import { useSignOut } from "./useSignOut";

export function ProtectedArea(): React.JSX.Element | null {
  const { context, isLoading, sessionLost, membershipCount } = useActiveContextValue();
  const signOut = useSignOut();

  if (isLoading) {
    return null;
  }
  if (sessionLost || !context) {
    // Not authenticated (no cookie) or session expired and refresh failed (S5).
    return <Navigate to="/signin" replace />;
  }
  if (membershipCount === 0) {
    return <NoAccess onSignOut={signOut} />;
  }
  if (!context.active_tenant) {
    return <ScopeGate />;
  }
  // Authenticated + scope resolved: the shell wraps the routed surface (T009).
  // The nested route (Overview index, /tenants, /stores) renders into <Outlet/>.
  // RT-268: keyed by scope, so a scope change remounts the surface and every
  // filter, selection and draft that belonged to the old scope is dropped.
  const scopeKey = `${context.active_tenant.id}/${context.active_store?.id ?? "all"}`;
  return (
    <AppShell onSignOut={signOut}>
      <Outlet key={scopeKey} />
    </AppShell>
  );
}
