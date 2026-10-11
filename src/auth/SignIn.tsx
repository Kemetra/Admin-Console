import { Banner } from "@/components/Banner";
import { TowerMark } from "@/components/TowerMark";
import { signIn } from "@/lib/client";
/**
 * SF-1 sign-in surface (T020/T023). Centered card on the light canvas
 * (confirmed shape brief). Uncontrolled native form (R3-4, no form library).
 * All states from the mockup: default, submitting, 401 generic, 429 retry-after.
 *
 * Logic lives in resolveSignIn (signin-flow.ts, unit-tested); this component
 * owns presentation + the submit lifecycle. Credentials are read from the form
 * at submit and never persisted (FR-003-009).
 */
import { type FormEvent, useState } from "react";
import { type SignInResolution, resolveSignIn } from "./signin-flow";
import "./signin.css";

export interface SignInProps {
  /** Called with the resolved outcome so the shell can route (auto-select / chooser / no-access). */
  onResolved: (resolution: SignInResolution) => void | Promise<void>;
}

type Phase =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string; requestId?: string }
  | { status: "rate-limited"; retryAfterSeconds: number; requestId?: string };

export function SignIn({ onResolved }: SignInProps): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>({ status: "idle" });

  const submitting = phase.status === "submitting";
  const rateLimited = phase.status === "rate-limited";
  const disabled = submitting || rateLimited;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    setPhase({ status: "submitting" });
    const res = await signIn({ email, password });
    const resolution = resolveSignIn({
      status: res.status,
      data: res.data as { memberships?: Array<{ tenant_id: string }> } | undefined,
      error: res.error as { error?: { request_id?: string } } | undefined,
      retryAfterSeconds: res.retryAfterSeconds,
    });

    if (resolution.kind === "error") {
      setPhase({ status: "error", message: resolution.message, requestId: resolution.requestId });
      return;
    }
    if (resolution.kind === "rate-limited") {
      setPhase({
        status: "rate-limited",
        retryAfterSeconds: resolution.retryAfterSeconds,
        requestId: resolution.requestId,
      });
      return;
    }
    await onResolved(resolution);
  }

  const invalid = phase.status === "error";

  return (
    <div className="signin-stage">
      <div className="signin-shell">
        <div className="signin-brand">
          <span className="tower-lockup">
            <TowerMark className="tower-mark" />
            <span className="tower-lockup__word">Retail Tower OS</span>
          </span>
        </div>

        <div className="signin-card">
          <div className="signin-head">
            <h1 className="signin-head__title">Sign in</h1>
            <p className="signin-head__sub">Operator access to the command console.</p>
          </div>

          {phase.status === "error" ? (
            <div className="signin-banner">
              <Banner variant="danger" message={phase.message} requestId={phase.requestId} />
            </div>
          ) : null}
          {phase.status === "rate-limited" ? (
            <div className="signin-banner">
              <Banner
                variant="warning"
                message={`Too many attempts. You can try again in ${phase.retryAfterSeconds}s.`}
                requestId={phase.requestId}
              />
            </div>
          ) : null}

          <form className="signin-form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                className="input"
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@operator.example"
                disabled={disabled}
                aria-invalid={invalid}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••"
                disabled={disabled}
                aria-invalid={invalid}
                required
              />
            </div>
            <button className="btn-primary signin-submit" type="submit" disabled={disabled}>
              {submitting ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Signing in
                </>
              ) : rateLimited ? (
                `Try again in ${phase.retryAfterSeconds}s`
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>

        <p className="signin-foot">Protected platform · all activity is audited</p>
      </div>
    </div>
  );
}
