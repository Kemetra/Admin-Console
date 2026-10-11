import { SignIn } from "@/auth/SignIn";
import type { SignInResolution } from "@/auth/signin-flow";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
/**
 * SF-1 route wrapper. Owns the post-sign-in navigation: on auto-select it
 * drives the SF-3 tenant switch then enters the shell; on chooser/no-access it
 * enters the protected area (which renders the gate or no-access from context).
 *
 * RT-355: an auto-select returns to the URL the user asked for before being
 * sent here (ProtectedArea's redirect state), if it is a safe in-app path.
 */
import { useLocation, useNavigate } from "react-router";
import { type SignInRedirectState, safeReturnPath } from "./return-path";

export function SignInRoute(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { switchTenant, refresh } = useActiveContextValue();

  async function onResolved(resolution: SignInResolution): Promise<void> {
    let target = "/";
    if (resolution.kind === "auto-select") {
      await switchTenant(resolution.tenantId);
      target = safeReturnPath((location.state as SignInRedirectState | null)?.from);
    } else {
      // RT-343: the context cached before sign-in is the signed-out 401. Only
      // the tenant switch above refreshes it, so the other paths re-fetch here,
      // or the protected area would read the stale entry and bounce to /signin.
      await refresh();
    }
    // choose / no-access land on `/`, where the protected area renders the
    // chooser or no-access from the re-fetched context; a requested page would
    // not be reachable until a tenant is chosen.
    navigate(target, { replace: true });
  }

  return <SignIn onResolved={onResolved} />;
}
