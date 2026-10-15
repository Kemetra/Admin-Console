import { Banner } from "@/components/Banner";
import { TowerMark } from "@/components/TowerMark";
import { type MessageKey, useT } from "@/i18n";
import { signIn } from "@/lib/client";
/**
 * SF-1 sign-in surface (T020/T023). Centered card on the light canvas
 * (confirmed shape brief). Uncontrolled native form (R3-4, no form library).
 * All states from the mockup: default, submitting, 401 generic, 429 retry-after.
 *
 * Logic lives in resolveSignIn (signin-flow.ts, unit-tested); this component
 * owns presentation + the submit lifecycle. Credentials are read from the form
 * at submit and never persisted (FR-003-009).
 *
 * RT-399: copy comes from the `auth.signIn.*` catalog. The phase keeps the
 * error's message key, not its text, so a locale switch re-renders it. The
 * word mark is the product's proper name and stays Latin in both locales; the
 * email and password inputs take machine input, so they stay LTR (UX-11).
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
  | { status: "error"; messageKey: MessageKey; requestId?: string }
  | { status: "rate-limited"; retryAfterSeconds: number; requestId?: string };

/** The submit button's label for the current phase. */
function SubmitLabel({ phase }: Readonly<{ phase: Phase }>): React.JSX.Element {
  const t = useT();
  if (phase.status === "submitting") {
    return (
      <>
        <span className="spinner" aria-hidden="true" /> {t("auth.signIn.submitting")}
      </>
    );
  }
  if (phase.status === "rate-limited") {
    return <>{t("auth.signIn.retryIn", { count: phase.retryAfterSeconds })}</>;
  }
  return <>{t("auth.signIn.submit")}</>;
}

export function SignIn({ onResolved }: SignInProps): React.JSX.Element {
  const t = useT();
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
      setPhase({
        status: "error",
        messageKey: resolution.messageKey,
        requestId: resolution.requestId,
      });
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
            <h1 className="signin-head__title">{t("auth.signIn.title")}</h1>
            <p className="signin-head__sub">{t("auth.signIn.subtitle")}</p>
          </div>

          {phase.status === "error" ? (
            <div className="signin-banner">
              <Banner variant="danger" message={t(phase.messageKey)} requestId={phase.requestId} />
            </div>
          ) : null}
          {phase.status === "rate-limited" ? (
            <div className="signin-banner">
              <Banner
                variant="warning"
                message={t("auth.signIn.errors.rateLimited", { count: phase.retryAfterSeconds })}
                requestId={phase.requestId}
              />
            </div>
          ) : null}

          <form className="signin-form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">{t("auth.signIn.email.label")}</label>
              <input
                className="input"
                id="email"
                name="email"
                type="email"
                dir="ltr"
                autoComplete="username"
                placeholder="you@operator.example"
                disabled={disabled}
                aria-invalid={invalid}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">{t("auth.signIn.password.label")}</label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                dir="ltr"
                autoComplete="current-password"
                placeholder="••••••••••"
                disabled={disabled}
                aria-invalid={invalid}
                required
              />
            </div>
            <button className="btn-primary signin-submit" type="submit" disabled={disabled}>
              <SubmitLabel phase={phase} />
            </button>
          </form>
        </div>

        <p className="signin-foot">{t("auth.signIn.footer")}</p>
      </div>
    </div>
  );
}
