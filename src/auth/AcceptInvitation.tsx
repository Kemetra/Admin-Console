import { Banner } from "@/components/Banner";
import { TowerMark } from "@/components/TowerMark";
import { queryKeys } from "@/lib/query";
import { useAcceptInvitation } from "@/operators/useMembers";
/**
 * SF5-4 — Accept invitation (public, T026/T028). Sibling of SF-1 sign-in: the
 * same centered card on the light canvas (reuses the `signin-*` visual
 * contract), NOT behind the protected gate. The accept token (from the email
 * link, `?token=`) authenticates the request (`acceptInvitation` is
 * `security: []`). New invitees set a display name + password; existing users
 * need neither.
 *
 * On 200 a session is established backend-side; we invalidate the active-context
 * query (so the shell does not render a stale session-lost state from cache),
 * then navigate to `/` where ProtectedArea resolves the new context. On 400 the
 * token is invalid/expired — rendered generically, with a path back to sign-in.
 */
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import "./signin.css";

export function AcceptInvitation(): React.JSX.Element {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const accept = useAcceptInvitation();
  const [error, setError] = useState<string | undefined>();

  const invalidToken = token.length === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);
    const form = event.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const displayName = (form.elements.namedItem("display_name") as HTMLInputElement).value;

    const res = await accept.mutateAsync({
      token,
      password: password || undefined,
      display_name: displayName || undefined,
    });
    if (res.status >= 400) {
      setError("This invitation link is invalid or has expired.");
      return;
    }
    // Session established: drop the cached context so the shell re-fetches it.
    await qc.invalidateQueries({ queryKey: queryKeys.activeContext });
    navigate("/", { replace: true });
  }

  return (
    <div className="signin-stage">
      <div className="signin-card">
        <div className="signin-head">
          <span className="tower-lockup">
            <TowerMark className="tower-mark" />
            <span className="tower-lockup__word">Retail Tower OS</span>
          </span>
          <h1 className="signin-head__sub">
            {invalidToken ? "Invitation" : "Accept your invitation"}
          </h1>
        </div>

        {invalidToken ? (
          <>
            <div className="signin-banner">
              <Banner variant="danger" message="This invitation link is invalid or has expired." />
            </div>
            <p className="signin-foot">
              <Link to="/signin">Go to sign in</Link>
            </p>
          </>
        ) : (
          <>
            {error ? (
              <div className="signin-banner">
                <Banner variant="danger" message={error} />
              </div>
            ) : null}

            <form className="signin-form" onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="display_name">Display name</label>
                <input
                  className="input"
                  id="display_name"
                  name="display_name"
                  autoComplete="name"
                  disabled={accept.isPending}
                />
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <input
                  className="input"
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Required for a new account"
                  disabled={accept.isPending}
                />
              </div>
              <button
                className="btn-primary signin-submit"
                type="submit"
                disabled={accept.isPending}
              >
                {accept.isPending ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Accepting
                  </>
                ) : (
                  "Accept invitation"
                )}
              </button>
            </form>

            <p className="signin-foot">
              Already have access? <Link to="/signin">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
