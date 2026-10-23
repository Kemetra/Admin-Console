import { NoAccess } from "@/auth/NoAccess";
/**
 * Protected area (SF-2/SF-3, T031). Renders the right surface based on the
 * server-resolved context — never a frontend authorization decision
 * (FR-003-004), only rendering of backend truth:
 *
 *  - loading                  → nothing yet (context resolving)
 *  - session lost (401, S5)   → redirect to SF-1 /signin
 *  - no memberships (S7)      → NoAccess; a platform admin goes to /platform, or
 *                               stays in their support session's tenant (RT-844)
 *  - no active tenant (multi) → ScopeGate (S2)
 *  - active tenant resolved   → AppShell
 *
 * The 401 path runs through the auth interceptor (refresh-once + retry); if the
 * refresh also fails the session is lost and we route to SF-1. This is why a
 * 401 (not signed in / expired) is distinct from a 200 with zero memberships
 * (signed in, no access).
 *
 * RT-621: a 429 on the context read is not "signed out". With no context yet,
 * the area shows the rate-limit banner (countdown + retry), never /signin.
 */
import { RateLimitBanner } from "@/components/RateLimitBanner";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { Navigate, Outlet, useLocation } from "react-router";
import { AppShell } from "./AppShell";
import { ScopeGate } from "./ScopeGate";
import { type SignInRedirectState, returnPathOf } from "./return-path";
import { useSignOut } from "./useSignOut";

type Context = NonNullable<ReturnType<typeof useActiveContextValue>["context"]>;

/**
 * RT-844: a platform admin inside a support session has no membership of their
 * own, so the session stands in for one. Only the session's own tenant counts,
 * and only for a platform admin; every read stays authorized server-side.
 */
function inSupportSession(context: Context): boolean {
  const session = context.support_session;
  return (
    context.user?.is_platform_admin === true &&
    session != null &&
    context.active_tenant?.id === session.tenant_id
  );
}

export function ProtectedArea(): React.JSX.Element | null {
  const { context, isLoading, sessionLost, rateLimited, membershipCount } = useActiveContextValue();
  const signOut = useSignOut();
  const location = useLocation();

  if (!context && !sessionLost && rateLimited) {
    return (
      <main className="rate-limited-area">
        <RateLimitBanner dismissible={false} />
      </main>
    );
  }
  if (isLoading) {
    return null;
  }
  if (sessionLost || !context) {
    // Not authenticated (no cookie) or session expired and refresh failed (S5).
    // RT-355: keep the requested URL so sign-in can return to it.
    const state: SignInRedirectState = { from: returnPathOf(location) };
    return <Navigate to="/signin" replace state={state} />;
  }
  if (membershipCount === 0 && !inSupportSession(context)) {
    // RT-844: zero memberships is NoAccess only for a user with no other way in.
    // A platform admin has the console, so the screen never claims "no access".
    return context.user?.is_platform_admin === true ? (
      <Navigate to="/platform" replace />
    ) : (
      <NoAccess onSignOut={signOut} />
    );
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
