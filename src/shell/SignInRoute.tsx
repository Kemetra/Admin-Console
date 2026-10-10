import { SignIn } from "@/auth/SignIn";
import type { SignInResolution } from "@/auth/signin-flow";
import { useActiveContextValue } from "@/context/ActiveContextProvider";
/**
 * SF-1 route wrapper. Owns the post-sign-in navigation: on auto-select it
 * drives the SF-3 tenant switch then enters the shell; on chooser/no-access it
 * enters the protected area (which renders the gate or no-access from context).
 */
import { useNavigate } from "react-router";

export function SignInRoute(): React.JSX.Element {
  const navigate = useNavigate();
  const { switchTenant, refresh } = useActiveContextValue();

  async function onResolved(resolution: SignInResolution): Promise<void> {
    if (resolution.kind === "auto-select") {
      await switchTenant(resolution.tenantId);
    } else {
      // RT-343: the context cached before sign-in is the signed-out 401. Only
      // the tenant switch above refreshes it, so the other paths re-fetch here,
      // or the protected area would read the stale entry and bounce to /signin.
      await refresh();
    }
    // choose / no-access / auto-select all land in the protected area, which
    // renders the correct surface from the re-fetched context.
    navigate("/", { replace: true });
  }

  return <SignIn onResolved={onResolved} />;
}
