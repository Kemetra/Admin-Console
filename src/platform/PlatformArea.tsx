/**
 * `/platform` entry gate (RT-780, RT-777 S1, OQ-3). The platform console is
 * entered on `context.user.is_platform_admin`, never through ProtectedArea, so a
 * platform admin with no membership and no active tenant reaches it and never
 * sees ScopeGate or the tenant picker. The flag only decides what to render
 * (usability): every platform read and write is authorized server-side (RT-391
 * D1).
 *
 *  - rate limited, no context yet → the rate-limit banner (RT-621), never /signin
 *  - loading                      → nothing yet
 *  - session lost / no context    → redirect to /signin, keeping the URL (RT-355)
 *  - not a platform admin         → PlatformNotAvailable, the same state a path
 *                                   that does not exist gets (non-disclosing)
 *  - platform admin               → PlatformShell around the routed surface
 */
import { RateLimitBanner } from "@/components/RateLimitBanner";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
import { type SignInRedirectState, returnPathOf } from "@/shell/return-path";
import { useSignOut } from "@/shell/useSignOut";
import { Navigate, Outlet, useLocation } from "react-router";
import { PlatformNotAvailable } from "./PlatformNotAvailable";
import { PlatformShell } from "./PlatformShell";

export function PlatformArea(): React.JSX.Element | null {
  const { context, isLoading, sessionLost, rateLimited } = useActiveContextValue();
  const signOut = useSignOut();
  const location = useLocation();

  const toSignIn = (
    <Navigate
      to="/signin"
      replace
      state={{ from: returnPathOf(location) } satisfies SignInRedirectState}
    />
  );
  if (sessionLost) {
    return toSignIn;
  }
  if (!context && rateLimited) {
    return (
      <main className="rate-limited-area">
        <RateLimitBanner dismissible={false} />
      </main>
    );
  }
  if (isLoading) {
    return null;
  }
  if (!context) {
    return toSignIn;
  }
  if (context.user?.is_platform_admin !== true) {
    return <PlatformNotAvailable />;
  }
  return (
    <PlatformShell onSignOut={signOut}>
      <Outlet />
    </PlatformShell>
  );
}
